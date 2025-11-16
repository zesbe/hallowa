// @ts-ignore - Deno imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HealthCheckRequest {
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

    // 🔒 SECURITY: Rate limiting check
    const { data: rateLimitData, error: rateLimitError } = await supabase
      .rpc('check_admin_rate_limit', {
        p_admin_id: user.id,
        p_operation_type: 'health_check',
        p_max_requests: 30, // Max 30 health checks per 5 minutes
        p_window_minutes: 5
      });

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError);
    }

    if (rateLimitData === false) {
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded',
          message: 'Too many health check requests. Please wait before trying again.'
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { server_id }: HealthCheckRequest = await req.json();

    if (!server_id) {
      return new Response(
        JSON.stringify({ error: 'server_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get server details
    const { data: server, error: serverError } = await supabase
      .from('backend_servers')
      .select('*')
      .eq('id', server_id)
      .single();

    if (serverError || !server) {
      return new Response(
        JSON.stringify({ error: 'Server not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 🔒 SECURITY: Decrypt API key if encrypted
    let apiKey = server.api_key;
    if (server.api_key_encrypted && apiKey) {
      const encryptionKey = Deno.env.get('SERVER_ENCRYPTION_KEY');
      if (encryptionKey) {
        const { data: decryptedKey } = await supabase
          .rpc('decrypt_sensitive_data', {
            encrypted_data: apiKey,
            key: encryptionKey
          });
        
        if (decryptedKey) {
          apiKey = decryptedKey;
        }
      }
    }

    // Perform health check
    const startTime = Date.now();
    let isHealthy = false;
    let errorMessage = null;

    try {
      const healthCheckUrl = `${server.server_url}/health`;
      const response = await fetch(healthCheckUrl, {
        method: 'GET',
        headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {},
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      isHealthy = response.ok;
      if (!isHealthy) {
        errorMessage = `Health check failed with status ${response.status}`;
      }
    } catch (error: any) {
      isHealthy = false;
      errorMessage = error.message || 'Health check request failed';
    }

    const responseTime = Date.now() - startTime;

    // Update server health status
    const healthCheckFailures = isHealthy ? 0 : (server.health_check_failures || 0) + 1;
    
    const { error: updateError } = await supabase
      .from('backend_servers')
      .update({
        is_healthy: isHealthy,
        last_health_check: new Date().toISOString(),
        health_check_failures: healthCheckFailures,
        response_time: responseTime,
        updated_at: new Date().toISOString()
      })
      .eq('id', server_id);

    if (updateError) {
      console.error('Error updating server health:', updateError);
    }

    // Log to server_logs
    await supabase
      .from('server_logs')
      .insert({
        server_id: server_id,
        log_type: isHealthy ? 'info' : 'error',
        message: isHealthy ? 'Health check passed' : 'Health check failed',
        details: {
          response_time_ms: responseTime,
          error: errorMessage,
          timestamp: new Date().toISOString()
        }
      });

    return new Response(
      JSON.stringify({
        success: true,
        server_id,
        is_healthy: isHealthy,
        response_time_ms: responseTime,
        health_check_failures: healthCheckFailures,
        error: errorMessage
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Health check error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
