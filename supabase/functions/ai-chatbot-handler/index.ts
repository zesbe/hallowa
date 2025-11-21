import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

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

    const { deviceId, contactPhone, message } = await req.json();

    if (!deviceId || !contactPhone || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Processing chatbot request:', { deviceId, contactPhone, userId: user.id });

    // 1. Check if user has AI Chatbot add-on
    const { data: hasAddon } = await supabaseClient.rpc('user_has_add_on', {
      p_user_id: user.id,
      p_add_on_slug: 'ai-chatbot-basic'
    });

    if (!hasAddon) {
      console.log('User does not have AI Chatbot add-on');
      return new Response(JSON.stringify({ 
        error: 'AI Chatbot add-on required',
        needsUpgrade: true 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Get AI chatbot rules for this device
    const { data: rules, error: rulesError } = await supabaseClient
      .from('chatbot_ai_rules')
      .select('*')
      .eq('device_id', deviceId)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (rulesError) {
      console.error('Error fetching rules:', rulesError);
      throw rulesError;
    }

    console.log('Found chatbot rules:', rules?.length);

    // 3. Get or create conversation history
    const { data: conversation, error: convError } = await supabaseClient
      .from('chatbot_conversations')
      .select('messages')
      .eq('device_id', deviceId)
      .eq('contact_phone', contactPhone)
      .maybeSingle();

    if (convError && convError.code !== 'PGRST116') {
      console.error('Error fetching conversation:', convError);
      throw convError;
    }

    const messages: ChatMessage[] = conversation?.messages || [];
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    messages.push(userMessage);

    // Keep only last 10 messages for context
    const contextMessages = messages.slice(-10);

    // 4. Find matching rule
    let matchedRule = null;
    for (const rule of rules || []) {
      if (rule.trigger_type === 'keyword' && rule.trigger_value) {
        const keywords = rule.trigger_value.toLowerCase().split(',').map((k: string) => k.trim());
        if (keywords.some((keyword: string) => message.toLowerCase().includes(keyword))) {
          matchedRule = rule;
          break;
        }
      } else if (rule.trigger_type === 'ai' && rule.ai_enabled) {
        matchedRule = rule;
        break;
      }
    }

    if (!matchedRule) {
      console.log('No matching rule found');
      return new Response(JSON.stringify({ 
        success: false,
        message: 'No matching chatbot rule' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Matched rule:', matchedRule.rule_name);

    let responseText = '';

    // 5. Generate response based on rule type
    if (matchedRule.response_type === 'text') {
      responseText = matchedRule.response_text || 'Maaf, saya tidak memiliki jawaban untuk itu.';
    } else if (matchedRule.response_type === 'ai' && matchedRule.ai_enabled) {
      // Call Lovable AI Gateway
      const aiModel = matchedRule.ai_model || 'google/gemini-2.5-flash';
      const aiPrompt = matchedRule.ai_prompt || 'You are a helpful customer service assistant. Be polite, concise, and helpful.';

      const aiMessages = [
        { role: 'system', content: aiPrompt },
        ...contextMessages.map(m => ({ role: m.role, content: m.content }))
      ];

      console.log('Calling AI with model:', aiModel);

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: aiModel,
          messages: aiMessages,
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('AI API error:', errorText);
        throw new Error(`AI API error: ${errorText}`);
      }

      const aiData = await aiResponse.json();
      responseText = aiData.choices[0].message.content;
      console.log('AI response generated successfully');
    }

    // 6. Save conversation
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: responseText,
      timestamp: new Date().toISOString(),
    };
    messages.push(assistantMessage);

    await supabaseClient
      .from('chatbot_conversations')
      .upsert({
        user_id: user.id,
        device_id: deviceId,
        contact_phone: contactPhone,
        messages: messages.slice(-20), // Keep last 20 messages
        last_message_at: new Date().toISOString(),
      }, {
        onConflict: 'device_id,contact_phone'
      });

    // 7. Update rule execution count
    await supabaseClient
      .from('chatbot_ai_rules')
      .update({
        execution_count: (matchedRule.execution_count || 0) + 1,
        last_executed_at: new Date().toISOString(),
      })
      .eq('id', matchedRule.id);

    console.log('Chatbot response generated successfully');

    return new Response(JSON.stringify({
      success: true,
      response: responseText,
      ruleUsed: matchedRule.rule_name,
      aiPowered: matchedRule.ai_enabled,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-chatbot-handler:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      error: errorMessage,
      details: 'Check function logs for more information'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
