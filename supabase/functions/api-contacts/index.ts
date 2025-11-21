import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Verify Account API Key from Bearer token
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Account API key is required in Authorization: Bearer header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accountApiKey = authHeader.replace('Bearer ', '');

    // Hash and verify API key
    const apiKeyHash = await hashApiKey(accountApiKey);
    const { data: apiKeyData, error: apiKeyError } = await supabase
      .from('api_keys')
      .select('user_id, is_active')
      .eq('api_key_hash', apiKeyHash)
      .eq('is_active', true)
      .single();

    if (apiKeyError || !apiKeyData) {
      console.error('API key verification failed:', apiKeyError);
      return new Response(
        JSON.stringify({ error: 'Invalid or inactive account API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = apiKeyData.user_id;
    const url = new URL(req.url);
    const path = url.pathname.split('/').filter(Boolean);
    const method = req.method;

    // GET /contacts - List all contacts
    if (method === 'GET' && path.length === 0) {
      const isGroup = url.searchParams.get('is_group');
      const limit = parseInt(url.searchParams.get('limit') || '100');

      let query = supabase
        .from('contacts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (isGroup !== null) {
        query = query.eq('is_group', isGroup === 'true');
      }

      const { data: contacts, error } = await query;

      if (error) {
        console.error('Error fetching contacts:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch contacts' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          data: contacts,
          count: contacts?.length || 0 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /contacts - Create new contact
    if (method === 'POST' && path.length === 0) {
      const body = await req.json();
      const { name, phone_number, is_group, tags, notes } = body;

      if (!name || !phone_number) {
        return new Response(
          JSON.stringify({ error: 'name and phone_number are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: contact, error } = await supabase
        .from('contacts')
        .insert({
          user_id: userId,
          name,
          phone_number,
          is_group: is_group || false,
          tags: tags || [],
          notes: notes || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating contact:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to create contact' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: contact }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT /contacts/:id - Update contact
    if (method === 'PUT' && path.length === 1) {
      const contactId = path[0];
      const body = await req.json();
      const { name, phone_number, tags, notes } = body;

      const updateData: any = {};
      if (name) updateData.name = name;
      if (phone_number) updateData.phone_number = phone_number;
      if (tags) updateData.tags = tags;
      if (notes !== undefined) updateData.notes = notes;

      const { data: contact, error } = await supabase
        .from('contacts')
        .update(updateData)
        .eq('id', contactId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error || !contact) {
        return new Response(
          JSON.stringify({ error: 'Contact not found or update failed' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: contact }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE /contacts/:id - Delete contact
    if (method === 'DELETE' && path.length === 1) {
      const contactId = path[0];

      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', contactId)
        .eq('user_id', userId);

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Contact not found or delete failed' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Kontak berhasil dihapus' }),
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

async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
