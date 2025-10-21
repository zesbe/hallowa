import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("Checking for scheduled broadcasts...");

    // Get all broadcasts that are scheduled and past due
    const now = new Date().toISOString();
    const { data: scheduledBroadcasts, error: fetchError } = await supabaseClient
      .from("broadcasts")
      .select("*")
      .eq("status", "draft")
      .not("scheduled_at", "is", null)
      .lte("scheduled_at", now);

    if (fetchError) {
      console.error("Error fetching scheduled broadcasts:", fetchError);
      throw fetchError;
    }

    if (!scheduledBroadcasts || scheduledBroadcasts.length === 0) {
      console.log("No scheduled broadcasts to process");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No scheduled broadcasts to process",
          count: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${scheduledBroadcasts.length} broadcasts to process`);

    // Update status to processing for all scheduled broadcasts
    const broadcastIds = scheduledBroadcasts.map(b => b.id);
    const { error: updateError } = await supabaseClient
      .from("broadcasts")
      .update({ status: "processing" })
      .in("id", broadcastIds);

    if (updateError) {
      console.error("Error updating broadcast status:", updateError);
      throw updateError;
    }

    console.log(`Successfully triggered ${broadcastIds.length} scheduled broadcasts`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Triggered ${broadcastIds.length} scheduled broadcasts`,
        count: broadcastIds.length,
        broadcast_ids: broadcastIds
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in scheduled-broadcaster:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
