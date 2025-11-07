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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const webhookData = await req.json();
    console.log('Received webhook:', webhookData);

    const { order_id, amount, status, payment_method, completed_at, project } = webhookData;

    // Validate webhook data
    if (!order_id || !amount || !status) {
      throw new Error('Invalid webhook data');
    }

    // Validate project matches our expected project
    const expectedProject = 'halowa';
    if (project && project !== expectedProject) {
      console.error('Invalid project:', project);
      throw new Error('Unauthorized: Invalid project');
    }

    console.log('✅ Webhook validation passed');

    // Find payment record - must exist and match order_id and amount
    const { data: payment, error: findError } = await supabaseClient
      .from('payments')
      .select('*')
      .eq('order_id', order_id)
      .eq('amount', amount)
      .single();

    if (findError || !payment) {
      console.error('Payment not found:', findError);
      throw new Error('Payment not found');
    }

    console.log('Found payment:', payment);

    // Additional security: only update if payment is still pending
    // This prevents replay attacks or duplicate webhook calls from changing completed payments
    if (payment.status === 'completed' && status === 'completed') {
      console.log('Payment already completed, ignoring duplicate webhook');
      return new Response(
        JSON.stringify({ success: true, message: 'Payment already completed' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Update payment status
    const { error: updateError } = await supabaseClient
      .from('payments')
      .update({
        status: status,
        completed_at: completed_at || new Date().toISOString(),
      })
      .eq('id', payment.id);

    if (updateError) {
      console.error('Error updating payment:', updateError);
      throw updateError;
    }

    // If payment completed, activate subscription
    if (status === 'completed' && payment.plan_id) {
      console.log('Activating subscription for user:', payment.user_id);

      // Check if user has active subscription
      const { data: existingSub } = await supabaseClient
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', payment.user_id)
        .eq('status', 'active')
        .single();

      if (existingSub) {
        // Update existing subscription
        const { error: updateSubError } = await supabaseClient
          .from('user_subscriptions')
          .update({
            plan_id: payment.plan_id,
            starts_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
          })
          .eq('id', existingSub.id);

        if (updateSubError) {
          console.error('Error updating subscription:', updateSubError);
        }
      } else {
        // Create new subscription
        const { error: createSubError } = await supabaseClient
          .from('user_subscriptions')
          .insert({
            user_id: payment.user_id,
            plan_id: payment.plan_id,
            status: 'active',
            starts_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
          });

        if (createSubError) {
          console.error('Error creating subscription:', createSubError);
        }
      }

      console.log('Subscription activated successfully');
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Webhook processed' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in pakasir-webhook:', error);
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