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

    // Verify admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleData?.role !== 'admin') {
      throw new Error('Admin access required');
    }

    const { action, to, message, user_id } = await req.json();

    if (action !== 'send_message') {
      throw new Error('Invalid action');
    }

    if (!to || !message) {
      throw new Error('Missing required fields: to, message');
    }

    console.log(`Sending broadcast message to ${to} for user ${user_id}`);

    // Get Baileys service URL and internal API key
    const baileysUrl = Deno.env.get('BAILEYS_SERVICE_URL');
    const internalApiKey = Deno.env.get('INTERNAL_API_KEY');

    if (!baileysUrl) {
      console.warn('BAILEYS_SERVICE_URL not configured, simulating send');

      // Simulate successful send for development
      return new Response(
        JSON.stringify({
          success: true,
          messageId: `sim-${Date.now()}`,
          method: 'simulated',
          message: 'Development mode: message simulated'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    if (!internalApiKey) {
      console.error('INTERNAL_API_KEY not configured - authentication will fail');
      return new Response(
        JSON.stringify({ error: 'Internal authentication not configured' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      );
    }

    // Send message via Baileys service with internal authentication
    try {
      const baileysResponse = await fetch(`${baileysUrl}/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${internalApiKey}`, // 🔒 Internal API authentication
        },
        body: JSON.stringify({
          to: to,
          message: message,
          userId: user_id
        })
      });

      if (!baileysResponse.ok) {
        const errorText = await baileysResponse.text();
        console.error('Baileys service error:', errorText);
        throw new Error(`Baileys service error: ${baileysResponse.status}`);
      }

      const result = await baileysResponse.json();
      
      // Log message to history
      await supabase
        .from('message_history')
        .insert({
          user_id: user.id,
          device_id: null,
          contact_phone: to,
          message_type: 'text',
          content: message,
          broadcast_id: null
        });

      return new Response(
        JSON.stringify({
          success: true,
          messageId: result.messageId || `msg-${Date.now()}`,
          method: 'baileys',
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
      await supabase
        .from('message_queue')
        .insert({
          user_id: user.id,
          device_id: null,
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
