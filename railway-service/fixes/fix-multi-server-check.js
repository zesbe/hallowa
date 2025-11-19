/**
 * Fix: Temporarily disable multi-server check for QR generation
 *
 * This is an alternative fix if you want to bypass multi-server checks
 * to ensure QR codes are generated regardless of server assignment.
 *
 * IMPORTANT: This should be used as a temporary workaround only.
 * The proper fix is to reset assigned_server_id in the database.
 */

const { supabase } = require('../config/supabase');
const { logger } = require('../logger');

/**
 * Reset assigned_server_id for all connecting devices
 * This allows them to be auto-assigned to active servers
 */
async function resetConnectingDevices() {
  try {
    console.log('🔧 Resetting assigned_server_id for connecting devices...');

    const { data, error } = await supabase
      .from('devices')
      .update({
        assigned_server_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('status', 'connecting')
      .not('assigned_server_id', 'is', null)
      .select('id, device_name, assigned_server_id');

    if (error) {
      console.error('❌ Error resetting devices:', error);
      return false;
    }

    console.log(`✅ Reset ${data?.length || 0} connecting devices`);
    if (data && data.length > 0) {
      console.log('Affected devices:', data.map(d => ({
        id: d.id,
        name: d.device_name
      })));
    }

    return true;
  } catch (error) {
    console.error('❌ Error in resetConnectingDevices:', error);
    return false;
  }
}

/**
 * Reset specific device by ID
 * @param {string} deviceId - Device ID to reset
 */
async function resetSpecificDevice(deviceId) {
  try {
    console.log(`🔧 Resetting device ${deviceId}...`);

    const { data, error } = await supabase
      .from('devices')
      .update({
        assigned_server_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', deviceId)
      .select('id, device_name, status, assigned_server_id');

    if (error) {
      console.error('❌ Error resetting device:', error);
      return false;
    }

    if (!data || data.length === 0) {
      console.log('⚠️ Device not found');
      return false;
    }

    console.log('✅ Device reset successfully:', data[0]);
    return true;
  } catch (error) {
    console.error('❌ Error in resetSpecificDevice:', error);
    return false;
  }
}

/**
 * Reset devices assigned to inactive servers
 */
async function resetDevicesOnInactiveServers() {
  try {
    console.log('🔧 Finding inactive servers...');

    // Find inactive servers (not healthy or no ping in last 5 minutes)
    const { data: inactiveServers, error: serverError } = await supabase
      .from('backend_servers')
      .select('id, server_name')
      .or('is_healthy.eq.false,is_active.eq.false,last_health_ping.lt.' +
          new Date(Date.now() - 5 * 60 * 1000).toISOString());

    if (serverError) {
      console.error('❌ Error fetching inactive servers:', serverError);
      return false;
    }

    if (!inactiveServers || inactiveServers.length === 0) {
      console.log('✅ No inactive servers found');
      return true;
    }

    console.log(`Found ${inactiveServers.length} inactive servers:`,
      inactiveServers.map(s => s.server_name));

    // Reset devices on these servers
    const serverIds = inactiveServers.map(s => s.id);

    const { data: resetDevices, error: resetError } = await supabase
      .from('devices')
      .update({
        assigned_server_id: null,
        updated_at: new Date().toISOString()
      })
      .in('assigned_server_id', serverIds)
      .eq('status', 'connecting')
      .select('id, device_name');

    if (resetError) {
      console.error('❌ Error resetting devices:', resetError);
      return false;
    }

    console.log(`✅ Reset ${resetDevices?.length || 0} devices from inactive servers`);
    return true;
  } catch (error) {
    console.error('❌ Error in resetDevicesOnInactiveServers:', error);
    return false;
  }
}

// CLI usage
if (require.main === module) {
  const command = process.argv[2];
  const arg = process.argv[3];

  switch (command) {
    case 'reset-all':
      resetConnectingDevices().then(success => {
        process.exit(success ? 0 : 1);
      });
      break;

    case 'reset-device':
      if (!arg) {
        console.error('❌ Usage: node fix-multi-server-check.js reset-device <device-id>');
        process.exit(1);
      }
      resetSpecificDevice(arg).then(success => {
        process.exit(success ? 0 : 1);
      });
      break;

    case 'reset-inactive':
      resetDevicesOnInactiveServers().then(success => {
        process.exit(success ? 0 : 1);
      });
      break;

    default:
      console.log('Usage:');
      console.log('  node fix-multi-server-check.js reset-all           - Reset all connecting devices');
      console.log('  node fix-multi-server-check.js reset-device <id>   - Reset specific device');
      console.log('  node fix-multi-server-check.js reset-inactive      - Reset devices on inactive servers');
      process.exit(1);
  }
}

module.exports = {
  resetConnectingDevices,
  resetSpecificDevice,
  resetDevicesOnInactiveServers
};
