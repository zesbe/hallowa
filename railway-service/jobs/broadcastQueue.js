/**
 * BullMQ Broadcast Queue
 * High-performance job queue for WhatsApp broadcast messages
 * Features: Automatic retry, priority queue, rate limiting, job persistence
 */

const { Queue, Worker, QueueEvents } = require('bullmq');
const { ioredisConnection } = require('../config/redis');
const { supabase } = require('../config/supabase');
const { validatePhoneNumber, validateMessage, validateMediaUrl } = require('../auth-utils');
const { getMediaType, downloadMedia, prepareMediaMessage } = require('../utils/mediaHelpers');
const { getWhatsAppName, getContactInfo, processMessageVariables } = require('../services/broadcast/messageVariables');

// Queue configuration
const QUEUE_NAME = 'broadcasts';
const CONCURRENCY = 5; // Process 5 jobs in parallel

/**
 * Create Broadcast Queue
 */
function createBroadcastQueue() {
  if (!ioredisConnection) {
    console.warn('⚠️  BullMQ disabled - ioredis connection not available');
    return null;
  }

  const queue = new Queue(QUEUE_NAME, {
    connection: ioredisConnection,
    defaultJobOptions: {
      attempts: 3, // Retry 3 times on failure
      backoff: {
        type: 'exponential',
        delay: 5000, // Start with 5s, then 10s, 20s
      },
      removeOnComplete: {
        age: 24 * 3600, // Keep completed jobs for 24 hours
        count: 100, // Keep last 100 completed jobs
      },
      removeOnFail: {
        age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        count: 500, // Keep last 500 failed jobs
      },
    },
  });

  queue.on('error', (err) => {
    console.error('❌ Broadcast queue error:', err);
  });

  console.log('✅ Broadcast queue created');
  return queue;
}

/**
 * Add broadcast job to queue
 * @param {Object} broadcast - Broadcast data from database
 * @returns {Promise<Job>} BullMQ job instance
 */
async function addBroadcastJob(broadcast) {
  const queue = createBroadcastQueue();
  if (!queue) {
    throw new Error('Broadcast queue not available - check Redis connection');
  }

  const job = await queue.add(
    'send-broadcast',
    {
      broadcastId: broadcast.id,
      userId: broadcast.user_id,
      deviceId: broadcast.device_id,
      name: broadcast.name,
      message: broadcast.message,
      mediaUrl: broadcast.media_url,
      targetContacts: broadcast.target_contacts,
      delayType: broadcast.delay_type || 'auto',
      delaySeconds: broadcast.delay_seconds || 5,
      randomizeDelay: broadcast.randomize_delay !== false,
      batchSize: broadcast.batch_size || 20,
      pauseBetweenBatches: (broadcast.pause_between_batches || 60) * 1000,
    },
    {
      jobId: `broadcast-${broadcast.id}`, // Prevent duplicate jobs
      priority: broadcast.priority || 10, // Lower number = higher priority
    }
  );

  console.log(`📥 Broadcast job added to queue: ${broadcast.name} (Job ID: ${job.id})`);
  return job;
}

/**
 * Calculate adaptive delay based on contact count and settings
 */
function getAdaptiveDelay(delayType, baseDelay, contactCount) {
  if (delayType === 'auto') {
    if (contactCount <= 20) return 3000;
    if (contactCount <= 50) return 5000;
    if (contactCount <= 100) return 8000;
    return 12000;
  } else if (delayType === 'adaptive') {
    return Math.max(3000, baseDelay * 1000);
  } else {
    return Math.max(2000, baseDelay * 1000);
  }
}

/**
 * Calculate actual delay with randomization
 */
function calculateDelay(baseDelayMs, randomize) {
  if (!randomize) return baseDelayMs;
  const variation = 0.3;
  const minDelay = baseDelayMs * (1 - variation);
  const maxDelay = baseDelayMs * (1 + variation);
  return Math.floor(Math.random() * (maxDelay - minDelay) + minDelay);
}

/**
 * Send a single broadcast message to a contact
 */
