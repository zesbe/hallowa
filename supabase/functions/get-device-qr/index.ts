import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Get QR code or pairing code from Redis for a device
 * This edge function provides a secure way to fetch temporary codes
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const REDIS_URL = Deno.env.get('UPSTASH_REDIS_REST_URL');
    const REDIS_TOKEN = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');

    if (!REDIS_URL || !REDIS_TOKEN) {
      console.error('Redis credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Redis not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get deviceId from POST body (preferred) or URL query param fallback
    let deviceId: string | null = null;
    try {
      if (req.method === 'POST') {
        const body = await req.json().catch(() => null);
        deviceId = body?.deviceId ?? null;
      }
    } catch (_) {
      // ignore parse error and fallback to query param
    }
    if (!deviceId) {
      const url = new URL(req.url);
      deviceId = url.searchParams.get('deviceId');
    }

    if (!deviceId) {
      return new Response(
        JSON.stringify({ error: 'deviceId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has access to this device
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify device belongs to user
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id, user_id')
      .eq('id', deviceId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (deviceError || !device) {
      console.error('Device error:', deviceError);
      return new Response(
        JSON.stringify({ error: 'Device not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch from Redis using MGET to get both QR and pairing code
    const redisResponse = await fetch(REDIS_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REDIS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['MGET', `qr:${deviceId}`, `pairing:${deviceId}`]),
    });

    if (!redisResponse.ok) {
      const errorText = await redisResponse.text();
      console.error('Redis error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Redis fetch failed', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const redisData = await redisResponse.json();
    const [qrCode, pairingCode] = redisData.result || [null, null];

    console.log(`Fetched codes for device ${deviceId}: QR=${!!qrCode}, Pairing=${!!pairingCode}`);

    return new Response(
      JSON.stringify({
        qrCode,
        pairingCode,
        deviceId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
