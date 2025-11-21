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

    // Verify Device API Key
    const deviceApiKey = req.headers.get('x-api-key');
    if (!deviceApiKey) {
      return new Response(
        JSON.stringify({ error: 'Device API key is required in x-api-key header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get device by API key
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id, user_id, status')
      .eq('api_key', deviceApiKey)
      .single();

    if (deviceError || !device) {
      console.error('Device API key verification failed:', deviceError);
      return new Response(
        JSON.stringify({ error: 'Invalid device API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (device.status !== 'connected') {
      return new Response(
        JSON.stringify({ error: 'Device is not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const path = url.pathname.split('/').filter(Boolean).pop();

    // POST /send-message - Send text message
    if (req.method === 'POST' && path === 'send-message') {
      const body = await req.json();
      const { to, message, delay } = body;

      if (!to || !message) {
        return new Response(
          JSON.stringify({ error: 'to and message are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Queue message
      const { data: queuedMessage, error: queueError } = await supabase
        .from('message_queue')
        .insert({
          user_id: device.user_id,
          device_id: device.id,
          to_phone: to,
          message: message,
          message_type: 'text',
          status: 'pending',
          scheduled_at: delay ? new Date(Date.now() + delay * 1000).toISOString() : new Date().toISOString(),
        })
        .select()
        .single();

      if (queueError) {
        console.error('Error queueing message:', queueError);
        return new Response(
          JSON.stringify({ error: 'Failed to queue message' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Pesan berhasil dikirim',
          data: {
            message_id: queuedMessage.id,
            status: 'queued',
            timestamp: queuedMessage.created_at
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /send-media - Send media message
    if (req.method === 'POST' && path === 'send-media') {
      const body = await req.json();
      const { to, media_url, caption, media_type } = body;

      if (!to || !media_url || !media_type) {
        return new Response(
          JSON.stringify({ error: 'to, media_url, and media_type are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!['image', 'video', 'document'].includes(media_type)) {
        return new Response(
          JSON.stringify({ error: 'media_type must be: image, video, or document' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Queue message
      const { data: queuedMessage, error: queueError } = await supabase
        .from('message_queue')
        .insert({
          user_id: device.user_id,
          device_id: device.id,
          to_phone: to,
          message: caption || '',
          media_url: media_url,
          message_type: media_type,
          status: 'pending',
          scheduled_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (queueError) {
        console.error('Error queueing media message:', queueError);
        return new Response(
          JSON.stringify({ error: 'Failed to queue media message' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Media berhasil dikirim',
          data: {
            message_id: queuedMessage.id,
            media_id: queuedMessage.id,
            status: 'queued'
          }
        }),
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
