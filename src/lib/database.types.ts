export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type PaymentMode = 'Cash' | 'UPI' | 'Card';
export type PaymentMethod = 'upi' | 'pay_at_salon';
export type PaymentStatus = 'unpaid' | 'verification_pending' | 'paid';
export type VisitStatus = 'Waiting' | 'In-Progress' | 'Completed';

export interface Database {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string;
          saloon_id: string;
          name: string;
          phone: string;
          total_visits: number;
          total_spent: number;
          last_visit: string | null;
        };
        Insert: {
          id?: string;
          saloon_id: string;
          name: string;
          phone: string;
          total_visits?: number;
          total_spent?: number;
          last_visit?: string | null;
        };
        Update: {
          id?: string;
          saloon_id?: string;
          name?: string;
          phone?: string;
          total_visits?: number;
          total_spent?: number;
          last_visit?: string | null;
        };
        Relationships: [];
      };
      saloons: {
        Row: {
          id: string;
          name: string;
          owner_name: string;
          phone: string;
          trade_license_no: string;
          license_expiry_date: string;
          sanitation_verified: boolean;
          upi_id: string | null;
          upi_payee_name: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          owner_name: string;
          phone: string;
          trade_license_no: string;
          license_expiry_date: string;
          sanitation_verified?: boolean;
          upi_id?: string | null;
          upi_payee_name?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          owner_name?: string;
          phone?: string;
          trade_license_no?: string;
          license_expiry_date?: string;
          sanitation_verified?: boolean;
          upi_id?: string | null;
          upi_payee_name?: string | null;
        };
        Relationships: [];
      };
      services: {
        Row: {
          id: string;
          saloon_id: string;
          service_name: string;
          price: number;
          category: string;
        };
        Insert: {
          id?: string;
          saloon_id: string;
          service_name: string;
          price: number;
          category: string;
        };
        Update: {
          id?: string;
          saloon_id?: string;
          service_name?: string;
          price?: number;
          category?: string;
        };
        Relationships: [];
      };
      saloon_members: {
        Row: {
          user_id: string;
          saloon_id: string;
          role: 'owner' | 'admin' | 'staff';
          created_at: string;
        };
        Insert: {
          user_id: string;
          saloon_id: string;
          role: 'owner' | 'admin' | 'staff';
          created_at?: string;
        };
        Update: {
          user_id?: string;
          saloon_id?: string;
          role?: 'owner' | 'admin' | 'staff';
          created_at?: string;
        };
        Relationships: [];
      };
      visits: {
        Row: {
          id: string;
          saloon_id: string;
          customer_id: string;
          services_done: { id: string; service_name: string; price: number; category: string }[];
          total_amount: number;
          payment_mode: PaymentMode;
          payment_method: PaymentMethod | null;
          payment_status: PaymentStatus | null;
          utr_number: string | null;
          amount_paid: number;
          status: VisitStatus;
          stylist_name: string | null;
          notes: string | null;
          sanitation_verified: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          saloon_id: string;
          customer_id: string;
          services_done: { id: string; service_name: string; price: number; category: string }[];
          total_amount: number;
          payment_mode: PaymentMode;
          payment_method?: PaymentMethod;
          payment_status?: PaymentStatus;
          utr_number?: string | null;
          amount_paid?: number;
          status: VisitStatus;
          stylist_name?: string | null;
          notes?: string | null;
          sanitation_verified?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          saloon_id?: string;
          customer_id?: string;
          services_done?: { id: string; service_name: string; price: number; category: string }[];
          total_amount?: number;
          payment_mode?: PaymentMode;
          payment_method?: PaymentMethod;
          payment_status?: PaymentStatus;
          utr_number?: string | null;
          amount_paid?: number;
          status?: VisitStatus;
          stylist_name?: string | null;
          notes?: string | null;
          sanitation_verified?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'visits_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'visits_customer_saloon_fkey';
            columns: ['customer_id', 'saloon_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id', 'saloon_id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_visit: {
        Args: {
          p_saloon_id: string;
          p_customer_name: string;
          p_phone: string;
          p_service_ids: string[];
          p_payment_mode: PaymentMode;
          p_stylist_name: string;
          p_status: VisitStatus;
          p_sanitation_verified: boolean;
        };
        Returns: {
          id: string;
          total_amount: number;
          services_done: Json;
          created_at: string;
        }[];
      };
      create_public_booking: {
        Args: {
          p_saloon_id: string;
          p_customer_name: string;
          p_phone: string;
          p_service_ids: string[];
          p_expected_total: number;
          p_payment_method: PaymentMethod;
          p_utr_number: string | null;
          p_booking_date: string;
          p_time_slot: string;
        };
        Returns: {
          id: string;
          total_amount: number;
          services_done: Json;
          created_at: string;
        }[];
      };
      verify_visit_payment: {
        Args: {
          p_saloon_id: string;
          p_visit_id: string;
        };
        Returns: undefined;
      };
      update_visit_status: {
        Args: {
          p_saloon_id: string;
          p_visit_id: string;
          p_status: VisitStatus;
        };
        Returns: undefined;
      };
      claim_ai_analytics_rate_limit: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_saloon_member: {
        Args: {
          p_saloon_id: string;
          p_roles?: string[] | null;
        };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
