import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let userId: string;
    let deviceId: string | null = null;

    // Check for Account API Key (Bearer) or Device API Key (x-api-key)
    const authHeader = req.headers.get('authorization');
    const deviceApiKey = req.headers.get('x-api-key');

    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Account API Key
      const accountApiKey = authHeader.replace('Bearer ', '');
      const apiKeyHash = await hashApiKey(accountApiKey);
      
      const { data: apiKeyData, error: apiKeyError } = await supabase
        .from('api_keys')
        .select('user_id')
        .eq('api_key_hash', apiKeyHash)
        .eq('is_active', true)
        .single();

      if (apiKeyError || !apiKeyData) {
        return new Response(
          JSON.stringify({ error: 'Invalid account API key' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userId = apiKeyData.user_id;
    } else if (deviceApiKey) {
      // Device API Key
      const { data: device, error: deviceError } = await supabase
        .from('devices')
        .select('id, user_id')
        .eq('api_key', deviceApiKey)
        .single();

      if (deviceError || !device) {
        return new Response(
          JSON.stringify({ error: 'Invalid device API key' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userId = device.user_id;
      deviceId = device.id;
    } else {
      return new Response(
        JSON.stringify({ error: 'API key is required (Bearer token or x-api-key)' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const path = url.pathname.split('/').filter(Boolean);
    const method = req.method;

    // GET /broadcasts - List broadcasts
    if (method === 'GET' && path.length === 0) {
      const status = url.searchParams.get('status');

      let query = supabase
        .from('broadcasts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data: broadcasts, error } = await query;

      if (error) {
        console.error('Error fetching broadcasts:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch broadcasts' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: broadcasts }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /broadcasts - Create new broadcast
    if (method === 'POST' && path.length === 0) {
      const body = await req.json();
      const { name, message, target_contacts, device_id, scheduled_at, delay_seconds } = body;

      if (!name || !message || !target_contacts || !Array.isArray(target_contacts)) {
        return new Response(
          JSON.stringify({ error: 'name, message, and target_contacts (array) are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Use provided device_id or the one from Device API Key
      const broadcastDeviceId = device_id || deviceId;

      if (!broadcastDeviceId) {
        return new Response(
          JSON.stringify({ error: 'device_id is required when using Account API Key' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify device ownership
      const { data: device, error: deviceError } = await supabase
        .from('devices')
        .select('id')
        .eq('id', broadcastDeviceId)
        .eq('user_id', userId)
        .single();

      if (deviceError || !device) {
        return new Response(
          JSON.stringify({ error: 'Invalid device_id or device does not belong to user' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: broadcast, error } = await supabase
        .from('broadcasts')
        .insert({
          user_id: userId,
          device_id: broadcastDeviceId,
          name,
          message,
          target_contacts,
          scheduled_at: scheduled_at || null,
          delay_seconds: delay_seconds || 5,
          status: 'draft',
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating broadcast:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to create broadcast' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          data: {
            id: broadcast.id,
            name: broadcast.name,
            status: broadcast.status,
            target_count: target_contacts.length,
            created_at: broadcast.created_at
          }
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /broadcasts/:id - Get specific broadcast
    if (method === 'GET' && path.length === 1) {
      const broadcastId = path[0];

      const { data: broadcast, error } = await supabase
        .from('broadcasts')
        .select('*')
        .eq('id', broadcastId)
        .eq('user_id', userId)
        .single();

      if (error || !broadcast) {
        return new Response(
          JSON.stringify({ error: 'Broadcast not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: broadcast }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE /broadcasts/:id - Delete broadcast
    if (method === 'DELETE' && path.length === 1) {
      const broadcastId = path[0];

      const { error } = await supabase
        .from('broadcasts')
        .delete()
        .eq('id', broadcastId)
        .eq('user_id', userId);

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Broadcast not found or delete failed' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Broadcast deleted successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
