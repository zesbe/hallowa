export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          api_key: string
          api_key_hash: string | null
          api_key_prefix: string | null
          created_at: string
          id: string
          is_active: boolean | null
          key_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          api_key_hash?: string | null
          api_key_prefix?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          key_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          api_key_hash?: string | null
          api_key_prefix?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          key_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      broadcasts: {
        Row: {
          batch_size: number | null
          created_at: string
          delay_seconds: number | null
          delay_type: string | null
          device_id: string
          failed_count: number | null
          id: string
          media_url: string | null
          message: string
          name: string
          pause_between_batches: number | null
          randomize_delay: boolean | null
          scheduled_at: string | null
          sent_count: number | null
          status: string
          target_contacts: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          batch_size?: number | null
          created_at?: string
          delay_seconds?: number | null
          delay_type?: string | null
          device_id: string
          failed_count?: number | null
          id?: string
          media_url?: string | null
          message: string
          name: string
          pause_between_batches?: number | null
          randomize_delay?: boolean | null
          scheduled_at?: string | null
          sent_count?: number | null
          status?: string
          target_contacts: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          batch_size?: number | null
          created_at?: string
          delay_seconds?: number | null
          delay_type?: string | null
          device_id?: string
          failed_count?: number | null
          id?: string
          media_url?: string | null
          message?: string
          name?: string
          pause_between_batches?: number | null
          randomize_delay?: boolean | null
          scheduled_at?: string | null
          sent_count?: number | null
          status?: string
          target_contacts?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcasts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_rules: {
        Row: {
          created_at: string
          device_id: string
          id: string
          is_active: boolean | null
          match_type: string
          response_text: string
          trigger_text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          id?: string
          is_active?: boolean | null
          match_type?: string
          response_text: string
          trigger_text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          id?: string
          is_active?: boolean | null
          match_type?: string
          response_text?: string
          trigger_text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_rules_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          contact_count: number | null
          created_at: string
          device_id: string
          group_members: Json | null
          id: string
          is_group: boolean | null
          last_contacted_at: string | null
          name: string | null
          notes: string | null
          phone_number: string
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_count?: number | null
          created_at?: string
          device_id: string
          group_members?: Json | null
          id?: string
          is_group?: boolean | null
          last_contacted_at?: string | null
          name?: string | null
          notes?: string | null
          phone_number: string
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_count?: number | null
          created_at?: string
          device_id?: string
          group_members?: Json | null
          id?: string
          is_group?: boolean | null
          last_contacted_at?: string | null
          name?: string | null
          notes?: string | null
          phone_number?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          api_key: string | null
          connection_method: string | null
          created_at: string
          device_name: string
          id: string
          is_multidevice: boolean | null
          last_connected_at: string | null
          pairing_code: string | null
          phone_for_pairing: string | null
          phone_number: string | null
          qr_code: string | null
          server_id: string | null
          session_data: Json | null
          status: string
          updated_at: string
          user_id: string
          webhook_url: string | null
        }
        Insert: {
          api_key?: string | null
          connection_method?: string | null
          created_at?: string
          device_name: string
          id?: string
          is_multidevice?: boolean | null
          last_connected_at?: string | null
          pairing_code?: string | null
          phone_for_pairing?: string | null
          phone_number?: string | null
          qr_code?: string | null
          server_id?: string | null
          session_data?: Json | null
          status?: string
          updated_at?: string
          user_id: string
          webhook_url?: string | null
        }
        Update: {
          api_key?: string | null
          connection_method?: string | null
          created_at?: string
          device_name?: string
          id?: string
          is_multidevice?: boolean | null
          last_connected_at?: string | null
          pairing_code?: string | null
          phone_for_pairing?: string | null
          phone_number?: string | null
          qr_code?: string | null
          server_id?: string | null
          session_data?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      message_history: {
        Row: {
          broadcast_id: string | null
          contact_phone: string
          content: string
          created_at: string
          device_id: string
          id: string
          media_url: string | null
          message_type: string
          user_id: string
        }
        Insert: {
          broadcast_id?: string | null
          contact_phone: string
          content: string
          created_at?: string
          device_id: string
          id?: string
          media_url?: string | null
          message_type: string
          user_id: string
        }
        Update: {
          broadcast_id?: string | null
          contact_phone?: string
          content?: string
          created_at?: string
          device_id?: string
          id?: string
          media_url?: string | null
          message_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_history_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "broadcasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_history_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          content: string
          created_at: string
          id: string
          media_type: string | null
          media_url: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string
          expired_at: string | null
          fee: number
          id: string
          order_id: string
          payment_method: string
          payment_number: string | null
          plan_id: string | null
          status: string
          total_payment: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string
          expired_at?: string | null
          fee?: number
          id?: string
          order_id: string
          payment_method: string
          payment_number?: string | null
          plan_id?: string | null
          status?: string
          total_payment: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string
          expired_at?: string | null
          fee?: number
          id?: string
          order_id?: string
          payment_method?: string
          payment_number?: string | null
          plan_id?: string | null
          status?: string
          total_payment?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          description: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          max_broadcasts: number
          max_contacts: number
          max_devices: number
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_broadcasts?: number
          max_contacts?: number
          max_devices?: number
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_broadcasts?: number
          max_contacts?: number
          max_devices?: number
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone_number: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone_number?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          plan_id: string | null
          starts_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_id?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_id?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          created_at: string
          device_id: string
          events: Json
          id: string
          is_active: boolean | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          events: Json
          id?: string
          is_active?: boolean | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          events?: Json
          id?: string
          is_active?: boolean | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_api_key: { Args: never; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
