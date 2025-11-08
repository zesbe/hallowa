const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Save incoming/outgoing message to database for CRM
 */
async function saveMessageToDatabase(deviceId, userId, messageData) {
  try {
    const {
      key,
      message,
      messageType,
      pushName,
      fromMe
    } = messageData;

    // Validate message object
    if (!message || !key) {
      console.error('Invalid message data - missing message or key');
      return null;
    }

    // Extract contact JID
    const contactJid = fromMe ? key.remoteJid : key.remoteJid;
    if (!contactJid) {
      console.error('Invalid message data - missing contactJid');
      return null;
    }

    // Skip status broadcast and other non-chat messages
    if (contactJid === 'status@broadcast' || contactJid.includes('broadcast')) {
      console.log('⏭️  Skipping status broadcast message');
      return null;
    }

    const contactPhone = contactJid.split('@')[0];

    // Get or create conversation
    let conversation = await getOrCreateConversation(deviceId, userId, contactJid, pushName, contactPhone);

    if (!conversation) {
      console.error('Failed to create/get conversation');
      return null;
    }

    // Extract message content based on type
    let messageContent = '';
    let mediaUrl = null;
    let mediaMimeType = null;
    let mediaSize = null;
    let caption = null;
    let actualMessageType = 'text';

    if (message.conversation) {
      messageContent = message.conversation;
      actualMessageType = 'text';
    } else if (message.extendedTextMessage) {
      messageContent = message.extendedTextMessage.text;
      actualMessageType = 'text';
    } else if (message.imageMessage) {
      messageContent = message.imageMessage.caption || '';
      caption = message.imageMessage.caption;
      mediaMimeType = message.imageMessage.mimetype;
      mediaSize = message.imageMessage.fileLength;
      actualMessageType = 'image';
    } else if (message.videoMessage) {
      messageContent = message.videoMessage.caption || '';
      caption = message.videoMessage.caption;
      mediaMimeType = message.videoMessage.mimetype;
      mediaSize = message.videoMessage.fileLength;
      actualMessageType = 'video';
    } else if (message.documentMessage) {
      messageContent = message.documentMessage.fileName || 'Document';
      mediaMimeType = message.documentMessage.mimetype;
      mediaSize = message.documentMessage.fileLength;
      actualMessageType = 'document';
    } else if (message.audioMessage) {
      messageContent = 'Voice message';
      mediaMimeType = message.audioMessage.mimetype;
      mediaSize = message.audioMessage.fileLength;
      actualMessageType = 'audio';
    } else if (message.stickerMessage) {
      messageContent = 'Sticker';
      actualMessageType = 'sticker';
    } else if (message.locationMessage) {
      messageContent = `Location: ${message.locationMessage.degreesLatitude}, ${message.locationMessage.degreesLongitude}`;
      actualMessageType = 'location';
    }

    // Validate and format timestamp
    let messageTimestamp;
    try {
      if (key.timestamp && !isNaN(key.timestamp)) {
        // Convert WhatsApp timestamp (seconds) to milliseconds
        const timestampMs = typeof key.timestamp === 'string'
          ? parseInt(key.timestamp) * 1000
          : key.timestamp * 1000;
        messageTimestamp = new Date(timestampMs).toISOString();
      } else {
        // Fallback to current time if timestamp is invalid
        messageTimestamp = new Date().toISOString();
      }
    } catch (error) {
      console.error('Error parsing timestamp:', error);
      messageTimestamp = new Date().toISOString();
    }

    // Save message to database
    const { data: savedMessage, error: messageError } = await supabase
      .from('whatsapp_messages')
      .insert({
        conversation_id: conversation.id,
        user_id: userId,
        device_id: deviceId,
        message_id: key.id,
        from_me: fromMe,
        contact_jid: contactJid,
        message_type: actualMessageType,
        message_content: messageContent,
        media_url: mediaUrl,
        media_mime_type: mediaMimeType,
        media_size: mediaSize,
        caption: caption,
        status: fromMe ? 'sent' : 'delivered',
        timestamp: messageTimestamp,
        metadata: {
          pushName: pushName,
          participant: key.participant
        }
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error saving message:', messageError);
      return null;
    }

    console.log(`💬 Saved message to CRM: ${contactPhone} - ${actualMessageType}`);
    return savedMessage;

  } catch (error) {
    console.error('Error in saveMessageToDatabase:', error);
    return null;
  }
}

/**
 * Get or create conversation for a contact
 */
async function getOrCreateConversation(deviceId, userId, contactJid, contactName, contactPhone) {
  try {
    // Try to find existing conversation
    const { data: existing, error: fetchError } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .eq('device_id', deviceId)
      .eq('contact_jid', contactJid)
      .single();

    if (existing) {
      return existing;
    }

    // Create new conversation
    const { data: newConversation, error: insertError } = await supabase
      .from('whatsapp_conversations')
      .insert({
        user_id: userId,
        device_id: deviceId,
        contact_jid: contactJid,
        contact_name: contactName || contactPhone,
        contact_phone: contactPhone
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating conversation:', insertError);
      return null;
    }

    console.log(`✨ Created new conversation for ${contactPhone}`);
    return newConversation;

  } catch (error) {
    console.error('Error in getOrCreateConversation:', error);
    return null;
  }
}

/**
 * Update message status (delivered, read)
 */
async function updateMessageStatus(messageId, status) {
  try {
    const { error } = await supabase
      .from('whatsapp_messages')
      .update({ status: status, updated_at: new Date().toISOString() })
      .eq('message_id', messageId);

    if (error) {
      console.error('Error updating message status:', error);
    } else {
      console.log(`✅ Updated message ${messageId} status to ${status}`);
    }
  } catch (error) {
    console.error('Error in updateMessageStatus:', error);
  }
}

/**
 * Mark conversation as read
 */
async function markConversationAsRead(conversationId) {
  try {
    const { error } = await supabase
      .rpc('mark_conversation_as_read', { p_conversation_id: conversationId });

    if (error) {
      console.error('Error marking conversation as read:', error);
    } else {
      console.log(`✅ Marked conversation ${conversationId} as read`);
    }
  } catch (error) {
    console.error('Error in markConversationAsRead:', error);
  }
}

/**
 * Setup message listeners for CRM
 */
function setupCRMMessageListeners(sock, deviceId, userId) {
  // Listen for incoming messages
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    for (const msg of messages) {
      if (type === 'notify' || type === 'append') {
        await saveMessageToDatabase(deviceId, userId, {
          key: msg.key,
          message: msg.message,
          pushName: msg.pushName,
          fromMe: msg.key.fromMe
        });
      }
    }
  });

  // Listen for message status updates
  sock.ev.on('messages.update', async (updates) => {
    for (const update of updates) {
      if (update.update.status) {
        const status = update.update.status === 3 ? 'read' :
                      update.update.status === 2 ? 'delivered' :
                      update.update.status === 1 ? 'sent' : 'pending';

        await updateMessageStatus(update.key.id, status);
      }
    }
  });

  console.log('📱 CRM message listeners configured for device:', deviceId);
}

module.exports = {
  saveMessageToDatabase,
  getOrCreateConversation,
  updateMessageStatus,
  markConversationAsRead,
  setupCRMMessageListeners
};
