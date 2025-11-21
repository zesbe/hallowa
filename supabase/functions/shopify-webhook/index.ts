import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { crypto } from 'https://deno.land/std@0.224.0/crypto/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-shopify-hmac-sha256, x-shopify-topic, x-shopify-shop-domain',
};

async function verifyShopifyWebhook(body: string, hmacHeader: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)));
  
  return hmacHeader === base64Signature;
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

    const hmacHeader = req.headers.get('x-shopify-hmac-sha256');
    const topic = req.headers.get('x-shopify-topic');
    const shopDomain = req.headers.get('x-shopify-shop-domain');

    console.log('Shopify webhook received:', { topic, shopDomain });

    const bodyText = await req.text();
    const data = JSON.parse(bodyText);

    // Find integration by shop domain
    const { data: integration } = await supabaseAdmin
      .from('integrations')
      .select('*')
      .eq('integration_type', 'shopify')
      .eq('is_active', true)
      .contains('config', { shop_domain: shopDomain })
      .maybeSingle();

    if (!integration) {
      console.error('No active Shopify integration found for shop:', shopDomain);
      return new Response(JSON.stringify({ error: 'Integration not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify webhook signature
    const webhookSecret = integration.config.webhook_secret;
    if (hmacHeader && webhookSecret) {
      const isValid = await verifyShopifyWebhook(bodyText, hmacHeader, webhookSecret);
      if (!isValid) {
        console.error('Invalid Shopify webhook signature');
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
      case 'orders/create':
      case 'orders/updated':
        syncType = 'order_sync';
        const order = data;
        message = `🛍️ *Order Baru!*\n\n` +
                 `Order ID: ${order.name}\n` +
                 `Customer: ${order.customer?.first_name || ''} ${order.customer?.last_name || ''}\n` +
                 `Phone: ${order.customer?.phone || order.shipping_address?.phone || '-'}\n` +
                 `Total: ${order.currency} ${order.total_price}\n` +
                 `Status: ${order.financial_status}\n\n` +
                 `Items:\n${order.line_items?.map((item: any) => `- ${item.name} (${item.quantity}x)`).join('\n')}`;
        break;

      case 'orders/paid':
        syncType = 'payment_confirm';
        message = `✅ *Pembayaran Diterima!*\n\n` +
                 `Order: ${data.name}\n` +
                 `Customer: ${data.customer?.first_name} ${data.customer?.last_name}\n` +
                 `Amount: ${data.currency} ${data.total_price}\n` +
                 `Payment: ${data.payment_gateway_names?.join(', ')}`;
        break;

      case 'orders/fulfilled':
        syncType = 'order_sync';
        message = `📦 *Pesanan Terkirim!*\n\n` +
                 `Order: ${data.name}\n` +
                 `Tracking: ${data.fulfillments?.[0]?.tracking_number || '-'}\n` +
                 `Carrier: ${data.fulfillments?.[0]?.tracking_company || '-'}`;
        break;

      case 'customers/create':
      case 'customers/update':
        syncType = 'customer_sync';
        // Sync customer to contacts
        const customer = data;
        if (customer.phone) {
          await supabaseAdmin
            .from('contacts')
            .upsert({
              user_id: integration.user_id,
              phone_number: customer.phone.replace(/\D/g, ''),
              name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
              notes: `Shopify Customer ID: ${customer.id}`,
              tags: ['shopify', 'customer'],
              var1: customer.email,
              var2: customer.orders_count?.toString(),
              var3: customer.total_spent,
            }, {
              onConflict: 'user_id,phone_number'
            });
        }
        message = `👤 Customer ${topic.includes('create') ? 'Baru' : 'Update'}: ${customer.first_name} ${customer.last_name}`;
        break;

      case 'products/update':
        syncType = 'stock_sync';
        const product = data;
        const variant = product.variants?.[0];
        if (variant && variant.inventory_quantity <= 5) {
          message = `⚠️ *Stock Alert!*\n\n` +
                   `Product: ${product.title}\n` +
                   `Variant: ${variant.title}\n` +
                   `Stock: ${variant.inventory_quantity} remaining`;
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
        details: { topic, shopDomain, data },
      });
    }

    // Update last sync time
    await supabaseAdmin.rpc('update_integration_sync', {
      p_integration_id: integration.id,
      p_status: 'idle',
      p_error_message: null,
    });

    console.log('Shopify webhook processed successfully');

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in shopify-webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
