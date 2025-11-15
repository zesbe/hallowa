import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Auto Cleanup Scheduler
 * Runs periodically (via cron) to detect and cleanup stuck devices
 * This prevents devices from staying in "reconnecting" state indefinitely
 */
serve(async (req) => {
  try {
    // ✅ SECURITY: Verify internal API key for cron jobs
    const internalApiKey = req.headers.get('x-internal-api-key');
    const expectedKey = Deno.env.get('INTERNAL_API_KEY');

    if (!internalApiKey || internalApiKey !== expectedKey) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid internal API key' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Call the auto-cleanup function
    const { data: cleanupResult, error: cleanupError } = await supabase.rpc(
      'auto_cleanup_stuck_devices'
    );

    if (cleanupError) {
      console.error('Auto-cleanup error:', cleanupError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Auto-cleanup failed',
          details: cleanupError.message 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const message = cleanupResult > 0 
      ? `Successfully cleaned up ${cleanupResult} stuck device(s)`
      : 'No stuck devices found';

    console.log(message);

    return new Response(
      JSON.stringify({ 
        success: true, 
        cleaned_devices: cleanupResult,
        message,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Scheduler error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
