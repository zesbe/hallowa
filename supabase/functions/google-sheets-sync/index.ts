import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, spreadsheetId, sheetName } = await req.json();

    console.log('Google Sheets sync request:', { action, spreadsheetId, userId: user.id });

    // Check if user has Google Sheets add-on
    const { data: hasAddon } = await supabaseClient.rpc('user_has_add_on', {
      p_user_id: user.id,
      p_add_on_slug: 'google-sheets-sync'
    });

    if (!hasAddon) {
      return new Response(JSON.stringify({ 
        error: 'Google Sheets Sync add-on required',
        needsUpgrade: true 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get integration config
    const { data: integration, error: integrationError } = await supabaseClient
      .from('integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('integration_type', 'google_sheets')
      .eq('is_active', true)
      .maybeSingle();

    if (integrationError) throw integrationError;

    if (!integration) {
      return new Response(JSON.stringify({ 
        error: 'Google Sheets integration not configured' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = integration.config.access_token;
    if (!accessToken) {
      return new Response(JSON.stringify({ 
        error: 'Google Sheets not authorized' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let result;

    if (action === 'import') {
      // Import contacts from Google Sheets
      console.log('Importing contacts from Google Sheets');

      const range = `${sheetName}!A1:Z1000`;
      const sheetsResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!sheetsResponse.ok) {
        const errorData = await sheetsResponse.text();
        console.error('Google Sheets API error:', errorData);
        throw new Error('Failed to read from Google Sheets');
      }

      const sheetsData = await sheetsResponse.json();
      const rows = sheetsData.values || [];

      if (rows.length < 2) {
        return new Response(JSON.stringify({ 
          error: 'No data found in sheet' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const headers = rows[0];
      const dataRows = rows.slice(1);

      // Find column indices
      const phoneIdx = headers.findIndex((h: string) => h.toLowerCase().includes('phone') || h.toLowerCase().includes('wa'));
      const nameIdx = headers.findIndex((h: string) => h.toLowerCase().includes('name') || h.toLowerCase().includes('nama'));

      if (phoneIdx === -1) {
        return new Response(JSON.stringify({ 
          error: 'Phone number column not found. Please ensure your sheet has a "Phone" or "WA" column' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let imported = 0;
      let failed = 0;

      for (const row of dataRows) {
        const phone = row[phoneIdx]?.toString().replace(/\D/g, '');
        if (!phone || phone.length < 10) {
          failed++;
          continue;
        }

        const name = nameIdx >= 0 ? row[nameIdx] : '';

        try {
          await supabaseClient
            .from('contacts')
            .upsert({
              user_id: user.id,
              phone_number: phone,
              name: name || `Contact ${phone}`,
              tags: ['google-sheets-import'],
            }, {
              onConflict: 'user_id,phone_number'
            });
          imported++;
        } catch (error) {
          console.error('Error importing contact:', error);
          failed++;
        }
      }

      result = { imported, failed };

    } else if (action === 'export') {
      // Export contacts to Google Sheets
      console.log('Exporting contacts to Google Sheets');

      const { data: contacts, error: contactsError } = await supabaseClient
        .from('contacts')
        .select('phone_number, name, tags, notes, birthday, var1, var2, var3')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (contactsError) throw contactsError;

      // Prepare data for sheets
      const headers = ['Phone', 'Name', 'Tags', 'Notes', 'Birthday', 'Email', 'City', 'Custom'];
      const values = [headers];

      for (const contact of contacts || []) {
        values.push([
          contact.phone_number,
          contact.name || '',
          Array.isArray(contact.tags) ? contact.tags.join(', ') : '',
          contact.notes || '',
          contact.birthday || '',
          contact.var1 || '',
          contact.var2 || '',
          contact.var3 || '',
        ]);
      }

      const range = `${sheetName}!A1`;
      const sheetsResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values }),
        }
      );

      if (!sheetsResponse.ok) {
        const errorData = await sheetsResponse.text();
        console.error('Google Sheets API error:', errorData);
        throw new Error('Failed to write to Google Sheets');
      }

      result = { exported: contacts?.length || 0 };
    }

    // Log sync activity
    await supabaseClient
      .from('integration_logs')
      .insert({
        user_id: user.id,
        integration_id: integration.id,
        sync_type: action === 'import' ? 'import_contacts' : 'export_contacts',
        status: 'success',
        items_processed: (result?.imported || result?.exported || 0),
        items_failed: (result?.failed || 0),
        details: { spreadsheetId, sheetName, result },
      });

    // Update integration last sync
    await supabaseClient.rpc('update_integration_sync', {
      p_integration_id: integration.id,
      p_status: 'idle',
      p_error_message: null,
    });

    console.log('Google Sheets sync completed successfully');

    return new Response(JSON.stringify({
      success: true,
      ...result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in google-sheets-sync:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
