import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AddOn {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  price: number;
  is_active: boolean;
  features: any;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface UserAddOn {
  id: string;
  user_id: string;
  add_on_id: string;
  purchased_at: string;
  expires_at: string | null;
  is_active: boolean;
  payment_id: string | null;
  payment_status: string;
  metadata: any;
  add_on?: AddOn;
}

export function useAddOns() {
  const queryClient = useQueryClient();

  // Fetch all available add-ons
  const { data: addOns, isLoading, error } = useQuery({
    queryKey: ['add-ons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('add_ons')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true });

      if (error) throw error;
      return data as AddOn[];
    },
  });

  // Fetch user's purchased add-ons + plan-included add-ons
  const { data: userAddOns, isLoading: isLoadingUserAddOns } = useQuery({
    queryKey: ['user-add-ons'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get directly purchased add-ons
      const { data: purchased, error: purchasedError } = await supabase
        .from('user_add_ons')
        .select('*, add_on:add_ons(*)')
        .eq('is_active', true)
        .eq('payment_status', 'completed')
        .order('purchased_at', { ascending: false });

      if (purchasedError) throw purchasedError;

      // Get plan-included add-ons
      const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select('plan_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      let planAddOns: any[] = [];
      if (subscription?.plan_id) {
        const { data: planAddOnsData } = await supabase
          .from('plan_add_ons')
          .select('add_on:add_ons(*)')
          .eq('plan_id', subscription.plan_id);

        if (planAddOnsData) {
          planAddOns = planAddOnsData.map(pa => ({
            id: `plan-${pa.add_on.id}`,
            user_id: user.id,
            add_on_id: pa.add_on.id,
            is_active: true,
            payment_status: 'included_in_plan',
            add_on: pa.add_on,
          }));
        }
      }

      return [...(purchased || []), ...planAddOns] as UserAddOn[];
    },
  });

  // Purchase add-on mutation - create payment transaction
  const purchaseMutation = useMutation({
    mutationFn: async ({ addOnId }: { addOnId: string }) => {
      const { data, error } = await supabase.functions.invoke('addon-create-transaction', {
        body: {
          add_on_id: addOnId,
          payment_method: 'qris'
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-add-ons'] });
    },
    onError: (error) => {
      console.error('Purchase error:', error);
      toast.error('Gagal membuat transaksi pembayaran');
    },
  });

  // Check if user has specific add-on (purchased OR plan-included)
  const hasAddOn = (slug: string): boolean => {
    if (!userAddOns) return false;
    return userAddOns.some(ua => 
      ua.add_on?.slug === slug && 
      ua.is_active && 
      (ua.payment_status === 'completed' || ua.payment_status === 'included_in_plan') &&
      (!ua.expires_at || new Date(ua.expires_at) > new Date())
    );
  };

  return {
    addOns: addOns || [],
    userAddOns: userAddOns || [],
    isLoading: isLoading || isLoadingUserAddOns,
    error,
    purchaseAddOn: purchaseMutation.mutateAsync,
    isPurchasing: purchaseMutation.isPending,
    hasAddOn,
  };
}

// Admin-only: Manage add-ons
export function useAdminAddOns() {
  const queryClient = useQueryClient();

  const { data: allAddOns, isLoading } = useQuery({
    queryKey: ['admin-add-ons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('add_ons')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as AddOn[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (addOn: Partial<AddOn>) => {
      const { data, error } = await supabase
        .from('add_ons')
        .insert([addOn as any])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-add-ons'] });
      toast.success('Add-on berhasil dibuat!');
    },
    onError: () => toast.error('Gagal membuat add-on'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AddOn> & { id: string }) => {
      const { data, error } = await supabase
        .from('add_ons')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-add-ons'] });
      toast.success('Add-on berhasil diupdate!');
    },
    onError: () => toast.error('Gagal mengupdate add-on'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('add_ons')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-add-ons'] });
      toast.success('Add-on berhasil dihapus!');
    },
    onError: () => toast.error('Gagal menghapus add-on'),
  });

  return {
    addOns: allAddOns || [],
    isLoading,
    createAddOn: createMutation.mutateAsync,
    updateAddOn: updateMutation.mutateAsync,
    deleteAddOn: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
