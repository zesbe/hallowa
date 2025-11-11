import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting reminder check...');

    // Get all active reminders
    const { data: reminders, error: remindersError } = await supabase
      .from('reminder_configs')
      .select('*')
      .eq('is_active', true)
      .eq('auto_send', true);

    if (remindersError) {
      console.error('Error fetching reminders:', remindersError);
      throw remindersError;
    }

    console.log(`Found ${reminders?.length || 0} active reminders`);

    let totalScheduled = 0;

    for (const reminder of reminders || []) {
      console.log(`Processing reminder: ${reminder.name}`);

      // Get users based on target segment
      let usersQuery = supabase
        .from('user_subscriptions')
        .select(`
          user_id, 
          expires_at, 
          plan_id,
          profiles!inner(full_name, phone_number),
          plans!inner(name)
        `)
        .eq('status', 'active');

      if (reminder.target_segment === 'expiring_soon') {
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
        
        usersQuery = usersQuery.lte('expires_at', sevenDaysFromNow.toISOString());
      } else if (reminder.target_segment === 'expired') {
        usersQuery = usersQuery.lt('expires_at', new Date().toISOString());
      }

      const { data: users, error: usersError } = await usersQuery;

      if (usersError) {
        console.error('Error fetching users:', usersError);
        continue;
      }

      console.log(`Found ${users?.length || 0} users for reminder: ${reminder.name}`);

      // Process each user
      for (const subscription of users || []) {
        const expiresAt = new Date(subscription.expires_at);
        const today = new Date();
        const daysUntilExpiry = Math.ceil((expiresAt.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // Check if we should send reminder for this user
        if (!reminder.trigger_days_before.includes(daysUntilExpiry)) {
          continue;
        }

        // Check if reminder already sent today
        const { data: existingLog } = await supabase
          .from('reminder_logs')
          .select('id')
          .eq('reminder_config_id', reminder.id)
          .eq('user_id', subscription.user_id)
          .gte('created_at', today.toISOString().split('T')[0])
          .single();

        if (existingLog) {
          console.log(`Reminder already sent today for user ${subscription.user_id}`);
          continue;
        }

        // Get user data
        const profile = Array.isArray(subscription.profiles) ? subscription.profiles[0] : subscription.profiles;
        const plan = Array.isArray(subscription.plans) ? subscription.plans[0] : subscription.plans;
        
        const phoneNumber = profile?.phone_number;
        if (!phoneNumber) {
          console.log(`No phone number for user ${subscription.user_id}`);
          continue;
        }

        // Replace variables in message template
        let message = reminder.message_template;
        message = message.replace(/\{\{name\}\}/g, profile?.full_name || 'Customer');
        message = message.replace(/\{\{days\}\}/g, daysUntilExpiry.toString());
        message = message.replace(/\{\{plan\}\}/g, plan?.name || 'Plan');
        message = message.replace(/\{\{expires_at\}\}/g, expiresAt.toLocaleDateString('id-ID'));

        // Schedule the message
        const scheduledTime = new Date();
        const [hours, minutes] = reminder.send_time.split(':');
        scheduledTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        // If send time has passed today, schedule for tomorrow
        if (scheduledTime < new Date()) {
          scheduledTime.setDate(scheduledTime.getDate() + 1);
        }

        // Insert into reminder logs
        const { error: logError } = await supabase
          .from('reminder_logs')
          .insert({
            reminder_config_id: reminder.id,
            user_id: subscription.user_id,
            recipient_phone: phoneNumber,
            recipient_name: profile?.full_name,
            message_sent: message,
            status: 'scheduled',
            scheduled_at: scheduledTime.toISOString(),
            metadata: {
              days_until_expiry: daysUntilExpiry,
              expires_at: subscription.expires_at,
              plan_name: plan?.name
            }
          });

        if (logError) {
          console.error('Error creating reminder log:', logError);
          continue;
        }

        // Queue the message
        const { error: queueError } = await supabase
          .from('message_queue')
          .insert({
            device_id: reminder.device_id,
            user_id: subscription.user_id,
            to_phone: phoneNumber,
            message: message,
            message_type: 'text',
            scheduled_at: scheduledTime.toISOString(),
            status: 'pending'
          });

        if (queueError) {
          console.error('Error queueing message:', queueError);
        } else {
          totalScheduled++;
          console.log(`Scheduled reminder for ${phoneNumber} at ${scheduledTime.toISOString()}`);
        }
      }

      // Update reminder stats
      await supabase
        .from('reminder_configs')
        .update({
          last_sent_at: new Date().toISOString()
        })
        .eq('id', reminder.id);
    }

    console.log(`Reminder check complete. Scheduled ${totalScheduled} messages.`);

    return new Response(
      JSON.stringify({
        success: true,
        reminders_processed: reminders?.length || 0,
        messages_scheduled: totalScheduled
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in check-reminders function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
