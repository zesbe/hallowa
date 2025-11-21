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
      add_ons: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: string
          price: number
          slug: string
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          price?: number
          slug: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          price?: number
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      admin_rate_limits: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          last_request_at: string
          operation_type: string
          request_count: number | null
          window_start: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          last_request_at?: string
          operation_type: string
          request_count?: number | null
          window_start?: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          last_request_at?: string
          operation_type?: string
          request_count?: number | null
          window_start?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          api_key: string | null
          api_key_hash: string
          api_key_prefix: string
          created_at: string
          id: string
          is_active: boolean | null
          key_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key?: string | null
          api_key_hash: string
          api_key_prefix: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          key_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string | null
          api_key_hash?: string
          api_key_prefix?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          key_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
        }
        Relationships: []
      }
      auth_audit_logs: {
        Row: {
          created_at: string
          email: string
          event_type: string
          failure_reason: string | null
          id: string
          ip_address: string | null
          login_method: string | null
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          event_type: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          login_method?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          event_type?: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          login_method?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      auto_post_schedules: {
        Row: {
          created_at: string
          delay_minutes: number | null
          device_id: string
          failed_count: number | null
          frequency: string
          id: string
          is_active: boolean | null
          last_sent_at: string | null
          media_url: string | null
          message: string
          name: string
          next_send_at: string | null
          random_delay: boolean | null
          schedule_days: number[] | null
          schedule_time: string
          selected_days: number[] | null
          send_count: number | null
          target_groups: Json
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delay_minutes?: number | null
          device_id: string
          failed_count?: number | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          media_url?: string | null
          message: string
          name: string
          next_send_at?: string | null
          random_delay?: boolean | null
          schedule_days?: number[] | null
          schedule_time: string
          selected_days?: number[] | null
          send_count?: number | null
          target_groups?: Json
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delay_minutes?: number | null
          device_id?: string
          failed_count?: number | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          media_url?: string | null
          message?: string
          name?: string
          next_send_at?: string | null
          random_delay?: boolean | null
          schedule_days?: number[] | null
          schedule_time?: string
          selected_days?: number[] | null
          send_count?: number | null
          target_groups?: Json
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      backend_servers: {
        Row: {
          allowed_ips: string[] | null
          api_key: string | null
          api_key_encrypted: boolean | null
          api_key_last_rotated: string | null
          created_at: string
          current_load: number | null
          health_check_failures: number | null
          id: string
          is_active: boolean | null
          is_healthy: boolean | null
          last_health_check: string | null
          max_capacity: number | null
          metadata: Json | null
          priority: number | null
          region: string | null
          response_time: number | null
          server_name: string
          server_type: string
          server_url: string
          updated_at: string
        }
        Insert: {
          allowed_ips?: string[] | null
          api_key?: string | null
          api_key_encrypted?: boolean | null
          api_key_last_rotated?: string | null
          created_at?: string
          current_load?: number | null
          health_check_failures?: number | null
          id?: string
          is_active?: boolean | null
          is_healthy?: boolean | null
          last_health_check?: string | null
          max_capacity?: number | null
          metadata?: Json | null
          priority?: number | null
          region?: string | null
          response_time?: number | null
          server_name: string
          server_type?: string
          server_url: string
          updated_at?: string
        }
        Update: {
          allowed_ips?: string[] | null
          api_key?: string | null
          api_key_encrypted?: boolean | null
          api_key_last_rotated?: string | null
          created_at?: string
          current_load?: number | null
          health_check_failures?: number | null
          id?: string
          is_active?: boolean | null
          is_healthy?: boolean | null
          last_health_check?: string | null
          max_capacity?: number | null
          metadata?: Json | null
          priority?: number | null
          region?: string | null
          response_time?: number | null
          server_name?: string
          server_type?: string
          server_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      broadcast_templates: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          message_template: string
          name: string
          updated_at: string
          usage_count: number | null
          variables: Json | null
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          message_template: string
          name: string
          updated_at?: string
          usage_count?: number | null
          variables?: Json | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          message_template?: string
          name?: string
          updated_at?: string
          usage_count?: number | null
          variables?: Json | null
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
      chatbot_ai_rules: {
        Row: {
          ai_enabled: boolean | null
          ai_model: string | null
          ai_prompt: string | null
          created_at: string | null
          device_id: string
          execution_count: number | null
          id: string
          is_active: boolean | null
          last_executed_at: string | null
          priority: number | null
          response_template_id: string | null
          response_text: string | null
          response_type: string | null
          rule_name: string
          trigger_type: string
          trigger_value: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_enabled?: boolean | null
          ai_model?: string | null
          ai_prompt?: string | null
          created_at?: string | null
          device_id: string
          execution_count?: number | null
          id?: string
          is_active?: boolean | null
          last_executed_at?: string | null
          priority?: number | null
          response_template_id?: string | null
          response_text?: string | null
          response_type?: string | null
          rule_name: string
          trigger_type?: string
          trigger_value?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_enabled?: boolean | null
          ai_model?: string | null
          ai_prompt?: string | null
          created_at?: string | null
          device_id?: string
          execution_count?: number | null
          id?: string
          is_active?: boolean | null
          last_executed_at?: string | null
          priority?: number | null
          response_template_id?: string | null
          response_text?: string | null
          response_type?: string | null
          rule_name?: string
          trigger_type?: string
          trigger_value?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_ai_rules_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_conversations: {
        Row: {
          contact_phone: string
          created_at: string | null
          device_id: string
          id: string
          last_message_at: string | null
          messages: Json | null
          user_id: string
        }
        Insert: {
          contact_phone: string
          created_at?: string | null
          device_id: string
          id?: string
          last_message_at?: string | null
          messages?: Json | null
          user_id: string
        }
        Update: {
          contact_phone?: string
          created_at?: string | null
          device_id?: string
          id?: string
          last_message_at?: string | null
          messages?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_conversations_device_id_fkey"
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
          birthday: string | null
          contact_count: number | null
          created_at: string
          device_id: string | null
          group_members: Json | null
          id: string
          is_group: boolean | null
          last_contacted_at: string | null
          name: string | null
          notes: string | null
          phone_number: string
          reminders: Json | null
          tags: string[] | null
          updated_at: string
          user_id: string
          var1: string | null
          var2: string | null
          var3: string | null
        }
        Insert: {
          birthday?: string | null
          contact_count?: number | null
          created_at?: string
          device_id?: string | null
          group_members?: Json | null
          id?: string
          is_group?: boolean | null
          last_contacted_at?: string | null
          name?: string | null
          notes?: string | null
          phone_number: string
          reminders?: Json | null
          tags?: string[] | null
          updated_at?: string
          user_id: string
          var1?: string | null
          var2?: string | null
          var3?: string | null
        }
        Update: {
          birthday?: string | null
          contact_count?: number | null
          created_at?: string
          device_id?: string | null
          group_members?: Json | null
          id?: string
          is_group?: boolean | null
          last_contacted_at?: string | null
          name?: string | null
          notes?: string | null
          phone_number?: string
          reminders?: Json | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string
          var1?: string | null
          var2?: string | null
          var3?: string | null
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
      device_connection_logs: {
        Row: {
          connection_duration_seconds: number | null
          created_at: string | null
          details: Json | null
          device_id: string
          error_code: string | null
          error_message: string | null
          event_type: string
          id: string
          ip_address: string | null
          timestamp: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          connection_duration_seconds?: number | null
          created_at?: string | null
          details?: Json | null
          device_id: string
          error_code?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          timestamp?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          connection_duration_seconds?: number | null
          created_at?: string | null
          details?: Json | null
          device_id?: string
          error_code?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          timestamp?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_connection_logs_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      device_health_metrics: {
        Row: {
          average_response_time_ms: number | null
          date: string
          device_id: string
          error_count_today: number | null
          error_rate_percent: number | null
          health_issues: Json | null
          health_status: string | null
          id: string
          last_error_at: string | null
          last_error_message: string | null
          last_heartbeat: string | null
          messages_delivered_today: number | null
          messages_failed_today: number | null
          messages_sent_today: number | null
          reconnect_count_today: number | null
          updated_at: string | null
          uptime_minutes: number | null
          user_id: string
        }
        Insert: {
          average_response_time_ms?: number | null
          date?: string
          device_id: string
          error_count_today?: number | null
          error_rate_percent?: number | null
          health_issues?: Json | null
          health_status?: string | null
          id?: string
          last_error_at?: string | null
          last_error_message?: string | null
          last_heartbeat?: string | null
          messages_delivered_today?: number | null
          messages_failed_today?: number | null
          messages_sent_today?: number | null
          reconnect_count_today?: number | null
          updated_at?: string | null
          uptime_minutes?: number | null
          user_id: string
        }
        Update: {
          average_response_time_ms?: number | null
          date?: string
          device_id?: string
          error_count_today?: number | null
          error_rate_percent?: number | null
          health_issues?: Json | null
          health_status?: string | null
          id?: string
          last_error_at?: string | null
          last_error_message?: string | null
          last_heartbeat?: string | null
          messages_delivered_today?: number | null
          messages_failed_today?: number | null
          messages_sent_today?: number | null
          reconnect_count_today?: number | null
          updated_at?: string | null
          uptime_minutes?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_health_metrics_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      device_reconnect_settings: {
        Row: {
          created_at: string | null
          current_retry_count: number | null
          device_id: string
          enabled: boolean | null
          exponential_backoff: boolean | null
          last_retry_at: string | null
          max_retries: number | null
          next_retry_at: string | null
          notify_on_failure: boolean | null
          retry_interval_seconds: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_retry_count?: number | null
          device_id: string
          enabled?: boolean | null
          exponential_backoff?: boolean | null
          last_retry_at?: string | null
          max_retries?: number | null
          next_retry_at?: string | null
          notify_on_failure?: boolean | null
          retry_interval_seconds?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_retry_count?: number | null
          device_id?: string
          enabled?: boolean | null
          exponential_backoff?: boolean | null
          last_retry_at?: string | null
          max_retries?: number | null
          next_retry_at?: string | null
          notify_on_failure?: boolean | null
          retry_interval_seconds?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_reconnect_settings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: true
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          api_key: string | null
          assigned_server_id: string | null
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
          assigned_server_id?: string | null
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
          assigned_server_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "devices_assigned_server_id_fkey"
            columns: ["assigned_server_id"]
            isOneToOne: false
            referencedRelation: "backend_servers"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_logs: {
        Row: {
          created_at: string | null
          details: Json | null
          error_message: string | null
          id: string
          integration_id: string
          items_failed: number | null
          items_processed: number | null
          status: string
          sync_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          error_message?: string | null
          id?: string
          integration_id: string
          items_failed?: number | null
          items_processed?: number | null
          status: string
          sync_type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          error_message?: string | null
          id?: string
          integration_id?: string
          items_failed?: number | null
          items_processed?: number | null
          status?: string
          sync_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_logs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          config: Json
          created_at: string | null
          error_message: string | null
          id: string
          integration_type: string
          is_active: boolean | null
          last_sync_at: string | null
          sync_status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string | null
          error_message?: string | null
          id?: string
          integration_type: string
          is_active?: boolean | null
          last_sync_at?: string | null
          sync_status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string | null
          error_message?: string | null
          id?: string
          integration_type?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          sync_status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          billing_period_end: string | null
          billing_period_start: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          due_date: string | null
          id: string
          invoice_number: string
          metadata: Json | null
          payment_date: string | null
          payment_method: string | null
          plan_name: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          billing_period_end?: string | null
          billing_period_start?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          metadata?: Json | null
          payment_date?: string | null
          payment_method?: string | null
          plan_name: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          billing_period_end?: string | null
          billing_period_start?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          metadata?: Json | null
          payment_date?: string | null
          payment_method?: string | null
          plan_name?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      landing_contact: {
        Row: {
          address: string | null
          email: string | null
          facebook: string | null
          id: string
          instagram: string | null
          linkedin: string | null
          phone: string | null
          twitter: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          email?: string | null
          facebook?: string | null
          id?: string
          instagram?: string | null
          linkedin?: string | null
          phone?: string | null
          twitter?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          email?: string | null
          facebook?: string | null
          id?: string
          instagram?: string | null
          linkedin?: string | null
          phone?: string | null
          twitter?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      landing_content: {
        Row: {
          content: Json
          created_at: string
          id: string
          is_active: boolean | null
          section_type: string
          subtitle: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          is_active?: boolean | null
          section_type: string
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          is_active?: boolean | null
          section_type?: string
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      landing_features: {
        Row: {
          created_at: string
          description: string
          display_order: number
          icon: string | null
          id: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      landing_sections: {
        Row: {
          content: string | null
          created_at: string
          display_order: number
          id: string
          image_url: string | null
          is_active: boolean
          section_key: string
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          section_key: string
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          section_key?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      login_rate_limits: {
        Row: {
          attempt_count: number
          created_at: string
          first_attempt_at: string
          id: string
          identifier: string
          is_locked: boolean | null
          last_attempt_at: string
          locked_until: string | null
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          first_attempt_at?: string
          id?: string
          identifier: string
          is_locked?: boolean | null
          last_attempt_at?: string
          locked_until?: string | null
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          first_attempt_at?: string
          id?: string
          identifier?: string
          is_locked?: boolean | null
          last_attempt_at?: string
          locked_until?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      marketplace_products: {
        Row: {
          category: string
          content: Json
          created_at: string | null
          created_by: string | null
          currency: string | null
          description: string | null
          downloads: number | null
          id: string
          is_featured: boolean | null
          is_published: boolean | null
          name: string
          preview_images: string[] | null
          price: number | null
          rating: number | null
          tags: string[] | null
          thumbnail_url: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          category: string
          content: Json
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          downloads?: number | null
          id?: string
          is_featured?: boolean | null
          is_published?: boolean | null
          name: string
          preview_images?: string[] | null
          price?: number | null
          rating?: number | null
          tags?: string[] | null
          thumbnail_url?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          content?: Json
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          downloads?: number | null
          id?: string
          is_featured?: boolean | null
          is_published?: boolean | null
          name?: string
          preview_images?: string[] | null
          price?: number | null
          rating?: number | null
          tags?: string[] | null
          thumbnail_url?: string | null
          type?: string
          updated_at?: string | null
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
      message_queue: {
        Row: {
          created_at: string | null
          device_id: string
          error_message: string | null
          id: string
          media_url: string | null
          message: string | null
          message_type: string | null
          processed_at: string | null
          retry_count: number | null
          scheduled_at: string | null
          status: string | null
          to_phone: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          device_id: string
          error_message?: string | null
          id?: string
          media_url?: string | null
          message?: string | null
          message_type?: string | null
          processed_at?: string | null
          retry_count?: number | null
          scheduled_at?: string | null
          status?: string | null
          to_phone: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          device_id?: string
          error_message?: string | null
          id?: string
          media_url?: string | null
          message?: string | null
          message_type?: string | null
          processed_at?: string | null
          retry_count?: number | null
          scheduled_at?: string | null
          status?: string | null
          to_phone?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_queue_device_id_fkey"
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
          duration_months: number
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
          duration_months?: number
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
          duration_months?: number
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
      recurring_message_logs: {
        Row: {
          created_at: string | null
          details: Json | null
          error_message: string | null
          execution_time: string | null
          failed_count: number
          id: string
          recurring_message_id: string
          sent_to_count: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          error_message?: string | null
          execution_time?: string | null
          failed_count?: number
          id?: string
          recurring_message_id: string
          sent_to_count?: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          error_message?: string | null
          execution_time?: string | null
          failed_count?: number
          id?: string
          recurring_message_id?: string
          sent_to_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_message_logs_recurring_message_id_fkey"
            columns: ["recurring_message_id"]
            isOneToOne: false
            referencedRelation: "recurring_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_messages: {
        Row: {
          batch_size: number | null
          created_at: string | null
          day_of_month: number | null
          days_of_week: number[] | null
          delay_seconds: number | null
          delay_type: string | null
          device_id: string
          end_date: string | null
          frequency: string
          id: string
          interval_value: number | null
          is_active: boolean | null
          last_sent_at: string | null
          max_executions: number | null
          media_url: string | null
          message: string
          name: string
          next_send_at: string | null
          pause_between_batches: number | null
          randomize_delay: boolean | null
          start_date: string
          target_contacts: Json
          time_of_day: string
          timezone: string | null
          total_failed: number | null
          total_sent: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          batch_size?: number | null
          created_at?: string | null
          day_of_month?: number | null
          days_of_week?: number[] | null
          delay_seconds?: number | null
          delay_type?: string | null
          device_id: string
          end_date?: string | null
          frequency: string
          id?: string
          interval_value?: number | null
          is_active?: boolean | null
          last_sent_at?: string | null
          max_executions?: number | null
          media_url?: string | null
          message: string
          name: string
          next_send_at?: string | null
          pause_between_batches?: number | null
          randomize_delay?: boolean | null
          start_date: string
          target_contacts?: Json
          time_of_day: string
          timezone?: string | null
          total_failed?: number | null
          total_sent?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          batch_size?: number | null
          created_at?: string | null
          day_of_month?: number | null
          days_of_week?: number[] | null
          delay_seconds?: number | null
          delay_type?: string | null
          device_id?: string
          end_date?: string | null
          frequency?: string
          id?: string
          interval_value?: number | null
          is_active?: boolean | null
          last_sent_at?: string | null
          max_executions?: number | null
          media_url?: string | null
          message?: string
          name?: string
          next_send_at?: string | null
          pause_between_batches?: number | null
          randomize_delay?: boolean | null
          start_date?: string
          target_contacts?: Json
          time_of_day?: string
          timezone?: string | null
          total_failed?: number | null
          total_sent?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_messages_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_configs: {
        Row: {
          auto_send: boolean | null
          created_at: string
          created_by: string | null
          description: string | null
          device_id: string | null
          id: string
          is_active: boolean | null
          last_sent_at: string | null
          message_template: string
          message_variables: Json | null
          metadata: Json | null
          name: string
          reminder_type: string
          send_time: string | null
          target_segment: string | null
          timezone: string | null
          total_sent: number | null
          trigger_days_before: number[] | null
          updated_at: string
        }
        Insert: {
          auto_send?: boolean | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          device_id?: string | null
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          message_template: string
          message_variables?: Json | null
          metadata?: Json | null
          name: string
          reminder_type: string
          send_time?: string | null
          target_segment?: string | null
          timezone?: string | null
          total_sent?: number | null
          trigger_days_before?: number[] | null
          updated_at?: string
        }
        Update: {
          auto_send?: boolean | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          device_id?: string | null
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          message_template?: string
          message_variables?: Json | null
          metadata?: Json | null
          name?: string
          reminder_type?: string
          send_time?: string | null
          target_segment?: string | null
          timezone?: string | null
          total_sent?: number | null
          trigger_days_before?: number[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_configs_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_sent: string
          metadata: Json | null
          recipient_name: string | null
          recipient_phone: string
          reminder_config_id: string | null
          scheduled_at: string | null
          sent_at: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_sent: string
          metadata?: Json | null
          recipient_name?: string | null
          recipient_phone: string
          reminder_config_id?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_sent?: string
          metadata?: Json | null
          recipient_name?: string | null
          recipient_phone?: string
          reminder_config_id?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminder_logs_reminder_config_id_fkey"
            columns: ["reminder_config_id"]
            isOneToOne: false
            referencedRelation: "reminder_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      server_logs: {
        Row: {
          created_at: string
          details: Json | null
          id: string
          log_type: string
          message: string
          server_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          id?: string
          log_type: string
          message: string
          server_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          id?: string
          log_type?: string
          message?: string
          server_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "server_logs_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "backend_servers"
            referencedColumns: ["id"]
          },
        ]
      }
      system_alerts: {
        Row: {
          alert_type: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean | null
          message: string
          metadata: Json | null
          read_by: string[] | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          title: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          read_by?: string[] | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          title: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          read_by?: string[] | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          title?: string
        }
        Relationships: []
      }
      tutorials: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          duration: string | null
          id: string
          is_published: boolean | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          video_url: string
          view_count: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration?: string | null
          id?: string
          is_published?: boolean | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          video_url: string
          view_count?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration?: string | null
          id?: string
          is_published?: boolean | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          video_url?: string
          view_count?: number | null
        }
        Relationships: []
      }
      user_add_ons: {
        Row: {
          add_on_id: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          payment_id: string | null
          purchased_at: string | null
          user_id: string
        }
        Insert: {
          add_on_id: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          payment_id?: string | null
          purchased_at?: string | null
          user_id: string
        }
        Update: {
          add_on_id?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          payment_id?: string | null
          purchased_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_add_ons_add_on_id_fkey"
            columns: ["add_on_id"]
            isOneToOne: false
            referencedRelation: "add_ons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_add_ons_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_purchases: {
        Row: {
          created_at: string | null
          id: string
          invoice_id: string | null
          price_paid: number
          product_id: string
          purchase_date: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          price_paid: number
          product_id: string
          purchase_date?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          price_paid?: number
          product_id?: string
          purchase_date?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_purchases_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
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
      user_segments: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          filters: Json
          id: string
          name: string
          updated_at: string
          user_count: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          filters?: Json
          id?: string
          name: string
          updated_at?: string
          user_count?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          filters?: Json
          id?: string
          name?: string
          updated_at?: string
          user_count?: number | null
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
      auto_cleanup_stuck_devices: { Args: never; Returns: number }
      calculate_device_uptime: {
        Args: { p_device_id: string }
        Returns: number
      }
      calculate_next_recurring_send: {
        Args: {
          p_day_of_month: number
          p_days_of_week: number[]
          p_end_date: string
          p_frequency: string
          p_interval_value: number
          p_last_sent_at: string
          p_start_date: string
          p_time_of_day: string
          p_timezone: string
        }
        Returns: string
      }
      calculate_next_send_time_v2: {
        Args: {
          p_frequency: string
          p_last_sent_at?: string
          p_schedule_time: string
          p_selected_days?: number[]
          p_timezone?: string
        }
        Returns: string
      }
      check_admin_rate_limit: {
        Args: {
          p_admin_id: string
          p_max_requests?: number
          p_operation_type: string
          p_window_minutes?: number
        }
        Returns: boolean
      }
      check_server_health: { Args: { p_server_id: string }; Returns: Json }
      cleanup_old_admin_rate_limits: { Args: never; Returns: number }
      cleanup_old_device_logs: { Args: never; Returns: number }
      cleanup_old_health_metrics: { Args: never; Returns: number }
      cleanup_old_rate_limits: { Args: never; Returns: number }
      decrypt_sensitive_data: {
        Args: { encrypted_data: string; key: string }
        Returns: string
      }
      delete_device_completely: { Args: { p_device_id: string }; Returns: Json }
      encrypt_sensitive_data: {
        Args: { data: string; key: string }
        Returns: string
      }
      generate_api_key: { Args: never; Returns: string }
      generate_invoice_number: { Args: never; Returns: string }
      get_best_available_server: { Args: never; Returns: string }
      get_device_health_summary: {
        Args: { p_device_id: string }
        Returns: {
          error_rate_percent: number
          health_status: string
          last_error_message: string
          messages_sent_today: number
          reconnect_count_today: number
          uptime_minutes: number
        }[]
      }
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
      increment_product_downloads: {
        Args: { p_product_id: string }
        Returns: undefined
      }
      log_audit: {
        Args: {
          p_action: string
          p_entity_id: string
          p_entity_type: string
          p_new_values?: Json
          p_old_values?: Json
        }
        Returns: string
      }
      log_device_connection_event: {
        Args: {
          p_details?: Json
          p_device_id: string
          p_error_code?: string
          p_error_message?: string
          p_event_type: string
          p_ip_address?: string
          p_user_id: string
        }
        Returns: string
      }
      mark_conversation_as_read: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      update_device_health: {
        Args: {
          p_device_id: string
          p_error_message?: string
          p_error_occurred?: boolean
          p_messages_failed?: number
          p_messages_sent?: number
          p_user_id: string
        }
        Returns: undefined
      }
      update_integration_sync: {
        Args: {
          p_error_message?: string
          p_integration_id: string
          p_status: string
        }
        Returns: undefined
      }
      user_has_add_on: {
        Args: { p_add_on_slug: string; p_user_id: string }
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
