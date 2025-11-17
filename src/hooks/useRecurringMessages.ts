import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface RecurringMessage {
  id: string;
  user_id: string;
  device_id: string;
  name: string;
  message: string;
  media_url?: string;
  target_contacts: any[];
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  interval_value: number;
  days_of_week: number[];
  day_of_month?: number;
  time_of_day: string;
  timezone: string;
  start_date: string;
  end_date?: string;
  is_active: boolean;
  last_sent_at?: string;
  next_send_at?: string;
  total_sent: number;
  total_failed: number;
  max_executions?: number;
  delay_type: 'auto' | 'manual' | 'adaptive';
  delay_seconds: number;
  randomize_delay: boolean;
  batch_size: number;
  pause_between_batches: number;
  created_at: string;
  updated_at: string;
}

export const useRecurringMessages = () => {
  const queryClient = useQueryClient();

  const { data: recurringMessages = [], isLoading, error, refetch } = useQuery({
    queryKey: ['recurring-messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as RecurringMessage[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (newMessage: Partial<RecurringMessage>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { user_id, id, created_at, updated_at, ...insertData } = newMessage as any;

      const { data, error } = await supabase
        .from('recurring_messages')
        .insert({
          ...insertData,
          user_id: user.id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-messages'] });
      toast.success('Recurring message created successfully!');
    },
    onError: (error: any) => {
      toast.error('Failed to create recurring message', {
        description: error.message
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<RecurringMessage> }) => {
      const { data, error } = await supabase
        .from('recurring_messages')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-messages'] });
      toast.success('Recurring message updated successfully!');
    },
    onError: (error: any) => {
      toast.error('Failed to update recurring message', {
        description: error.message
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('recurring_messages')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-messages'] });
      toast.success('Recurring message deleted successfully!');
    },
    onError: (error: any) => {
      toast.error('Failed to delete recurring message', {
        description: error.message
      });
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('recurring_messages')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recurring-messages'] });
      toast.success(variables.is_active ? 'Recurring message activated!' : 'Recurring message paused!');
    },
    onError: (error: any) => {
      toast.error('Failed to toggle recurring message', {
        description: error.message
      });
    }
  });

  return {
    recurringMessages,
    isLoading,
    error,
    refetch,
    createRecurringMessage: createMutation.mutateAsync,
    updateRecurringMessage: updateMutation.mutateAsync,
    deleteRecurringMessage: deleteMutation.mutateAsync,
    toggleActive: toggleActiveMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isToggling: toggleActiveMutation.isPending,
  };
};