import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Integration {
  id: string;
  user_id: string;
  integration_type: string;
  config: any;
  is_active: boolean;
  last_sync_at: string | null;
  sync_status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrationLog {
  id: string;
  user_id: string;
  integration_id: string;
  sync_type: string;
  status: string;
  items_processed: number;
  items_failed: number;
  details: any;
  error_message: string | null;
  created_at: string;
}

export function useIntegrations() {
  const queryClient = useQueryClient();

  const { data: integrations, isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Integration[];
    },
  });

  const { data: logs, isLoading: isLoadingLogs } = useQuery({
    queryKey: ['integration-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integration_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as IntegrationLog[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (integration: Partial<Integration>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('integrations')
        .insert([{ ...integration, user_id: user.id } as any])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('Integrasi berhasil dibuat!');
    },
    onError: () => toast.error('Gagal membuat integrasi'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Integration> & { id: string }) => {
      const { data, error } = await supabase
        .from('integrations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('Integrasi berhasil diupdate!');
    },
    onError: () => toast.error('Gagal mengupdate integrasi'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('integrations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('Integrasi berhasil dihapus!');
    },
    onError: () => toast.error('Gagal menghapus integrasi'),
  });

  return {
    integrations: integrations || [],
    logs: logs || [],
    isLoading: isLoading || isLoadingLogs,
    createIntegration: createMutation.mutateAsync,
    updateIntegration: updateMutation.mutateAsync,
    deleteIntegration: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
