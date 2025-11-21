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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { 
      gateway,
      transaction_id, 
      order_id, 
      amount, 
      status, 
      customer_phone,
      customer_name,
      customer_email 
    } = await req.json();

    console.log('Payment confirmation received:', { gateway, transaction_id, order_id, status });

    // Find integration
    const { data: integration } = await supabaseAdmin
      .from('integrations')
      .select('*')
      .eq('integration_type', 'payment_gateway')
      .eq('is_active', true)
      .contains('config', { gateway })
      .maybeSingle();

    if (!integration) {
      console.error('No active payment gateway integration found:', gateway);
      return new Response(JSON.stringify({ error: 'Integration not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let message = '';
    const statusEmoji = status === 'paid' || status === 'success' ? '✅' : 
                       status === 'pending' ? '⏳' : 
                       status === 'failed' ? '❌' : '🔔';

    // Build confirmation message
    if (status === 'paid' || status === 'success') {
      message = `${statusEmoji} *Pembayaran Berhasil!*\n\n` +
               `Order ID: ${order_id}\n` +
               `Transaction ID: ${transaction_id}\n` +
               `Customer: ${customer_name}\n` +
               `Email: ${customer_email}\n` +
               `Amount: Rp ${parseInt(amount).toLocaleString('id-ID')}\n` +
               `Gateway: ${gateway.toUpperCase()}\n` +
               `Status: PAID\n\n` +
               `Terima kasih atas pembayaran Anda! 🙏`;
    } else if (status === 'pending') {
      message = `${statusEmoji} *Menunggu Pembayaran*\n\n` +
               `Order ID: ${order_id}\n` +
               `Customer: ${customer_name}\n` +
               `Amount: Rp ${parseInt(amount).toLocaleString('id-ID')}\n` +
               `Gateway: ${gateway.toUpperCase()}\n\n` +
               `Silakan selesaikan pembayaran Anda.`;
    } else if (status === 'failed' || status === 'expired') {
      message = `${statusEmoji} *Pembayaran Gagal*\n\n` +
               `Order ID: ${order_id}\n` +
               `Customer: ${customer_name}\n` +
               `Amount: Rp ${parseInt(amount).toLocaleString('id-ID')}\n` +
               `Status: ${status.toUpperCase()}\n\n` +
               `Mohon coba lagi atau hubungi customer service.`;
    }

    // Send WhatsApp notification if configured
    if (message && integration.config.device_id) {
      const notifyPhone = integration.config.notify_phone;
      const customerPhoneClean = customer_phone?.replace(/\D/g, '');
      
      // Send to admin
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
      }

      // Send to customer if phone provided and payment successful
      if (customerPhoneClean && (status === 'paid' || status === 'success')) {
        const customerMessage = message.replace('Terima kasih atas pembayaran Anda! 🙏', 
                                               'Pesanan Anda akan segera diproses. Terima kasih! 🙏');
        await supabaseAdmin
          .from('message_queue')
          .insert({
            user_id: integration.user_id,
            device_id: integration.config.device_id,
            to_phone: customerPhoneClean,
            message: customerMessage,
            message_type: 'text',
            scheduled_at: new Date().toISOString(),
          });

        // Add/update customer in contacts
        await supabaseAdmin
          .from('contacts')
          .upsert({
            user_id: integration.user_id,
            phone_number: customerPhoneClean,
            name: customer_name || 'Customer',
            notes: `Order ID: ${order_id}, Amount: Rp ${parseInt(amount).toLocaleString('id-ID')}`,
            tags: ['customer', gateway],
            var1: customer_email,
            var2: order_id,
            var3: amount.toString(),
          }, {
            onConflict: 'user_id,phone_number'
          });
      }
      
      console.log('WhatsApp notifications queued');
    }

    // Log payment confirmation
    await supabaseAdmin
      .from('integration_logs')
      .insert({
        user_id: integration.user_id,
        integration_id: integration.id,
        sync_type: 'payment_confirm',
        status: 'success',
        items_processed: 1,
        items_failed: 0,
        details: {
          gateway,
          transaction_id,
          order_id,
          amount,
          status,
          customer_phone,
          customer_name,
          customer_email,
        },
      });

    // Update last sync time
    await supabaseAdmin.rpc('update_integration_sync', {
      p_integration_id: integration.id,
      p_status: 'idle',
      p_error_message: null,
    });

    console.log('Payment confirmation processed successfully');

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Payment confirmation processed' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in payment-confirmation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
