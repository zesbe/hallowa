const { supabase } = require('../../config/supabase');
const { logger } = require('../../logger');

/**
 * Check if user has AI Chatbot add-on
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Whether user has the add-on
 */
async function hasAIChatbotAddOn(userId) {
  try {
    // Get ai-chatbot-basic add-on
    const { data: addOn } = await supabase
      .from('add_ons')
      .select('id')
      .eq('slug', 'ai-chatbot-basic')
      .eq('is_active', true)
      .maybeSingle();

    if (!addOn) {
      return false;
    }

    // Check if user has this add-on
    const { data: userAddOn } = await supabase
      .from('user_add_ons')
      .select('id')
      .eq('user_id', userId)
      .eq('add_on_id', addOn.id)
      .eq('is_active', true)
      .maybeSingle();

    return !!userAddOn;
  } catch (error) {
    logger.error('Error checking AI chatbot add-on:', error);
    return false;
  }
}

/**
 * Process incoming message with AI chatbot
 * @param {Object} message - WhatsApp message object
 * @param {Object} device - Device object
 * @param {Object} sock - WhatsApp socket
 */
async function processAIChatbotMessage(message, device, sock) {
  try {
    const userId = device.user_id;
    const deviceId = device.id;

    // Check if user has AI chatbot add-on
    const hasAddOn = await hasAIChatbotAddOn(userId);
    if (!hasAddOn) {
      logger.debug(`User ${userId} does not have AI chatbot add-on, skipping`);
      return;
    }

    // Extract message details
    const remoteJid = message.key.remoteJid;
    const messageText = message.message?.conversation ||
                       message.message?.extendedTextMessage?.text ||
                       '';

    if (!messageText || !remoteJid) {
      return;
    }

    // Don't process messages from groups or broadcast
    if (remoteJid.includes('@g.us') || remoteJid === 'status@broadcast') {
      return;
    }

    // Don't process own messages
    if (message.key.fromMe) {
      return;
    }

    logger.info(`Processing AI chatbot message from ${remoteJid}`, {
      deviceId,
      userId,
      messagePreview: messageText.substring(0, 50)
    });

    // Call ai-chatbot-handler edge function
    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl) {
      logger.error('SUPABASE_URL not configured');
      return;
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/ai-chatbot-handler`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        deviceId,
        contactPhone: remoteJid.split('@')[0],
        message: messageText
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('AI chatbot handler error:', {
        status: response.status,
        error: errorText
      });
      return;
    }

    const result = await response.json();

    if (result.reply) {
      // Send reply via WhatsApp
      await sock.sendMessage(remoteJid, {
        text: result.reply
      });

      logger.info(`AI chatbot sent reply to ${remoteJid}`, {
        deviceId,
        ruleUsed: result.rule?.rule_name,
        isAI: result.is_ai
      });
    }

  } catch (error) {
    logger.error('Error processing AI chatbot message:', error);
  }
}

module.exports = {
  processAIChatbotMessage,
  hasAIChatbotAddOn
};
