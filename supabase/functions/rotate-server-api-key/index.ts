// @ts-ignore - Deno imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RotateKeyRequest {
  server_id: string;
}

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

    // 🔒 SECURITY: Verify admin authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (roleData?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 🔒 SECURITY: Rate limiting check (stricter for rotation)
    const { data: rateLimitData } = await supabase
      .rpc('check_admin_rate_limit', {
        p_admin_id: user.id,
        p_operation_type: 'api_key_rotation',
        p_max_requests: 5, // Max 5 rotations per 5 minutes
        p_window_minutes: 5
      });

    if (rateLimitData === false) {
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded',
          message: 'Too many API key rotation requests. Please wait before trying again.'
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { server_id }: RotateKeyRequest = await req.json();

    if (!server_id) {
      return new Response(
        JSON.stringify({ error: 'server_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get encryption key
    const encryptionKey = Deno.env.get('SERVER_ENCRYPTION_KEY');
    if (!encryptionKey) {
      return new Response(
        JSON.stringify({ error: 'Encryption key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call database function to rotate key
    const { data, error } = await supabase
      .rpc('rotate_server_api_key', {
        p_server_id: server_id,
        p_encryption_key: encryptionKey
      });

    if (error) {
      console.error('Key rotation error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to rotate API key', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!data?.success) {
      return new Response(
        JSON.stringify({ error: data?.error || 'Failed to rotate API key' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log successful rotation
    console.log(`API key rotated for server ${server_id} by admin ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'API key rotated successfully',
        new_api_key: data.api_key,
        server_id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('API key rotation error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
