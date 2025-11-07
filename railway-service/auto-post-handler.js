const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Fixed env var name
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Process message variables - replace dynamic placeholders
 */
function processMessageVariables(message, groupName = '') {
  const now = new Date();

  // Indonesian day names
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const dayName = dayNames[now.getDay()];

  // Format time (HH:MM)
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  // Format date (DD/MM/YYYY)
  const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });

  let processed = message;

  // Replace {{nama}} or [[NAME]] with group name
  processed = processed.replace(/\{\{nama\}\}/gi, groupName);
  processed = processed.replace(/\[\[NAME\]\]/gi, groupName);

  // Replace time variables
  processed = processed.replace(/\{\{waktu\}\}/gi, timeStr);
  processed = processed.replace(/\{\{tanggal\}\}/gi, dateStr);
  processed = processed.replace(/\{\{hari\}\}/gi, dayName);

  // Handle random choices (text1|text2|text3)
  const randomPattern = /\(([^)]+)\)/g;
  processed = processed.replace(randomPattern, (match, group) => {
    const choices = group.split('|').map(s => s.trim());
    return choices[Math.floor(Math.random() * choices.length)];
  });

  return processed;
}

/**
 * Check and process auto-post schedules
 */
async function checkAutoPostSchedules(activeSockets) {
  try {
    const now = new Date();

    // Fetch active schedules that are due for sending
    const { data: schedules, error } = await supabase
      .from('auto_post_schedules')
      .select('*')
      .eq('is_active', true)
      .lte('next_send_at', now.toISOString());

    if (error) {
      console.error('Error fetching auto-post schedules:', error);
      return;
    }

    if (!schedules || schedules.length === 0) {
      return; // No schedules due
    }

    console.log(`📅 Found ${schedules.length} auto-post schedule(s) to process`);

    // Filter schedules that have connected devices
    for (const schedule of schedules) {
      // Check if device socket exists and is connected
      const socket = activeSockets.get(schedule.device_id);
      if (socket && socket.user) {
        await processAutoPostSchedule(schedule, activeSockets);
      } else {
        console.log(`⏭️ Skipping schedule "${schedule.name}" - device not connected`);
      }
    }

  } catch (error) {
    console.error('Error in checkAutoPostSchedules:', error);
  }
}

/**
 * Process a single auto-post schedule
 */
async function processAutoPostSchedule(schedule, activeSockets) {
  try {
    console.log(`📤 Processing auto-post: ${schedule.name} (${schedule.id})`);

    const socket = activeSockets.get(schedule.device_id);

    if (!socket) {
      console.error(`❌ Socket not found for device: ${schedule.device_id}`);
      return;
    }

    // Fetch target groups
    const { data: groups, error: groupsError } = await supabase
      .from('contacts')
      .select('*')
      .in('id', schedule.target_groups)
      .eq('is_group', true);

    if (groupsError || !groups || groups.length === 0) {
      console.error('Error fetching groups or no groups found:', groupsError);
      return;
    }

    console.log(`📨 Sending to ${groups.length} group(s)...`);

    let successCount = 0;
    let failCount = 0;

    // Send to each group
    for (const group of groups) {
      try {
        // Process message with variables
        const processedMessage = processMessageVariables(
          schedule.message,
          group.name || group.phone_number
        );

        // Format group JID (group WhatsApp ID)
        const groupJid = group.phone_number.includes('@g.us')
          ? group.phone_number
          : `${group.phone_number}@g.us`;

        // Prepare message content
        let messageContent;

        if (schedule.media_url) {
          // Send with media
          try {
            const response = await fetch(schedule.media_url);
            const buffer = await response.arrayBuffer();
            const mediaBuffer = Buffer.from(buffer);

            // Determine media type from URL
            const ext = schedule.media_url.toLowerCase().split('.').pop().split('?')[0];

            if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
              messageContent = {
                image: mediaBuffer,
                caption: processedMessage
              };
            } else if (['mp4', 'mov', 'avi'].includes(ext)) {
              messageContent = {
                video: mediaBuffer,
                caption: processedMessage
              };
            } else {
              // Fallback to text if media type unknown
              messageContent = { text: processedMessage };
            }
          } catch (mediaError) {
            console.error(`⚠️ Failed to load media, sending text only:`, mediaError.message);
            messageContent = { text: processedMessage };
          }
        } else {
          // Text only
          messageContent = { text: processedMessage };
        }

        // Send message via Baileys
        await socket.sendMessage(groupJid, messageContent);

        // Log success
        await supabase.from('auto_post_logs').insert({
          schedule_id: schedule.id,
          group_id: group.id,
          group_name: group.name || group.phone_number,
          message_sent: processedMessage,
          status: 'sent',
          sent_at: new Date().toISOString()
        });

        successCount++;
        console.log(`✅ Sent to group: ${group.name || group.phone_number}`);

        // Calculate delay (with random variation if enabled)
        let delay = 2000; // Base delay 2 seconds

        if (schedule.random_delay && schedule.delay_minutes) {
          // Add random variation in milliseconds
          const randomMs = Math.random() * (schedule.delay_minutes * 60 * 1000);
          delay += randomMs;
        }

        await new Promise(resolve => setTimeout(resolve, delay));

      } catch (error) {
        failCount++;
        console.error(`❌ Failed to send to group ${group.name}:`, error.message);

        // Log failure
        await supabase.from('auto_post_logs').insert({
          schedule_id: schedule.id,
          group_id: group.id,
          group_name: group.name || group.phone_number,
          message_sent: schedule.message,
          status: 'failed',
          error_message: error.message,
          sent_at: new Date().toISOString()
        });
      }
    }

    // Update schedule's last_sent_at and statistics (trigger will auto-calculate next_send_at)
    const currentSendCount = schedule.send_count || 0;
    const currentFailCount = schedule.failed_count || 0;

    await supabase
      .from('auto_post_schedules')
      .update({
        last_sent_at: new Date().toISOString(),
        send_count: currentSendCount + successCount,
        failed_count: currentFailCount + failCount
      })
      .eq('id', schedule.id);

    console.log(`✨ Auto-post completed: ${successCount} success, ${failCount} failed`);

  } catch (error) {
    console.error('Error processing auto-post schedule:', error);
  }
}

/**
 * Get auto-post statistics for a user
 */
async function getAutoPostStats(userId) {
  try {
    // Get total schedules
    const { count: totalSchedules } = await supabase
      .from('auto_post_schedules')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Get active schedules
    const { count: activeSchedules } = await supabase
      .from('auto_post_schedules')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_active', true);

    // Get today's sent count
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count: todaySent } = await supabase
      .from('auto_post_logs')
      .select('*, auto_post_schedules!inner(user_id)', { count: 'exact', head: true })
      .eq('auto_post_schedules.user_id', userId)
      .eq('status', 'sent')
      .gte('sent_at', today.toISOString());

    return {
      totalSchedules: totalSchedules || 0,
      activeSchedules: activeSchedules || 0,
      todaySent: todaySent || 0
    };
  } catch (error) {
    console.error('Error getting auto-post stats:', error);
    return {
      totalSchedules: 0,
      activeSchedules: 0,
      todaySent: 0
    };
  }
}

module.exports = {
  checkAutoPostSchedules,
  processAutoPostSchedule,
  getAutoPostStats,
  processMessageVariables
};
