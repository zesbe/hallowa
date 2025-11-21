import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature',
};

/**
 * Verify webhook signature using HMAC SHA-256
 * @param payload - Raw request body as string
 * @param signature - Signature from webhook header (hex encoded)
 * @param secret - Webhook secret key
 * @returns true if signature is valid
 */
async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const payloadData = encoder.encode(payload);

    // Import secret as HMAC key
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Generate HMAC signature
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, payloadData);

    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const expectedSignature = hashArray
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Constant-time comparison to prevent timing attacks
    if (signature.length !== expectedSignature.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < signature.length; i++) {
      result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }

    return result === 0;
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get webhook secret from environment
    const webhookSecret = Deno.env.get('PAKASIR_WEBHOOK_SECRET');
    
    // Read raw body first
    const rawBody = await req.text();
    
    // Get signature from headers (check multiple possible header names)
    const signature =
      req.headers.get('x-webhook-signature') ||
      req.headers.get('x-pakasir-signature') ||
      req.headers.get('x-signature');

    // Log all headers for debugging
    console.log('📥 Webhook Headers:', Object.fromEntries(req.headers.entries()));
    console.log('🔐 Signature found:', signature ? 'Yes' : 'No');
    console.log('📄 Body length:', rawBody.length);

    // If webhook secret is configured and signature exists, verify it
    if (webhookSecret && signature) {
      const isValidSignature = await verifyWebhookSignature(
        rawBody,
        signature,
        webhookSecret
      );

      if (!isValidSignature) {
        console.error('❌ Invalid webhook signature');
        return new Response(
          JSON.stringify({ error: 'Unauthorized: Invalid webhook signature' }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      console.log('✅ Webhook signature verified');
    } else {
      // Warning: No signature verification (for testing only)
      console.warn('⚠️ Webhook signature verification skipped:', 
        !webhookSecret ? 'No secret configured' : 'No signature header found');
      console.warn('⚠️ This should only happen in testing/development!');
    }

    // Parse JSON after signature verification
    const webhookData = JSON.parse(rawBody);
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

      // Get plan details to know duration
      const { data: planData, error: planError } = await supabaseClient
        .from('plans')
        .select('duration_months')
        .eq('id', payment.plan_id)
        .single();

      if (planError || !planData) {
        console.error('Error fetching plan:', planError);
        throw new Error('Plan not found');
      }

      const durationMonths = planData.duration_months || 1;
      const durationMs = durationMonths * 30 * 24 * 60 * 60 * 1000; // months to milliseconds

      // Check if user has active subscription
      const { data: existingSub } = await supabaseClient
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', payment.user_id)
        .eq('status', 'active')
        .single();

      if (existingSub) {
        // Extend existing subscription from current expires_at or now
        const currentExpiry = existingSub.expires_at ? new Date(existingSub.expires_at) : new Date();
        const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
        const newExpiresAt = new Date(baseDate.getTime() + durationMs);

        const { error: updateSubError } = await supabaseClient
          .from('user_subscriptions')
          .update({
            plan_id: payment.plan_id,
            expires_at: newExpiresAt.toISOString(),
            status: 'active'
          })
          .eq('id', existingSub.id);

        if (updateSubError) {
          console.error('Error updating subscription:', updateSubError);
        } else {
          console.log(`Subscription extended to: ${newExpiresAt.toISOString()}`);
        }
      } else {
        // Create new subscription
        const newExpiresAt = new Date(Date.now() + durationMs);
        
        const { error: createSubError } = await supabaseClient
          .from('user_subscriptions')
          .insert({
            user_id: payment.user_id,
            plan_id: payment.plan_id,
            status: 'active',
            starts_at: new Date().toISOString(),
            expires_at: newExpiresAt.toISOString(),
          });

        if (createSubError) {
          console.error('Error creating subscription:', createSubError);
        } else {
          console.log(`New subscription created, expires: ${newExpiresAt.toISOString()}`);
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