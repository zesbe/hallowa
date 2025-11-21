import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify API Key
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key is required in x-api-key header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify API key and get user
    const { data: apiKeyData, error: apiKeyError } = await supabase
      .from('api_keys')
      .select('user_id, is_active')
      .eq('api_key_hash', await hashApiKey(apiKey))
      .eq('is_active', true)
      .single();

    if (apiKeyError || !apiKeyData) {
      console.error('API key verification failed:', apiKeyError);
      return new Response(
        JSON.stringify({ error: 'Invalid or inactive API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = apiKeyData.user_id;
    const url = new URL(req.url);
    const path = url.pathname.split('/').filter(Boolean);
    const method = req.method;

    // GET /devices - List all user devices
    if (method === 'GET' && path.length === 0) {
      const { data: devices, error } = await supabase
        .from('devices')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching devices:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch devices' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          data: devices,
          count: devices?.length || 0 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /devices/:id - Get specific device
    if (method === 'GET' && path.length === 1) {
      const deviceId = path[0];
      const { data: device, error } = await supabase
        .from('devices')
        .select('*')
        .eq('id', deviceId)
        .eq('user_id', userId)
        .single();

      if (error || !device) {
        return new Response(
          JSON.stringify({ error: 'Device not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: device }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /devices - Create new device
    if (method === 'POST' && path.length === 0) {
      const body = await req.json();
      const { device_name, webhook_url } = body;

      if (!device_name) {
        return new Response(
          JSON.stringify({ error: 'device_name is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: device, error } = await supabase
        .from('devices')
        .insert({
          user_id: userId,
          device_name,
          webhook_url,
          status: 'disconnected',
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating device:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to create device' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: device }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT /devices/:id - Update device
    if (method === 'PUT' && path.length === 1) {
      const deviceId = path[0];
      const body = await req.json();
      const { device_name, webhook_url, status } = body;

      const updateData: any = {};
      if (device_name) updateData.device_name = device_name;
      if (webhook_url !== undefined) updateData.webhook_url = webhook_url;
      if (status) updateData.status = status;

      const { data: device, error } = await supabase
        .from('devices')
        .update(updateData)
        .eq('id', deviceId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error || !device) {
        return new Response(
          JSON.stringify({ error: 'Device not found or update failed' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: device }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE /devices/:id - Delete device (secure with cleanup)
    if (method === 'DELETE' && path.length === 1) {
      const deviceId = path[0];

      // Use delete_device_completely function for secure cleanup
      const { data: result, error } = await supabase
        .rpc('delete_device_completely', { p_device_id: deviceId });

      if (error) {
        console.error('Error deleting device:', error);
        return new Response(
          JSON.stringify({ error: 'Device not found or delete failed' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Device deleted successfully',
          details: result 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /devices/:id/logout - Logout device
    if (method === 'POST' && path.length === 2 && path[1] === 'logout') {
      const deviceId = path[0];

      const { data: device, error } = await supabase
        .from('devices')
        .update({
          status: 'disconnected',
          phone_number: null,
          session_data: null,
          qr_code: null,
        })
        .eq('id', deviceId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error || !device) {
        return new Response(
          JSON.stringify({ error: 'Device not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: device, message: 'Device logged out successfully' }),
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

// Helper function to hash API key
async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}
