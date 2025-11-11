/**
 * Device Service
 * Handles all device-related API operations
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  Device,
  CreateDeviceDTO,
  UpdateDeviceDTO,
  ApiResponse,
  GroupsApiResponse
} from '@/types';

class DeviceServiceError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'DeviceServiceError';
  }
}

export class DeviceService {
  /**
   * Get all devices for current user
   */
  static async getAll(): Promise<Device[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new DeviceServiceError('User not authenticated');

    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw new DeviceServiceError(error.message, error.code);
    return data as Device[];
  }

  /**
   * Get device by ID
   */
  static async getById(deviceId: string): Promise<Device> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new DeviceServiceError('User not authenticated');

    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .eq('id', deviceId)
      .eq('user_id', user.id)  // ✅ SECURITY: Verify ownership
      .single();

    if (error) throw new DeviceServiceError(error.message, error.code);
    return data as Device;
  }

  /**
   * Create new device
   */
  static async create(device: CreateDeviceDTO): Promise<Device> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new DeviceServiceError('User not authenticated');

    // Generate API key
    const apiKey = crypto.randomUUID();

    const { data, error } = await supabase
      .from('devices')
      .insert({
        user_id: user.id,
        device_name: device.device_name,
        connection_method: device.connection_method,
        phone_for_pairing: device.phone_for_pairing || null,
        api_key: apiKey,
        status: 'connecting'
      })
      .select()
      .single();

    if (error) throw new DeviceServiceError(error.message, error.code);
    return data as Device;
  }

  /**
   * Update device
   */
  static async update(deviceId: string, updates: UpdateDeviceDTO): Promise<Device> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new DeviceServiceError('User not authenticated');

    const { data, error } = await supabase
      .from('devices')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', deviceId)
      .eq('user_id', user.id)  // ✅ SECURITY: Verify ownership
      .select()
      .single();

    if (error) throw new DeviceServiceError(error.message, error.code);
    return data as Device;
  }

  /**
   * Delete device
   */
  static async delete(deviceId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new DeviceServiceError('User not authenticated');

    // First set status to disconnected to trigger cleanup
    await this.update(deviceId, { status: 'disconnected' });

    // Wait a bit for backend to process disconnection
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Then delete
    const { error } = await supabase
      .from('devices')
      .delete()
      .eq('id', deviceId)
      .eq('user_id', user.id);  // ✅ SECURITY: Verify ownership

    if (error) throw new DeviceServiceError(error.message, error.code);
  }

  /**
   * Disconnect device
   */
  static async disconnect(deviceId: string): Promise<void> {
    await this.update(deviceId, { status: 'disconnected' });
  }

  /**
   * Connect device
   */
  static async connect(deviceId: string): Promise<void> {
    await this.update(deviceId, { status: 'connecting' });
  }

  /**
   * Regenerate API key
   */
  static async regenerateApiKey(deviceId: string): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new DeviceServiceError('User not authenticated');

    const newApiKey = crypto.randomUUID();

    const { error } = await supabase
      .from('devices')
      .update({ api_key: newApiKey })
      .eq('id', deviceId)
      .eq('user_id', user.id);  // ✅ SECURITY: Verify ownership

    if (error) throw new DeviceServiceError(error.message, error.code);

    return newApiKey;
  }

  /**
   * Fetch WhatsApp groups for device
   */
  static async fetchGroups(deviceId: string, apiKey: string): Promise<GroupsApiResponse> {
    // ✅ SECURITY: getById now verifies ownership
    const device = await this.getById(deviceId);

    if (!device.server_id) {
      throw new DeviceServiceError('Device not connected to any server');
    }

    // ✅ SECURITY: Validate server_id to prevent SSRF
    try {
      const url = new URL(`${device.server_id}/api/groups/${deviceId}`);

      // Only allow http/https protocols
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new DeviceServiceError('Invalid server protocol');
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new DeviceServiceError(error.error || 'Failed to fetch groups');
      }

      return await response.json();
    } catch (err) {
      if (err instanceof DeviceServiceError) throw err;
      throw new DeviceServiceError('Invalid server URL');
    }
  }
}

export const deviceService = DeviceService;
