import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { deviceId, conversationId, contactJid, messageContent, mediaUrl, messageType = 'text' } = await req.json()

    if (!deviceId || !contactJid || !messageContent) {
      return new Response(
        JSON.stringify({ error: 'deviceId, contactJid, and messageContent are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')!
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify device belongs to user
    const { data: device, error: deviceError } = await supabaseClient
      .from('devices')
      .select('*')
      .eq('id', deviceId)
      .eq('user_id', user.id)
      .eq('status', 'connected')
      .single()

    if (deviceError || !device) {
      return new Response(
        JSON.stringify({ error: 'Device not found or not connected' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Baileys service URL from env
    const baileysServiceUrl = Deno.env.get('BAILEYS_SERVICE_URL')
    if (!baileysServiceUrl) {
      return new Response(
        JSON.stringify({ error: 'BAILEYS_SERVICE_URL not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prepare message payload
    const messagePayload: any = {
      deviceId: deviceId,
      targetJid: contactJid,
      messageType: messageType,
    }

    if (messageType === 'text') {
      messagePayload.message = messageContent
    } else if (messageType === 'image' || messageType === 'video' || messageType === 'document') {
      messagePayload.mediaUrl = mediaUrl
      messagePayload.caption = messageContent
    }

    // Send message via Railway Baileys service
    const response = await fetch(`${baileysServiceUrl}/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messagePayload),
    })

    // Get response text first
    const responseText = await response.text()
    console.log('Railway response status:', response.status)
    console.log('Railway response text:', responseText.substring(0, 200)) // Log first 200 chars

    if (!response.ok) {
      console.error('Baileys service error (non-ok status):', responseText)
      return new Response(
        JSON.stringify({ error: 'Failed to send message via Baileys', details: responseText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse response safely
    let baileysResult
    try {
      baileysResult = JSON.parse(responseText)
    } catch (parseError) {
      console.error('Failed to parse Railway response. Status:', response.status, 'Text:', responseText)
      // If parse fails, create a fallback result
      baileysResult = {
        success: true,
        messageId: `msg_${Date.now()}`,
        warning: 'Message sent but response format was unexpected'
      }
    }

    // Create admin supabase client for inserting message
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Save sent message to database
    const { data: savedMessage, error: messageError } = await supabaseAdmin
      .from('whatsapp_messages')
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        device_id: deviceId,
        message_id: baileysResult.messageId || `msg_${Date.now()}`,
        from_me: true,
        contact_jid: contactJid,
        message_type: messageType,
        message_content: messageContent,
        media_url: mediaUrl,
        status: 'sent',
        timestamp: new Date().toISOString(),
      })
      .select()
      .single()

    if (messageError) {
      console.error('Error saving message:', messageError)
      // Continue anyway since message was sent
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Message sent successfully',
        messageData: savedMessage || baileysResult,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Error in send-crm-message:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
