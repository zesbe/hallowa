/**
 * Auth State Management
 * Handles WhatsApp authentication state persistence in Supabase
 */

const { initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');

/**
 * Create auth state handler that persists to Supabase
 * @param {string} deviceId - Device ID
 * @param {Object} supabase - Supabase client
 * @returns {Promise<Object>} Auth state and save function
 */
async function useSupabaseAuthState(deviceId, supabase) {
  let creds, keys;

  try {
    console.log(`📦 [Auth] Loading session for device: ${deviceId}`);

    // Load from Supabase
    const { data } = await supabase
      .from('devices')
      .select('session_data')
      .eq('id', deviceId)
      .maybeSingle();

    const stored = data?.session_data || {};
    creds = stored.creds ? JSON.parse(JSON.stringify(stored.creds), BufferJSON.reviver) : initAuthCreds();
    keys = stored.keys ? JSON.parse(JSON.stringify(stored.keys), BufferJSON.reviver) : {};

    if (stored.creds) {
      console.log(`✅ [Auth] Session loaded successfully`);
    } else {
      console.log(`⚠️ [Auth] No existing session, creating new`);
    }
  } catch (e) {
    console.error('❌ [Auth] Failed loading session:', e);
    creds = initAuthCreds();
    keys = {};
  }

  const persist = async () => {
    const sessionData = {
      creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)),
      keys: JSON.parse(JSON.stringify(keys, BufferJSON.replacer)),
      saved_at: new Date().toISOString(),
    };

    try {
      // Save to Supabase
      const { error } = await supabase
        .from('devices')
        .update({ session_data: sessionData })
        .eq('id', deviceId);

      if (error) {
        console.error('❌ [Auth] Supabase save error:', error);
      } else {
        console.log(`💾 [Auth] Session saved successfully`);
      }
    } catch (err) {
      console.error('❌ [Auth] Error persisting session:', err);
    }
  };

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = keys[type] || {};
          const result = {};
          for (const id of ids) result[id] = data[id] || null;
          return result;
        },
        set: async (data) => {
          for (const type of Object.keys(data)) {
            keys[type] = keys[type] || {};
            Object.assign(keys[type], data[type]);
          }
          await persist();
        },
      },
    },
    saveCreds: persist,
  };
}

module.exports = { useSupabaseAuthState };
