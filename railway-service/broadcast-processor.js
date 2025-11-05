/**
 * Broadcast Processor
 * Handles broadcast message sending with personalization and rate limiting
 */

class BroadcastProcessor {
  constructor(supabase, activeSockets) {
    this.supabase = supabase;
    this.activeSockets = activeSockets;
    this.processingBroadcasts = new Set();
  }

  /**
   * Process all pending broadcasts
   */
  async processBroadcasts() {
    try {
      // Get broadcasts with status "processing"
      const { data: broadcasts, error } = await this.supabase
        .from('broadcasts')
        .select('*')
        .eq('status', 'processing')
        .limit(5);

      if (error) {
        console.error('❌ [Broadcast] Error fetching broadcasts:', error);
        return;
      }

      if (!broadcasts || broadcasts.length === 0) {
        return;
      }

      console.log(`📤 [Broadcast] Processing ${broadcasts.length} broadcast(s)`);

      for (const broadcast of broadcasts) {
        // Skip if already being processed (prevent duplicates)
        if (this.processingBroadcasts.has(broadcast.id)) {
          console.log(`⏭️ [Broadcast] Skipping ${broadcast.id} - already processing`);
          continue;
        }

        // Mark as processing
        this.processingBroadcasts.add(broadcast.id);

        try {
          await this.processSingleBroadcast(broadcast);
        } catch (broadcastError) {
          console.error(`❌ [Broadcast] Error processing ${broadcast.id}:`, broadcastError);
          await this.markBroadcastFailed(broadcast.id);
        } finally {
          // Remove from processing set when done
          this.processingBroadcasts.delete(broadcast.id);
        }
      }
    } catch (error) {
      console.error('❌ [Broadcast] Error in processBroadcasts:', error);
    }
  }

