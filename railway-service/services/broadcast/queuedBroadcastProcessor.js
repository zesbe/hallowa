/**
 * Queued Broadcast Processor
 * Replaces polling-based broadcast processing with BullMQ queue system
 * This module adds broadcasts to queue instead of processing them directly
 */

const { supabase } = require('../../config/supabase');
const { addBroadcastJob } = require('../../jobs/broadcastQueue');

// Track broadcasts already added to queue to prevent duplicates
const queuedBroadcasts = new Set();

/**
 * Check for pending broadcasts and add them to BullMQ queue
 * This function replaces the old polling-based processBroadcasts
 */
async function checkAndQueueBroadcasts() {
  try {
    // Get broadcasts with status "processing" that haven't been queued yet
    const { data: broadcasts, error } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('status', 'processing')
      .limit(10);

    if (error) {
      console.error('❌ Error fetching broadcasts:', error);
      return;
    }

    if (!broadcasts || broadcasts.length === 0) {
      return;
    }

    console.log(`📥 Found ${broadcasts.length} broadcast(s) to queue`);

    for (const broadcast of broadcasts) {
      // Skip if already queued
      if (queuedBroadcasts.has(broadcast.id)) {
        continue;
      }

      try {
        // Add to BullMQ queue
        await addBroadcastJob(broadcast);

        // Mark as queued
        queuedBroadcasts.add(broadcast.id);

        console.log(`✅ Broadcast ${broadcast.name} added to queue`);

        // Remove from tracking set after 5 minutes
        // (in case job completes and same broadcast is requeued)
        setTimeout(() => {
          queuedBroadcasts.delete(broadcast.id);
        }, 5 * 60 * 1000);

      } catch (error) {
        console.error(`❌ Error queueing broadcast ${broadcast.id}:`, error);

        // If queue is not available, mark broadcast as failed
        if (error.message.includes('queue not available')) {
          await supabase
            .from('broadcasts')
            .update({
              status: 'failed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', broadcast.id);

          console.log(`📝 Broadcast ${broadcast.id} marked as failed (queue unavailable)`);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error in checkAndQueueBroadcasts:', error);
  }
}

/**
 * Legacy function kept for backward compatibility
 * Now it just queues broadcasts instead of processing them
 * @deprecated Use checkAndQueueBroadcasts instead
 */
async function processBroadcasts(activeSockets, connectWhatsApp) {
  await checkAndQueueBroadcasts();
}

module.exports = {
  checkAndQueueBroadcasts,
  processBroadcasts, // Legacy export
};
