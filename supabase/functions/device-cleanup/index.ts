import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Device Cleanup Edge Function
 * Handles comprehensive device deletion and auto-cleanup including:
 * - Supabase database cleanup
 * - Baileys session storage cleanup
 * - Redis session cleanup
 * - Auto-detection of stuck devices
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'auto-cleanup';

    // ✅ SECURITY: Verify user authentication for delete operations
    if (req.method === 'DELETE') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      );

      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Action: Auto-cleanup stuck devices (GET request for periodic check)
    if (action === 'auto-cleanup' && req.method === 'GET') {
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
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          cleaned_devices: cleanupResult,
          message: cleanupResult > 0 ? `${cleanupResult} devices cleaned up` : 'No stuck devices found',
          timestamp: new Date().toISOString()
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Delete device completely
    if (action === 'delete' && req.method === 'DELETE') {
      const { device_id } = await req.json();

      if (!device_id) {
        return new Response(
          JSON.stringify({ error: 'device_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Call database function for comprehensive cleanup
      const { data: deleteResult, error: deleteError } = await supabase.rpc(
        'delete_device_completely',
        { p_device_id: device_id }
      );

      if (deleteError) {
        console.error('Delete error:', deleteError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Delete failed',
            details: deleteError.message 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if deletion was successful
      if (!deleteResult.success) {
        return new Response(
          JSON.stringify(deleteResult),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Cleanup Baileys session from storage
      try {
        const { data: files, error: listError } = await supabase.storage
          .from('baileys-sessions')
          .list(device_id);

        if (!listError && files && files.length > 0) {
          const filePaths = files.map(file => `${device_id}/${file.name}`);
          await supabase.storage
            .from('baileys-sessions')
            .remove(filePaths);
          
          console.log(`Cleaned up ${files.length} Baileys session files`);
        }
      } catch (storageError) {
        console.error('Storage cleanup error:', storageError);
        // Don't fail the whole operation if storage cleanup fails
      }

      // Cleanup Redis session (if Redis is configured)
      try {
        const redisUrl = Deno.env.get('UPSTASH_REDIS_REST_URL');
        const redisToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');

        if (redisUrl && redisToken) {
          const redisKey = `session:${device_id}`;
          
          const response = await fetch(`${redisUrl}/del/${redisKey}`, {
            headers: {
              Authorization: `Bearer ${redisToken}`,
            },
          });

          if (response.ok) {
            console.log('Redis session cleaned up');
          }
        }
      } catch (redisError) {
        console.error('Redis cleanup error:', redisError);
        // Don't fail the whole operation if Redis cleanup fails
      }

      return new Response(
        JSON.stringify({
          ...deleteResult,
          storage_cleaned: true,
          redis_cleaned: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action or method' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Device cleanup error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