  /**
   * Process a single broadcast
   */
  async processSingleBroadcast(broadcast) {
    // Get the socket for this device
    const sock = this.activeSockets.get(broadcast.device_id);

    if (!sock) {
      console.error(`❌ [Broadcast] No active socket for device: ${broadcast.device_id}`);
      await this.handleMissingSocket(broadcast);
      return;
    }

    console.log(`📤 [Broadcast] Sending: ${broadcast.name}`);

    let sentCount = 0;
    let failedCount = 0;

    // Get delay settings
    const delayConfig = this.getDelayConfig(broadcast);
    const adaptiveDelayMs = this.getAdaptiveDelay(delayConfig.delayType, delayConfig.baseDelay, broadcast.target_contacts.length);

    console.log(`📊 [Broadcast] Delay settings: type=${delayConfig.delayType}, base=${delayConfig.baseDelay}s, adaptive=${adaptiveDelayMs}ms, randomize=${delayConfig.randomizeDelay}`);

    // Send to each target contact
    for (let i = 0; i < broadcast.target_contacts.length; i++) {
      const contact = broadcast.target_contacts[i];

      try {
        const result = await this.sendMessageToContact(sock, contact, broadcast, i);
        if (result.success) {
          sentCount++;
        } else {
          failedCount++;
        }

        // Handle batching and delays
        if ((i + 1) % delayConfig.batchSize === 0 && i < broadcast.target_contacts.length - 1) {
          await this.handleBatchPause(broadcast, sentCount, failedCount, delayConfig.pauseBetweenBatches);
        } else if (i < broadcast.target_contacts.length - 1) {
          const delayMs = this.calculateDelay(adaptiveDelayMs, delayConfig.randomizeDelay);
          console.log(`⏱️ [Broadcast] Waiting ${delayMs}ms before next message...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }

      } catch (sendError) {
        failedCount++;
        console.error(`❌ [Broadcast] Failed to send to ${contact}:`, sendError.message);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Update broadcast with results
    await this.markBroadcastCompleted(broadcast.id, sentCount, failedCount);
    console.log(`✅ [Broadcast] Completed: ${sentCount} sent, ${failedCount} failed`);
  }

  /**
   * Send message to a single contact
   */
  async sendMessageToContact(sock, contact, broadcast, index) {
    const phoneNumber = typeof contact === 'object' ? contact.phone_number : contact;

    if (!phoneNumber) {
      console.error('❌ [Broadcast] Invalid contact:', contact);
      return { success: false };
    }

    // Get contact info from database for personalization
    const { data: contactData } = await this.supabase
      .from('contacts')
      .select('name, var1, var2, var3')
      .eq('phone_number', phoneNumber)
      .eq('user_id', broadcast.user_id)
      .maybeSingle();

    const contactInfo = contactData || {
      name: (typeof contact === 'object' ? contact.name : null) || phoneNumber
    };

    // Get WhatsApp profile name
    const whatsappName = await this.getWhatsAppName(sock, phoneNumber);

    // Process message with personalization
    const processedMessage = this.personalizeMessage(broadcast.message, contactInfo, whatsappName, phoneNumber);

    // Format phone number
    const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;

    // Prepare message content
    const messageContent = await this.prepareMessageContent(broadcast, processedMessage);

    // Send message
    await sock.sendMessage(jid, messageContent);

    console.log(`✅ [Broadcast] Sent to ${phoneNumber} (${index + 1}/${broadcast.target_contacts.length})`);
    return { success: true };
  }

  /**
   * Get WhatsApp profile name
   */
  async getWhatsAppName(sock, phoneNumber) {
    let whatsappName = phoneNumber;

    try {
      const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;

      // Try to get from Baileys contact store
      if (sock.store?.contacts && sock.store.contacts[jid]) {
        const waContact = sock.store.contacts[jid];
        whatsappName = waContact.notify || waContact.name || waContact.verifiedName || whatsappName;
        console.log(`✓ [Broadcast] Got WhatsApp name from store: ${whatsappName}`);
      } else {
        // Check if number exists on WhatsApp
        const [result] = await sock.onWhatsApp(jid);
        if (result && result.exists) {
          whatsappName = result.notify || phoneNumber;
          console.log(`✓ [Broadcast] WhatsApp name: ${whatsappName}`);
        }
      }
    } catch (waError) {
      console.log(`⚠️ [Broadcast] Could not fetch WhatsApp name for ${phoneNumber}`);
    }

    return whatsappName;
  }

  /**
   * Personalize message with variables
   */
  personalizeMessage(message, contactInfo, whatsappName, phoneNumber) {
    let processed = message;

    // Process random text selection FIRST (option1|option2|option3)
    const randomPattern = /\(([^)]+)\)/g;
    processed = processed.replace(randomPattern, (match, options) => {
      const choices = options.split('|').map(s => s.trim());
      return choices[Math.floor(Math.random() * choices.length)];
    });

    // Replace [[NAME]] with WhatsApp profile name
    processed = processed.replace(/\[\[NAME\]\]/g, whatsappName);

    // Replace {{NAME}} with contact name from database
    processed = processed.replace(/\{\{NAME\}\}/g, contactInfo.name || phoneNumber);

    // Replace {nama} and {{nama}} (case insensitive)
    processed = processed.replace(/\{\{?nama\}\}?/gi, contactInfo.name || phoneNumber);

    // Replace {nomor} with phone number
    processed = processed.replace(/\{nomor\}/g, phoneNumber);

    // Replace custom variables {var1}, {var2}, {var3}
    if (contactInfo.var1) {
      processed = processed.replace(/\{var1\}/g, contactInfo.var1);
    }
    if (contactInfo.var2) {
      processed = processed.replace(/\{var2\}/g, contactInfo.var2);
    }
    if (contactInfo.var3) {
      processed = processed.replace(/\{var3\}/g, contactInfo.var3);
    }

    // Replace time/date variables
    const now = new Date();
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    processed = processed.replace(/\{\{?waktu\}\}?/g,
      now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    );

    processed = processed.replace(/\{\{?tanggal\}\}?/g,
      now.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
    );

    processed = processed.replace(/\{\{?hari\}\}?/g, days[now.getDay()]);

    return processed;
  }

  /**
   * Prepare message content (text or media)
   */
  async prepareMessageContent(broadcast, processedMessage) {
    if (!broadcast.media_url) {
      return { text: processedMessage };
    }

    // Send media message with retry logic
    let mediaLoaded = false;
    let retryCount = 0;
    const maxRetries = 3;

    while (!mediaLoaded && retryCount < maxRetries) {
      try {
        const mediaType = this.getMediaType(broadcast.media_url);
        console.log(`📥 [Broadcast] Downloading media (attempt ${retryCount + 1}/${maxRetries}): ${broadcast.media_url}`);

        const response = await fetch(broadcast.media_url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();

        if (buffer.byteLength === 0) {
          throw new Error('Downloaded file is empty (0 bytes)');
        }

        console.log(`✅ [Broadcast] Media downloaded: ${buffer.byteLength} bytes`);

        // Build message content based on media type
        if (mediaType === 'image') {
          return { image: Buffer.from(buffer), caption: processedMessage || '' };
        } else if (mediaType === 'video') {
          return { video: Buffer.from(buffer), caption: processedMessage || '' };
        } else if (mediaType === 'audio') {
          return { audio: Buffer.from(buffer), mimetype: 'audio/mp4' };
        } else if (mediaType === 'document') {
          return { document: Buffer.from(buffer), caption: processedMessage || '', mimetype: 'application/pdf' };
        }

        mediaLoaded = true;
      } catch (mediaError) {
        retryCount++;
        console.error(`❌ [Broadcast] Error loading media (attempt ${retryCount}/${maxRetries}):`, mediaError.message);

        if (retryCount >= maxRetries) {
          console.error('❌ [Broadcast] Max retries reached, sending text only');
          return { text: broadcast.message };
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }

    return { text: processedMessage };
  }

  /**
   * Get media type from URL
   */
  getMediaType(url) {
    const ext = url.toLowerCase().split('.').pop().split('?')[0];

    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      return 'image';
    } else if (['mp4', 'mov', 'avi'].includes(ext)) {
      return 'video';
    } else if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
      return 'audio';
    } else if (['pdf', 'doc', 'docx'].includes(ext)) {
      return 'document';
    }

    return 'document';
  }

  /**
   * Get delay configuration from broadcast
   */
  getDelayConfig(broadcast) {
    return {
      delayType: broadcast.delay_type || 'auto',
      baseDelay: broadcast.delay_seconds || 5,
      randomizeDelay: broadcast.randomize_delay !== false,
      batchSize: broadcast.batch_size || 20,
      pauseBetweenBatches: (broadcast.pause_between_batches || 60) * 1000
    };
  }

  /**
   * Calculate adaptive delay based on contact count
   */
  getAdaptiveDelay(delayType, baseDelay, contactCount) {
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
   * Calculate delay with randomization
   */
  calculateDelay(baseDelayMs, randomize) {
    if (!randomize) return baseDelayMs;

    // Add random variation ±30%
    const variation = 0.3;
    const minDelay = baseDelayMs * (1 - variation);
    const maxDelay = baseDelayMs * (1 + variation);
    return Math.floor(Math.random() * (maxDelay - minDelay) + minDelay);
  }

  /**
   * Handle batch pause
   */
  async handleBatchPause(broadcast, sentCount, failedCount, pauseDuration) {
    console.log(`⏸️ [Broadcast] Batch complete. Pausing for ${pauseDuration / 1000}s...`);

    // Update progress during pause
    await this.supabase
      .from('broadcasts')
      .update({
        sent_count: sentCount,
        failed_count: failedCount,
        updated_at: new Date().toISOString()
      })
      .eq('id', broadcast.id);

    await new Promise(resolve => setTimeout(resolve, pauseDuration));
  }

  /**
   * Handle missing socket (try to reconnect device)
   */
  async handleMissingSocket(broadcast) {
    console.error(`❌ [Broadcast] Scheduling device reconnect for: ${broadcast.device_id}`);

    const { data: device } = await this.supabase
      .from('devices')
      .select('*')
      .eq('id', broadcast.device_id)
      .maybeSingle();

    if (device && !this.activeSockets.has(device.id)) {
      try {
        await this.supabase.from('devices').update({ status: 'connecting' }).eq('id', device.id);
        // Note: actual reconnection will be handled by the polling mechanism in index.js
      } catch (e) {
        console.error('❌ [Broadcast] Error scheduling reconnect:', e);
      }
    }
  }

  /**
   * Mark broadcast as completed
   */
  async markBroadcastCompleted(broadcastId, sentCount, failedCount) {
    await this.supabase
      .from('broadcasts')
      .update({
        status: 'completed',
        sent_count: sentCount,
        failed_count: failedCount,
        updated_at: new Date().toISOString()
      })
      .eq('id', broadcastId);
  }

  /**
   * Mark broadcast as failed
   */
  async markBroadcastFailed(broadcastId) {
    await this.supabase
      .from('broadcasts')
      .update({
        status: 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('id', broadcastId);
  }

  /**
   * Check and trigger scheduled broadcasts
   */
  async checkScheduledBroadcasts() {
    try {
      const now = new Date().toISOString();

      // Get broadcasts that are scheduled and ready to send
      const { data: scheduledBroadcasts, error } = await this.supabase
        .from('broadcasts')
        .select('*')
        .eq('status', 'draft')
        .lte('scheduled_at', now)
        .not('scheduled_at', 'is', null);

      if (error) {
        console.error('❌ [Broadcast] Error fetching scheduled broadcasts:', error);
        return;
      }

      if (scheduledBroadcasts && scheduledBroadcasts.length > 0) {
        console.log(`⏰ [Broadcast] Found ${scheduledBroadcasts.length} scheduled broadcast(s) ready to send`);

        for (const broadcast of scheduledBroadcasts) {
          await this.supabase
            .from('broadcasts')
            .update({ status: 'processing' })
            .eq('id', broadcast.id);

          console.log(`📤 [Broadcast] Triggered scheduled broadcast: ${broadcast.name}`);
        }
      }
    } catch (error) {
      console.error('❌ [Broadcast] Error in checkScheduledBroadcasts:', error);
    }
  }
}

module.exports = BroadcastProcessor;
