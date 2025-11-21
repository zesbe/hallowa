import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create client with user auth for validation
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Validate user is authenticated
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    // Create service role client for database operations (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { plan_id, payment_method = 'qris' } = await req.json();

    // Get plan details using admin client
    const { data: plan, error: planError } = await supabaseAdmin
      .from('plans')
      .select('*')
      .eq('id', plan_id)
      .single();

    if (planError || !plan) {
      throw new Error('Plan not found');
    }

    // Generate unique order_id
    const order_id = `INV${Date.now()}${Math.random().toString(36).substring(7).toUpperCase()}`;
    
    const amount = parseInt(plan.price.toString());
    if (!amount || amount <= 0) {
      throw new Error(`Invalid plan price: ${plan.price}`);
    }
    
    const pakasirApiKey = Deno.env.get('PAKASIR_API_KEY');
    const pakasirProject = 'halowa';

    console.log('Creating Pakasir transaction:', { order_id, amount, payment_method, plan });

    // Call Pakasir API
    const pakasirResponse = await fetch(`https://app.pakasir.com/api/transactioncreate/${payment_method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        project: pakasirProject,
        order_id: order_id,
        amount: amount,
        api_key: pakasirApiKey,
      }),
    });

    if (!pakasirResponse.ok) {
      const errorText = await pakasirResponse.text();
      console.error('Pakasir API error:', errorText);
      throw new Error(`Pakasir API error: ${pakasirResponse.status}`);
    }

    const pakasirData = await pakasirResponse.json();
    console.log('Pakasir response:', pakasirData);

    const payment = pakasirData.payment;

    // Save payment to database using admin client (bypasses RLS for security)
    const { data: paymentRecord, error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert({
        user_id: user.id,
        plan_id: plan_id,
        order_id: payment.order_id,
        amount: payment.amount,
        fee: payment.fee,
        total_payment: payment.total_payment,
        payment_method: payment.payment_method,
        payment_number: payment.payment_number,
        status: 'pending',
        expired_at: payment.expired_at,
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Error saving payment:', paymentError);
      throw paymentError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment: paymentRecord,
        pakasir: payment,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in pakasir-create-transaction:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});