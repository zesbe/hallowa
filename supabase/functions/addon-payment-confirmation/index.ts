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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { order_id } = await req.json();

    if (!order_id) {
      throw new Error('order_id is required');
    }

    console.log('Processing add-on payment confirmation for:', order_id);

    // Update payment status
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('order_id', order_id)
      .select()
      .single();

    if (paymentError) {
      console.error('Error updating payment:', paymentError);
      throw paymentError;
    }

    // Activate user_add_on
    const { data: userAddOn, error: addOnError } = await supabaseAdmin
      .from('user_add_ons')
      .update({
        is_active: true,
        payment_status: 'completed',
        payment_completed_at: new Date().toISOString(),
      })
      .eq('order_id', order_id)
      .select('*, add_on:add_ons(*)')
      .single();

    if (addOnError) {
      console.error('Error activating add-on:', addOnError);
      throw addOnError;
    }

    console.log('Add-on activated successfully:', userAddOn);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Add-on activated',
        payment,
        user_add_on: userAddOn,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in addon-payment-confirmation:', error);
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
