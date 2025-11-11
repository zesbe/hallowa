/**
 * Contact Service
 * Handles all contact-related API operations
 */

import { supabase } from '@/integrations/supabase/client';
import type { Contact, CreateContactDTO, ContactType } from '@/types';

class ContactServiceError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'ContactServiceError';
  }
}

export class ContactService {
  /**
   * Get all contacts for current user
   */
  static async getAll(): Promise<Contact[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ContactServiceError('User not authenticated');

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', user.id)
      .order('name', { ascending: true });

    if (error) throw new ContactServiceError(error.message, error.code);
    return data as Contact[];
  }

  /**
   * Get contact by phone number
   */
  static async getByPhone(phoneNumber: string): Promise<Contact | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ContactServiceError('User not authenticated');

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', user.id)
      .eq('phone_number', phoneNumber)
      .maybeSingle();

    if (error) throw new ContactServiceError(error.message, error.code);
    return data as Contact | null;
  }

  /**
   * Get contacts by type
   */
  static async getByType(type: ContactType): Promise<Contact[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ContactServiceError('User not authenticated');

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', type)
      .order('name', { ascending: true });

    if (error) throw new ContactServiceError(error.message, error.code);
    return data as Contact[];
  }

  /**
   * Create new contact
   */
  static async create(contact: CreateContactDTO): Promise<Contact> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ContactServiceError('User not authenticated');

    const { data, error } = await supabase
      .from('contacts')
      .insert({
        user_id: user.id,
        phone_number: contact.phone_number,
        name: contact.name,
        type: contact.type,
        group_id: contact.group_id || null,
        var1: contact.var1 || null,
        var2: contact.var2 || null,
        var3: contact.var3 || null
      })
      .select()
      .single();

    if (error) throw new ContactServiceError(error.message, error.code);
    return data as Contact;
  }

  /**
   * Update contact
   */
  static async update(contactId: string, updates: Partial<Contact>): Promise<Contact> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ContactServiceError('User not authenticated');

    const { data, error } = await supabase
      .from('contacts')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', contactId)
      .eq('user_id', user.id)  // ✅ SECURITY: Verify ownership
      .select()
      .single();

    if (error) throw new ContactServiceError(error.message, error.code);
    return data as Contact;
  }

  /**
   * Delete contact
   */
  static async delete(contactId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ContactServiceError('User not authenticated');

    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', contactId)
      .eq('user_id', user.id);  // ✅ SECURITY: Verify ownership

    if (error) throw new ContactServiceError(error.message, error.code);
  }

  /**
   * Bulk create contacts
   */
  static async bulkCreate(contacts: CreateContactDTO[]): Promise<Contact[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ContactServiceError('User not authenticated');

    const contactsToInsert = contacts.map(contact => ({
      user_id: user.id,
      phone_number: contact.phone_number,
      name: contact.name,
      type: contact.type,
      group_id: contact.group_id || null,
      var1: contact.var1 || null,
      var2: contact.var2 || null,
      var3: contact.var3 || null
    }));

    const { data, error } = await supabase
      .from('contacts')
      .insert(contactsToInsert)
      .select();

    if (error) throw new ContactServiceError(error.message, error.code);
    return data as Contact[];
  }

  /**
   * Delete multiple contacts
   */
  static async bulkDelete(contactIds: string[]): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ContactServiceError('User not authenticated');

    const { error } = await supabase
      .from('contacts')
      .delete()
      .in('id', contactIds)
      .eq('user_id', user.id);  // ✅ SECURITY: Verify ownership

    if (error) throw new ContactServiceError(error.message, error.code);
  }

  /**
   * Search contacts
   */
  static async search(searchTerm: string): Promise<Contact[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ContactServiceError('User not authenticated');

    // ✅ SECURITY: Sanitize search term to prevent injection
    const sanitized = searchTerm.replace(/[%_]/g, '');

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', user.id)
      .or(`name.ilike.%${sanitized}%,phone_number.ilike.%${sanitized}%`)
      .order('name', { ascending: true });

    if (error) throw new ContactServiceError(error.message, error.code);
    return data as Contact[];
  }
}

export const contactService = ContactService;