async function sendBroadcastMessage(sock, broadcast, contact, phoneNumber) {
  try {
    if (!validatePhoneNumber(phoneNumber)) {
      console.error(`❌ Invalid phone number format: ${phoneNumber}`);
      return false;
    }

    const contactInfo = await getContactInfo(phoneNumber, broadcast.userId, contact);
    const whatsappName = await getWhatsAppName(sock, phoneNumber);
    const processedMessage = processMessageVariables(
      broadcast.message,
      contactInfo,
      whatsappName,
      phoneNumber
    );

    if (processedMessage) {
      validateMessage(processedMessage);
    }

    if (broadcast.mediaUrl && !validateMediaUrl(broadcast.mediaUrl)) {
      console.error(`❌ Invalid media URL: ${broadcast.mediaUrl}`);
      return false;
    }

    const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
    let messageContent;

    if (broadcast.mediaUrl) {
      try {
        const mediaType = getMediaType(broadcast.mediaUrl);
        const mediaBuffer = await downloadMedia(broadcast.mediaUrl, 3);
        messageContent = prepareMediaMessage(mediaBuffer, mediaType, processedMessage);
      } catch (mediaError) {
        console.error(`❌ Error loading media:`, mediaError.message);
        messageContent = { text: broadcast.message };
      }
    } else {
      messageContent = { text: processedMessage };
    }

    await sock.sendMessage(jid, messageContent);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send to ${phoneNumber}:`, error.message);
    return false;
  }
}

/**
 * Process broadcast job
 * @param {Job} job - BullMQ job
 * @param {Map} activeSockets - Map of active WhatsApp sockets
 */
async function processBroadcastJob(job, activeSockets) {
  const {
    broadcastId,
    userId,
    deviceId,
    name,
    message,
    mediaUrl,
    targetContacts,
    delayType,
    delaySeconds,
    randomizeDelay,
    batchSize,
    pauseBetweenBatches,
  } = job.data;

  console.log(`📤 Processing broadcast job: ${name} (${targetContacts.length} contacts)`);

  // Get WhatsApp socket
  const sock = activeSockets.get(deviceId);
  if (!sock) {
    throw new Error(`Device ${deviceId} not connected - cannot send broadcast`);
  }

  let sentCount = 0;
  let failedCount = 0;

  const adaptiveDelayMs = getAdaptiveDelay(delayType, delaySeconds, targetContacts.length);
  console.log(`📊 Delay settings: type=${delayType}, base=${delaySeconds}s, adaptive=${adaptiveDelayMs}ms`);

  const broadcast = { userId, message, mediaUrl };

  // Process each contact
  for (let i = 0; i < targetContacts.length; i++) {
    const contact = targetContacts[i];
    const phoneNumber = typeof contact === 'object' ? contact.phone_number : contact;

    if (!phoneNumber) {
      console.error('❌ Invalid contact:', contact);
      failedCount++;
      continue;
    }

    const success = await sendBroadcastMessage(sock, broadcast, contact, phoneNumber);

    if (success) {
      sentCount++;
      console.log(`✅ Sent to ${phoneNumber} (${i + 1}/${targetContacts.length})`);
    } else {
      failedCount++;
    }

    // Update job progress
    const progress = Math.floor(((i + 1) / targetContacts.length) * 100);
    await job.updateProgress(progress);

    // Batch pause logic
    if ((i + 1) % batchSize === 0 && i < targetContacts.length - 1) {
      console.log(`⏸️  Batch complete (${i + 1} messages). Pausing for ${pauseBetweenBatches / 1000}s...`);

      // Update progress during pause
      await supabase
        .from('broadcasts')
        .update({
          sent_count: sentCount,
          failed_count: failedCount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', broadcastId);

      await new Promise(resolve => setTimeout(resolve, pauseBetweenBatches));
    } else if (i < targetContacts.length - 1) {
      const delayMs = calculateDelay(adaptiveDelayMs, randomizeDelay);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    } else if (!success) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Update broadcast status in database
  await supabase
    .from('broadcasts')
    .update({
      status: 'completed',
      sent_count: sentCount,
      failed_count: failedCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', broadcastId);

  console.log(`✅ Broadcast completed: ${sentCount} sent, ${failedCount} failed`);

  return {
    success: true,
    sentCount,
    failedCount,
    totalContacts: targetContacts.length,
  };
}

/**
 * Create Broadcast Worker
 * Automatically picks up jobs from the queue and processes them
 * @param {Map} activeSockets - Map of active WhatsApp sockets
 */
function createBroadcastWorker(activeSockets) {
  if (!ioredisConnection) {
    console.warn('⚠️  BullMQ worker disabled - ioredis connection not available');
    return null;
  }

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      return await processBroadcastJob(job, activeSockets);
    },
    {
      connection: ioredisConnection,
      concurrency: CONCURRENCY,
      limiter: {
        max: 10, // Max 10 jobs per duration
        duration: 1000, // 1 second
      },
    }
  );

  // Worker event listeners
  worker.on('completed', (job, result) => {
    console.log(`✅ Job ${job.id} completed:`, result);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} failed:`, err.message);

    // Update broadcast status to failed in database
    if (job?.data?.broadcastId) {
      supabase
        .from('broadcasts')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.data.broadcastId)
        .then(() => {
          console.log(`📝 Broadcast ${job.data.broadcastId} marked as failed in database`);
        });
    }
  });

  worker.on('error', (err) => {
    console.error('❌ Worker error:', err);
  });

  worker.on('stalled', (jobId) => {
    console.warn(`⚠️  Job ${jobId} stalled - will be retried`);
  });

  console.log(`✅ Broadcast worker created (concurrency: ${CONCURRENCY})`);
  return worker;
}

/**
 * Create Queue Events listener
 * Monitor queue health and job lifecycle
 */
function createQueueEvents() {
  if (!ioredisConnection) {
    return null;
  }

  const queueEvents = new QueueEvents(QUEUE_NAME, {
    connection: ioredisConnection,
  });

  queueEvents.on('waiting', ({ jobId }) => {
    console.log(`⏳ Job ${jobId} is waiting...`);
  });

  queueEvents.on('active', ({ jobId }) => {
    console.log(`🔄 Job ${jobId} is now active`);
  });

  queueEvents.on('progress', ({ jobId, data }) => {
    console.log(`📊 Job ${jobId} progress: ${data}%`);
  });

  console.log('✅ Queue events listener created');
  return queueEvents;
}

module.exports = {
  createBroadcastQueue,
  createBroadcastWorker,
  createQueueEvents,
  addBroadcastJob,
};
