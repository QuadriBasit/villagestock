// Auto-generated types matching the Supabase PostgreSQL schema.
// Run `supabase gen types typescript` to regenerate after schema changes.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      inventory_items: {
        Row: {
          id: string;
          user_id: string;
          location_id: string;
          name: string;
          category: string;
          brand: string;
          price: number;
          cost_price: number | null;
          mode: 'serialized' | 'non_serialized';
          status: 'in_stock' | 'sold' | 'reserved' | 'returned' | 'defective' | 'with_engineer' | 'missing' | null;
          quantity: number;
          low_stock_threshold: number;
          serial_number: string | null;
          imei: string | null;
          imei2: string | null;
          condition: 'working' | 'minor_faults' | 'major_faults' | 'not_working' | null;
          device_details: Json | null;
          barcode: string | null;
          description: string | null;
          image_url: string | null;
          created_at: string;
          updated_at: string;
          deleted: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          location_id: string;
          name: string;
          category: string;
          brand: string;
          price: number;
          cost_price?: number | null;
          mode: 'serialized' | 'non_serialized';
          status?: 'in_stock' | 'sold' | 'reserved' | 'returned' | 'defective' | 'with_engineer' | 'missing' | null;
          quantity?: number;
          low_stock_threshold?: number;
          serial_number?: string | null;
          imei?: string | null;
          imei2?: string | null;
          condition?: 'working' | 'minor_faults' | 'major_faults' | 'not_working' | null;
          device_details?: Json | null;
          barcode?: string | null;
          description?: string | null;
          image_url?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted?: boolean;
        };
        Update: Partial<Database['public']['Tables']['inventory_items']['Insert']>;
        Relationships: [];
      };
      stock_movements: {
        Row: {
          id: string;
          item_id: string;
          user_id: string;
          type: 'in' | 'out' | 'adjustment';
          quantity: number;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          item_id: string;
          user_id: string;
          type: 'in' | 'out' | 'adjustment';
          quantity: number;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['stock_movements']['Insert']>;
        Relationships: [];
      };
      sales_records: {
        Row: {
          id: string;
          user_id: string;
          location_id: string;
          item_id: string | null;
          sale_type: 'sale' | 'swap';
          item_name: string;
          item_category: string;
          item_brand: string;
          item_mode: 'serialized' | 'non_serialized';
          serial_number: string | null;
          imei: string | null;
          device_details: Json | null;
          sale_price: number;
          cost_price: number;
          profit: number;
          quantity_sold: number;
          payment_method: 'cash' | 'bank_transfer' | 'pos' | null;
          payment_status: 'paid' | 'credit';
          amount_paid: number | null;
          balance_owed: number | null;
          due_date: string | null;
          customer_name: string | null;
          customer_phone: string | null;
          sold_at: string;
          receipt_number: string;
          swap_record_id: string | null;
          trade_in_item_name: string | null;
          trade_in_item_brand: string | null;
          trade_in_value: number | null;
          balance_paid: number | null;
          returned: boolean;
          return_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          location_id: string;
          item_id?: string | null;
          sale_type?: 'sale' | 'swap';
          item_name: string;
          item_category: string;
          item_brand: string;
          item_mode?: 'serialized' | 'non_serialized';
          serial_number?: string | null;
          imei?: string | null;
          device_details?: Json | null;
          sale_price: number;
          cost_price?: number;
          profit?: number;
          quantity_sold?: number;
          payment_method?: 'cash' | 'bank_transfer' | 'pos' | null;
          payment_status?: 'paid' | 'credit';
          amount_paid?: number | null;
          balance_owed?: number | null;
          due_date?: string | null;
          customer_name?: string | null;
          customer_phone?: string | null;
          sold_at?: string;
          receipt_number: string;
          swap_record_id?: string | null;
          trade_in_item_name?: string | null;
          trade_in_item_brand?: string | null;
          trade_in_value?: number | null;
          balance_paid?: number | null;
          returned?: boolean;
          return_id?: string | null;
        };
        Update: Partial<Database['public']['Tables']['sales_records']['Insert']>;
        Relationships: [];
      };
      swap_records: {
        Row: {
          id: string;
          outgoing_item_id: string;
          incoming_item_id: string;
          user_id: string;
          location_id: string;
          sale_id: string;
          sale_price: number;
          trade_in_value: number;
          balance_paid: number;
          payment_method: 'cash' | 'bank_transfer' | 'pos' | null;
          customer_name: string | null;
          customer_phone: string | null;
          date: string;
          sync_status: string;
        };
        Insert: {
          id?: string;
          outgoing_item_id: string;
          incoming_item_id: string;
          user_id: string;
          location_id: string;
          sale_id: string;
          sale_price: number;
          trade_in_value: number;
          balance_paid: number;
          payment_method?: 'cash' | 'bank_transfer' | 'pos' | null;
          customer_name?: string | null;
          customer_phone?: string | null;
          date?: string;
          sync_status?: string;
        };
        Update: Partial<Database['public']['Tables']['swap_records']['Insert']>;
        Relationships: [];
      };
      credit_records: {
        Row: {
          id: string;
          sale_id: string;
          user_id: string;
          location_id: string;
          customer_name: string;
          customer_phone: string;
          item_name: string;
          total_amount: number;
          amount_paid: number;
          balance_owed: number;
          due_date: string;
          status: 'pending' | 'partially_paid' | 'paid' | 'overdue';
          payments: Json;
          notes: string | null;
          sync_status: string;
        };
        Insert: {
          id?: string;
          sale_id: string;
          user_id: string;
          location_id: string;
          customer_name: string;
          customer_phone: string;
          item_name: string;
          total_amount: number;
          amount_paid: number;
          balance_owed: number;
          due_date: string;
          status: 'pending' | 'partially_paid' | 'paid' | 'overdue';
          payments: Json;
          notes?: string | null;
          sync_status?: string;
        };
        Update: Partial<Database['public']['Tables']['credit_records']['Insert']>;
        Relationships: [];
      };
      repair_records: {
        Row: {
          id: string;
          item_id: string;
          user_id: string;
          location_id: string;
          engineer_name: string;
          engineer_phone: string | null;
          issue_description: string;
          repair_cost: number | null;
          date_sent: string;
          expected_return_date: string | null;
          date_returned: string | null;
          repair_status: 'sent' | 'in_progress' | 'completed' | 'collected';
          notes: string | null;
          sync_status: string;
        };
        Insert: {
          id?: string;
          item_id: string;
          user_id: string;
          location_id: string;
          engineer_name: string;
          engineer_phone?: string | null;
          issue_description: string;
          repair_cost?: number | null;
          date_sent: string;
          expected_return_date?: string | null;
          date_returned?: string | null;
          repair_status: 'sent' | 'in_progress' | 'completed' | 'collected';
          notes?: string | null;
          sync_status?: string;
        };
        Update: Partial<Database['public']['Tables']['repair_records']['Insert']>;
        Relationships: [];
      };
      return_records: {
        Row: {
          id: string;
          sale_id: string;
          item_id: string;
          user_id: string;
          location_id: string;
          reason: 'defective' | 'changed_mind' | 'wrong_item' | 'other';
          return_type: 'refund' | 'exchange';
          notes: string | null;
          returned_at: string;
          refund_amount: number;
          exchange_item_id: string | null;
          exchange_item_name: string | null;
          exchange_sale_id: string | null;
          sync_status: string;
        };
        Insert: {
          id?: string;
          sale_id: string;
          item_id: string;
          user_id: string;
          location_id: string;
          reason: 'defective' | 'changed_mind' | 'wrong_item' | 'other';
          return_type: 'refund' | 'exchange';
          notes?: string | null;
          returned_at?: string;
          refund_amount: number;
          exchange_item_id?: string | null;
          exchange_item_name?: string | null;
          exchange_sale_id?: string | null;
          sync_status?: string;
        };
        Update: Partial<Database['public']['Tables']['return_records']['Insert']>;
        Relationships: [];
      };
      business_profiles: {
        Row: {
          id: string;
          shop_name: string;
          owner_name: string;
          phone: string;
          email: string | null;
          address: string;
          trial_start_date: string;
          trial_end_date: string;
          plan: string;
          plan_status: string;
          subscription_id: string | null;
          onboarding_complete: boolean;
          updated_at: string;
          created_at: string;
          account_disabled: boolean;
        };
        Insert: {
          id: string;
          shop_name: string;
          owner_name: string;
          phone: string;
          email?: string | null;
          address: string;
          trial_start_date: string;
          trial_end_date: string;
          plan?: string;
          plan_status?: string;
          subscription_id?: string | null;
          onboarding_complete?: boolean;
          updated_at?: string;
          created_at?: string;
          account_disabled?: boolean;
        };
        Update: Partial<Database['public']['Tables']['business_profiles']['Row']>;
        Relationships: [];
      };
      shop_locations: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['shop_locations']['Insert']>;
        Relationships: [];
      };
      audit_events: {
        Row: {
          id: string;
          business_id: string;
          actor_user_id: string;
          action: string;
          entity_type: string;
          entity_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          actor_user_id: string;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['audit_events']['Row']>;
        Relationships: [];
      };
      business_members: {
        Row: {
          id: string;
          business_id: string;
          member_user_id: string;
          role: string;
          display_name: string | null;
          allowed_location_ids: string[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          member_user_id: string;
          role: string;
          display_name?: string | null;
          allowed_location_ids?: string[] | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['business_members']['Row']>;
        Relationships: [];
      };
      staff_invites: {
        Row: {
          id: string;
          business_id: string;
          email: string;
          role: string;
          display_name: string | null;
          allowed_location_ids: string[] | null;
          invited_by: string;
          token: string;
          created_at: string;
          accepted_at: string | null;
          expires_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          email: string;
          role: string;
          display_name?: string | null;
          allowed_location_ids?: string[] | null;
          invited_by: string;
          token?: string;
          created_at?: string;
          accepted_at?: string | null;
          expires_at?: string;
        };
        Update: Partial<Database['public']['Tables']['staff_invites']['Row']>;
        Relationships: [];
      };
      admin_users: {
        Row: {
          user_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          role?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['admin_users']['Row']>;
        Relationships: [];
      };
      subscription_payments: {
        Row: {
          id: string;
          user_id: string;
          plan: string;
          amount_ngn: number;
          provider: string | null;
          provider_ref: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan: string;
          amount_ngn: number;
          provider?: string | null;
          provider_ref?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['subscription_payments']['Row']>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string | null;
          phone: string | null;
          full_name: string | null;
          shop_name: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          phone?: string | null;
          full_name?: string | null;
          shop_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      admin_dashboard_snapshot: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      is_admin_user: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      lookup_shop_teammate_user_id: {
        Args: { p_business_id: string; p_email: string };
        Returns: string | null;
      };
      accept_staff_invite: {
        Args: { p_token: string };
        Returns: undefined;
      };
    };
    Enums: {
      item_category: 'phones' | 'laptops' | 'tablets' | 'accessories' | 'parts';
      item_mode: 'serialized' | 'non_serialized';
      serialized_item_status: 'in_stock' | 'sold' | 'reserved' | 'returned' | 'defective' | 'with_engineer' | 'missing';
      device_condition: 'working' | 'minor_faults' | 'major_faults' | 'not_working';
    };
  };
}
