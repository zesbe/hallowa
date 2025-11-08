import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GroupInfo {
  id: string;
  name: string;
  participants: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { device_id } = await req.json();

    if (!device_id) {
      return new Response(
        JSON.stringify({ error: "device_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get device info
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('*')
      .eq('id', device_id)
      .single();

    if (deviceError || !device) {
      return new Response(
        JSON.stringify({ error: "Device not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (device.status !== 'connected') {
      return new Response(
        JSON.stringify({ error: "Device must be connected to sync groups" }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch real WhatsApp groups from Baileys service
    let baileysServiceUrl = Deno.env.get('BAILEYS_SERVICE_URL');

    if (!baileysServiceUrl) {
      console.error('❌ BAILEYS_SERVICE_URL not configured');
      return new Response(
        JSON.stringify({
          error: "BAILEYS_SERVICE_URL not configured. Please set this environment variable to sync groups.",
          groups_synced: 0,
          total_groups: 0
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Ensure URL has protocol (add https:// if missing)
    if (!baileysServiceUrl.startsWith('http://') && !baileysServiceUrl.startsWith('https://')) {
      baileysServiceUrl = `https://${baileysServiceUrl}`;
      console.log(`ℹ️ Added https:// protocol to BAILEYS_SERVICE_URL: ${baileysServiceUrl}`);
    }

    let groups: GroupInfo[] = [];

    try {
      const url = `${baileysServiceUrl}/api/groups/${device_id}`;
      console.log(`🔗 Fetching groups from: ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${device.api_key}`,
          'Content-Type': 'application/json',
          'X-Device-ID': device_id,
        },
        timeout: 10000, // 10 second timeout
      });

      console.log(`📡 Response status: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        groups = data.groups || data.data || [];
        console.log(`✅ Fetched ${groups.length} groups from Baileys service`);
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch groups from Baileys service:', response.status, errorText);
        return new Response(
          JSON.stringify({
            error: `Failed to fetch groups from Baileys service: ${response.status} ${errorText}`,
            groups_synced: 0,
            total_groups: 0
          }),
          {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    } catch (error) {
      console.error('Error fetching from Baileys service:', error);
      return new Response(
        JSON.stringify({
          error: `Error connecting to Baileys service: ${error instanceof Error ? error.message : 'Unknown error'}`,
          groups_synced: 0,
          total_groups: 0
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // If no groups found, return success with 0 count
    if (groups.length === 0) {
      console.log('ℹ️ No WhatsApp groups found for this device');
      return new Response(
        JSON.stringify({
          success: true,
          groups_synced: 0,
          total_groups: 0,
          message: 'No WhatsApp groups found for this device',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Sync groups to database
    let synced_count = 0;

    for (const group of groups) {
      // Format phone number as WhatsApp group ID
      const phoneNumber = group.id;

      // Check if group already exists
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('phone_number', phoneNumber)
        .eq('device_id', device_id)
        .single();

      if (existingContact) {
        // Update existing group
        const { error: updateError } = await supabase
          .from('contacts')
          .update({
            name: group.name,
            is_group: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingContact.id);

        if (!updateError) synced_count++;
      } else {
        // Insert new group
        const { error: insertError } = await supabase
          .from('contacts')
          .insert({
            user_id: device.user_id,
            device_id: device_id,
            phone_number: phoneNumber,
            name: group.name,
            is_group: true,
          });

        if (!insertError) synced_count++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        groups_synced: synced_count,
        total_groups: groups.length,
        message: `Successfully synced ${synced_count} WhatsApp groups`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in sync-whatsapp-groups:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
