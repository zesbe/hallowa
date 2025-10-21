import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface Plan {
  id: string;
  name: string;
  price: number;
  max_devices: number;
  max_contacts: number;
  max_broadcasts: number;
  features: string[];
  is_active: boolean;
}

interface Subscription {
  id: string;
  status: string;
  starts_at: string;
  expires_at: string | null;
  plan: Plan;
}

interface UsageStats {
  devices_count: number;
  contacts_count: number;
  broadcasts_count: number;
}

export const useSubscription = () => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageStats>({
    devices_count: 0,
    contacts_count: 0,
    broadcasts_count: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSubscription();
      fetchUsage();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchSubscription = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("user_subscriptions")
        .select(`
          id,
          status,
          starts_at,
          expires_at,
          plan_id,
          plans (
            id,
            name,
            price,
            max_devices,
            max_contacts,
            max_broadcasts,
            features,
            is_active
          )
        `)
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();

      if (error) throw error;

      if (data && data.plans) {
        setSubscription({
          id: data.id,
          status: data.status,
          starts_at: data.starts_at,
          expires_at: data.expires_at,
          plan: data.plans as Plan,
        });
      }
    } catch (error) {
      console.error("Error fetching subscription:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsage = async () => {
    if (!user) return;

    try {
      // Count devices
      const { count: devicesCount } = await supabase
        .from("devices")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      // Count contacts
      const { count: contactsCount } = await supabase
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      // Count broadcasts this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: broadcastsCount } = await supabase
        .from("broadcasts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", startOfMonth.toISOString());

      setUsage({
        devices_count: devicesCount || 0,
        contacts_count: contactsCount || 0,
        broadcasts_count: broadcastsCount || 0,
      });
    } catch (error) {
      console.error("Error fetching usage:", error);
    }
  };

  const hasFeature = (featureName: string): boolean => {
    if (!subscription || !subscription.plan) return false;
    return Array.isArray(subscription.plan.features) && 
           subscription.plan.features.includes(featureName);
  };

  const canAddDevice = (): boolean => {
    if (!subscription || !subscription.plan) return false;
    return usage.devices_count < subscription.plan.max_devices;
  };

  const canAddContact = (): boolean => {
    if (!subscription || !subscription.plan) return false;
    return usage.contacts_count < subscription.plan.max_contacts;
  };

  const canCreateBroadcast = (): boolean => {
    if (!subscription || !subscription.plan) return false;
    return usage.broadcasts_count < subscription.plan.max_broadcasts;
  };

  const isLimitReached = (type: 'devices' | 'contacts' | 'broadcasts'): boolean => {
    if (!subscription || !subscription.plan) return true;
    
    switch (type) {
      case 'devices':
        return usage.devices_count >= subscription.plan.max_devices;
      case 'contacts':
        return usage.contacts_count >= subscription.plan.max_contacts;
      case 'broadcasts':
        return usage.broadcasts_count >= subscription.plan.max_broadcasts;
      default:
        return false;
    }
  };

  const getLimitPercentage = (type: 'devices' | 'contacts' | 'broadcasts'): number => {
    if (!subscription || !subscription.plan) return 0;
    
    switch (type) {
      case 'devices':
        return (usage.devices_count / subscription.plan.max_devices) * 100;
      case 'contacts':
        return (usage.contacts_count / subscription.plan.max_contacts) * 100;
      case 'broadcasts':
        return (usage.broadcasts_count / subscription.plan.max_broadcasts) * 100;
      default:
        return 0;
    }
  };

  const refreshUsage = () => {
    fetchUsage();
  };

  return {
    subscription,
    usage,
    loading,
    hasFeature,
    canAddDevice,
    canAddContact,
    canCreateBroadcast,
    isLimitReached,
    getLimitPercentage,
    refreshUsage,
  };
};
