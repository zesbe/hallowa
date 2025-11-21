import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ChatbotRule {
  id: string;
  user_id: string;
  device_id: string;
  rule_name: string;
  trigger_type: string;
  trigger_value: string | null;
  ai_enabled: boolean;
  ai_model: string;
  ai_prompt: string | null;
  response_type: string;
  response_text: string | null;
  response_template_id: string | null;
  is_active: boolean;
  priority: number;
  execution_count: number;
  last_executed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useChatbotRules(deviceId?: string) {
  const queryClient = useQueryClient();

  const { data: rules, isLoading } = useQuery({
    queryKey: ['chatbot-rules', deviceId],
    queryFn: async () => {
      let query = supabase
        .from('chatbot_ai_rules')
        .select('*')
        .order('priority', { ascending: false });

      if (deviceId) {
        query = query.eq('device_id', deviceId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ChatbotRule[];
    },
    enabled: !!deviceId,
  });

  const createMutation = useMutation({
    mutationFn: async (rule: Partial<ChatbotRule>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('chatbot_ai_rules')
        .insert([{ ...rule, user_id: user.id } as any])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatbot-rules'] });
      toast.success('Chatbot rule berhasil dibuat!');
    },
    onError: () => toast.error('Gagal membuat chatbot rule'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ChatbotRule> & { id: string }) => {
      const { data, error } = await supabase
        .from('chatbot_ai_rules')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatbot-rules'] });
      toast.success('Chatbot rule berhasil diupdate!');
    },
    onError: () => toast.error('Gagal mengupdate chatbot rule'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('chatbot_ai_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatbot-rules'] });
      toast.success('Chatbot rule berhasil dihapus!');
    },
    onError: () => toast.error('Gagal menghapus chatbot rule'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('chatbot_ai_rules')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatbot-rules'] });
      toast.success('Status rule berhasil diubah!');
    },
    onError: () => toast.error('Gagal mengubah status rule'),
  });

  return {
    rules: rules || [],
    isLoading,
    createRule: createMutation.mutateAsync,
    updateRule: updateMutation.mutateAsync,
    deleteRule: deleteMutation.mutateAsync,
    toggleActive: toggleActiveMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isToggling: toggleActiveMutation.isPending,
  };
}
