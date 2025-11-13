import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { action, to, message, user_id } = await req.json();

    if (action !== 'send_message') {
      throw new Error('Invalid action');
    }

    if (!to || !message) {
      throw new Error('Missing required fields: to, message');
    }

    // Use authenticated user's ID if user_id not provided
    const targetUserId = user_id || user.id;

    console.log(`[Broadcast] User ${user.id} sending message to ${to}`);

    // Get user's first connected device with assigned server
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select(`
        id,
        assigned_server_id,
        backend_servers!devices_assigned_server_id_fkey (
          server_url,
          is_active,
          is_healthy
        )
      `)
      .eq('user_id', targetUserId)
      .eq('status', 'connected')
      .not('assigned_server_id', 'is', null)
      .limit(1)
      .single();

    if (deviceError || !device) {
      console.error('[Broadcast] No connected device found:', deviceError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No connected device found. Please connect a device first.'
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const server = Array.isArray(device.backend_servers) ? device.backend_servers[0] : device.backend_servers;
    if (!server || !server.is_active || !server.is_healthy) {
      console.error('[Broadcast] Server not available:', server);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Server not available. Please try again later.'
        }),
        { 
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const baileysUrl = server.server_url;
    const internalApiKey = Deno.env.get('INTERNAL_API_KEY');

    if (!internalApiKey) {
      console.error('[Broadcast] INTERNAL_API_KEY not configured');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Internal API key not configured' 
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`[Broadcast] Sending message via server: ${baileysUrl}`);

    // Send message via Baileys service with internal authentication
    try {
      const baileysResponse = await fetch(`${baileysUrl}/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${internalApiKey}`
        },
        body: JSON.stringify({
          deviceId: device.id,
          targetJid: to,
          messageType: 'text',
          message: message
        })
      });

      if (!baileysResponse.ok) {
        const errorText = await baileysResponse.text();
        console.error('Baileys service error:', errorText);
        throw new Error(`Baileys service error: ${baileysResponse.status}`);
      }

      const result = await baileysResponse.json();
      
      // Log message to history (skip if table doesn't exist)
      try {
        await supabase
          .from('message_history')
          .insert({
            user_id: targetUserId,
            device_id: device.id,
            contact_phone: to,
            message_type: 'text',
            content: message,
            broadcast_id: null
          });
      } catch (historyError) {
        console.warn('[Broadcast] Failed to log to message_history:', historyError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          messageId: result.messageId || `msg-${Date.now()}`,
          method: 'baileys',
          server: baileysUrl,
          timestamp: new Date().toISOString()
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );

    } catch (fetchError) {
      console.error('Error calling Baileys service:', fetchError);
      
      // Fallback: Queue message for later processing
      try {
        await supabase
          .from('message_queue')
          .insert({
            user_id: targetUserId,
            device_id: device.id,
            to_phone: to,
            message: message,
            message_type: 'text',
            status: 'pending',
            error_message: 'Baileys service unavailable, queued for retry'
          });

        return new Response(
          JSON.stringify({
            success: true,
            messageId: `queued-${Date.now()}`,
            method: 'queued',
            message: 'Message queued for delivery'
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        );
      } catch (queueError) {
        console.error('[Broadcast] Failed to queue message:', queueError);
        throw fetchError;
      }
    }

  } catch (error: any) {
    console.error('Error in admin-broadcast-send:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error.message === 'Unauthorized' ? 401 : 500
      }
    );
  }
});
