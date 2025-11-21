import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { crypto } from 'https://deno.land/std@0.224.0/crypto/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wc-webhook-signature, x-wc-webhook-topic, x-wc-webhook-source',
};

async function verifyWooCommerceWebhook(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const hmac = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(hmac)));
  
  return signature === base64Signature;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const signature = req.headers.get('x-wc-webhook-signature');
    const topic = req.headers.get('x-wc-webhook-topic');
    const source = req.headers.get('x-wc-webhook-source');

    console.log('WooCommerce webhook received:', { topic, source });

    const bodyText = await req.text();
    const data = JSON.parse(bodyText);

    // Extract domain from source URL
    const storeDomain = new URL(source || '').hostname;

    // Find integration by store domain
    const { data: integration } = await supabaseAdmin
      .from('integrations')
      .select('*')
      .eq('integration_type', 'woocommerce')
      .eq('is_active', true)
      .contains('config', { store_url: source })
      .maybeSingle();

    if (!integration) {
      console.error('No active WooCommerce integration found for store:', storeDomain);
      return new Response(JSON.stringify({ error: 'Integration not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify webhook signature
    const webhookSecret = integration.config.webhook_secret;
    if (signature && webhookSecret) {
      const isValid = await verifyWooCommerceWebhook(bodyText, signature, webhookSecret);
      if (!isValid) {
        console.error('Invalid WooCommerce webhook signature');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    console.log('Webhook signature verified');

    let message = '';
    let syncType = '';

    // Process webhook based on topic
    switch (topic) {
      case 'order.created':
      case 'order.updated':
        syncType = 'order_sync';
        const order = data;
        message = `🛍️ *Order ${topic === 'order.created' ? 'Baru' : 'Update'}!*\n\n` +
                 `Order ID: #${order.id}\n` +
                 `Customer: ${order.billing?.first_name || ''} ${order.billing?.last_name || ''}\n` +
                 `Phone: ${order.billing?.phone || '-'}\n` +
                 `Total: ${order.currency_symbol}${order.total}\n` +
                 `Status: ${order.status}\n\n` +
                 `Items:\n${order.line_items?.map((item: any) => `- ${item.name} (${item.quantity}x)`).join('\n')}`;
        
        // Sync customer to contacts
        if (order.billing?.phone) {
          await supabaseAdmin
            .from('contacts')
            .upsert({
              user_id: integration.user_id,
              phone_number: order.billing.phone.replace(/\D/g, ''),
              name: `${order.billing.first_name || ''} ${order.billing.last_name || ''}`.trim(),
              notes: `WooCommerce Order #${order.id}`,
              tags: ['woocommerce', 'customer'],
              var1: order.billing.email,
              var2: order.billing.city,
              var3: order.total,
            }, {
              onConflict: 'user_id,phone_number'
            });
        }
        break;

      case 'order.completed':
        syncType = 'order_sync';
        message = `✅ *Order Selesai!*\n\n` +
                 `Order ID: #${data.id}\n` +
                 `Customer: ${data.billing?.first_name} ${data.billing?.last_name}\n` +
                 `Total: ${data.currency_symbol}${data.total}`;
        break;

      case 'customer.created':
      case 'customer.updated':
        syncType = 'customer_sync';
        const customer = data;
        if (customer.billing?.phone) {
          await supabaseAdmin
            .from('contacts')
            .upsert({
              user_id: integration.user_id,
              phone_number: customer.billing.phone.replace(/\D/g, ''),
              name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
              notes: `WooCommerce Customer ID: ${customer.id}`,
              tags: ['woocommerce', 'customer'],
              var1: customer.email,
            }, {
              onConflict: 'user_id,phone_number'
            });
        }
        message = `👤 Customer ${topic === 'customer.created' ? 'Baru' : 'Update'}: ${customer.first_name} ${customer.last_name}`;
        break;

      case 'product.updated':
        syncType = 'stock_sync';
        const product = data;
        if (product.stock_quantity !== null && product.stock_quantity <= 5) {
          message = `⚠️ *Stock Alert!*\n\n` +
                   `Product: ${product.name}\n` +
                   `Stock: ${product.stock_quantity} remaining`;
        }
        break;

      default:
        console.log('Unhandled webhook topic:', topic);
    }

    // Send WhatsApp notification if message is generated
    if (message && integration.config.device_id) {
      const notifyPhone = integration.config.notify_phone;
      if (notifyPhone) {
        await supabaseAdmin
          .from('message_queue')
          .insert({
            user_id: integration.user_id,
            device_id: integration.config.device_id,
            to_phone: notifyPhone,
            message: message,
            message_type: 'text',
            scheduled_at: new Date().toISOString(),
          });
        
        console.log('WhatsApp notification queued');
      }
    }

    // Log sync activity
    if (syncType) {
      await supabaseAdmin
        .from('integration_logs')
        .insert({
          user_id: integration.user_id,
          integration_id: integration.id,
          sync_type: syncType,
          status: 'success',
          items_processed: 1,
          items_failed: 0,
          details: { topic, source, data },
        });
    }

    // Update last sync time
    await supabaseAdmin.rpc('update_integration_sync', {
      p_integration_id: integration.id,
      p_status: 'idle',
      p_error_message: null,
    });

    console.log('WooCommerce webhook processed successfully');

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in woocommerce-webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
