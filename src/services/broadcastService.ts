/**
 * Broadcast Service
 * Handles all broadcast-related API operations
 */

import { supabase } from '@/integrations/supabase/client';
import type { Broadcast, CreateBroadcastDTO } from '@/types';

class BroadcastServiceError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'BroadcastServiceError';
  }
}

export class BroadcastService {
  /**
   * Get all broadcasts for current user
   */
  static async getAll(): Promise<Broadcast[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new BroadcastServiceError('User not authenticated');

    const { data, error } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw new BroadcastServiceError(error.message, error.code);
    return data as Broadcast[];
  }

  /**
   * Get broadcast by ID
   */
  static async getById(broadcastId: string): Promise<Broadcast> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new BroadcastServiceError('User not authenticated');

    const { data, error } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('id', broadcastId)
      .eq('user_id', user.id)  // ✅ SECURITY: Verify ownership
      .single();

    if (error) throw new BroadcastServiceError(error.message, error.code);
    return data as Broadcast;
  }

  /**
   * Create new broadcast
   */
  static async create(broadcast: CreateBroadcastDTO): Promise<Broadcast> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new BroadcastServiceError('User not authenticated');

    // ✅ SECURITY: Verify device ownership before creating broadcast
    const { data: device } = await supabase
      .from('devices')
      .select('id')
      .eq('id', broadcast.device_id)
      .eq('user_id', user.id)
      .single();

    if (!device) {
      throw new BroadcastServiceError('Device not found or access denied');
    }

    const { data, error } = await supabase
      .from('broadcasts')
      .insert({
        user_id: user.id,
        device_id: broadcast.device_id,
        name: broadcast.name,
        message: broadcast.message,
        media_url: broadcast.media_url || null,
        target_contacts: broadcast.target_contacts,
        scheduled_at: broadcast.scheduled_at || null,
        delay_type: broadcast.delay_type || 'auto',
        delay_seconds: broadcast.delay_seconds || 5,
        randomize_delay: broadcast.randomize_delay !== false,
        batch_size: broadcast.batch_size || 20,
        pause_between_batches: broadcast.pause_between_batches || 60,
        status: broadcast.scheduled_at ? 'draft' : 'processing',
        sent_count: 0,
        failed_count: 0
      })
      .select()
      .single();

    if (error) throw new BroadcastServiceError(error.message, error.code);
    return data as Broadcast;
  }

  /**
   * Update broadcast
   */
  static async update(broadcastId: string, updates: Partial<Broadcast>): Promise<Broadcast> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new BroadcastServiceError('User not authenticated');

    const { data, error } = await supabase
      .from('broadcasts')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', broadcastId)
      .eq('user_id', user.id)  // ✅ SECURITY: Verify ownership
      .select()
      .single();

    if (error) throw new BroadcastServiceError(error.message, error.code);
    return data as Broadcast;
  }

  /**
   * Delete broadcast
   */
  static async delete(broadcastId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new BroadcastServiceError('User not authenticated');

    const { error } = await supabase
      .from('broadcasts')
      .delete()
      .eq('id', broadcastId)
      .eq('user_id', user.id);  // ✅ SECURITY: Verify ownership

    if (error) throw new BroadcastServiceError(error.message, error.code);
  }

  /**
   * Send broadcast immediately
   */
  static async send(broadcastId: string): Promise<void> {
    await this.update(broadcastId, { status: 'processing' });
  }

  /**
   * Cancel broadcast
   */
  static async cancel(broadcastId: string): Promise<void> {
    await this.update(broadcastId, { status: 'draft' });
  }

  /**
   * Get broadcasts by status
   */
  static async getByStatus(status: Broadcast['status']): Promise<Broadcast[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new BroadcastServiceError('User not authenticated');

    const { data, error } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) throw new BroadcastServiceError(error.message, error.code);
    return data as Broadcast[];
  }

  /**
   * Get scheduled broadcasts
   */
  static async getScheduled(): Promise<Broadcast[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new BroadcastServiceError('User not authenticated');

    const { data, error } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'draft')
      .not('scheduled_at', 'is', null)
      .order('scheduled_at', { ascending: true });

    if (error) throw new BroadcastServiceError(error.message, error.code);
    return data as Broadcast[];
  }
}

export const broadcastService = BroadcastService;
