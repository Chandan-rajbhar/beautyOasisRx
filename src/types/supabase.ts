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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      appointment_times: {
        Row: {
          appointment_time: string
          created_at: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          appointment_time: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          appointment_time?: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          amount: number
          appointment_date: string | null
          appointment_time: string | null
          client_email: string | null
          client_id: string | null
          client_name: string | null
          client_phone: string | null
          clinician_id: string | null
          clinician_name: string | null
          created_at: string
          date: string | null
          duration: string | null
          end_time: string | null
          id: string
          notes: string | null
          patient_email: string | null
          patient_id: string | null
          patient_name: string | null
          patient_phone: string | null
          payment_status: string
          price: number
          protocol_title: string | null
          provider_id: string | null
          provider_name: string | null
          service_id: string | null
          service_name: string | null
          start_time: string | null
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          time: string | null
          treatment_protocol_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          appointment_date?: string | null
          appointment_time?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          clinician_id?: string | null
          clinician_name?: string | null
          created_at?: string
          date?: string | null
          duration?: string | null
          end_time?: string | null
          id?: string
          notes?: string | null
          patient_email?: string | null
          patient_id?: string | null
          patient_name?: string | null
          patient_phone?: string | null
          payment_status?: string
          price?: number
          protocol_title?: string | null
          provider_id?: string | null
          provider_name?: string | null
          service_id?: string | null
          service_name?: string | null
          start_time?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          time?: string | null
          treatment_protocol_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          appointment_date?: string | null
          appointment_time?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          clinician_id?: string | null
          clinician_name?: string | null
          created_at?: string
          date?: string | null
          duration?: string | null
          end_time?: string | null
          id?: string
          notes?: string | null
          patient_email?: string | null
          patient_id?: string | null
          patient_name?: string | null
          patient_phone?: string | null
          payment_status?: string
          price?: number
          protocol_title?: string | null
          provider_id?: string | null
          provider_name?: string | null
          service_id?: string | null
          service_name?: string | null
          start_time?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          time?: string | null
          treatment_protocol_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      coupons: {
        Row: {
          code: string
          coupon_code: string | null
          created_at: string
          description: string | null
          discount_amount: number | null
          discount_percent: number | null
          discount_type: string
          discount_value: number
          end_date: string | null
          expiry_date: string | null
          id: string
          max_uses: number | null
          min_order_amount: number | null
          min_spend: number | null
          start_date: string | null
          status: string
          times_used: number | null
          updated_at: string
          usage_count: number | null
          usage_limit: number | null
        }
        Insert: {
          code: string
          coupon_code?: string | null
          created_at?: string
          description?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          discount_type?: string
          discount_value: number
          end_date?: string | null
          expiry_date?: string | null
          id?: string
          max_uses?: number | null
          min_order_amount?: number | null
          min_spend?: number | null
          start_date?: string | null
          status?: string
          times_used?: number | null
          updated_at?: string
          usage_count?: number | null
          usage_limit?: number | null
        }
        Update: {
          code?: string
          coupon_code?: string | null
          created_at?: string
          description?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          discount_type?: string
          discount_value?: number
          end_date?: string | null
          expiry_date?: string | null
          id?: string
          max_uses?: number | null
          min_order_amount?: number | null
          min_spend?: number | null
          start_date?: string | null
          status?: string
          times_used?: number | null
          updated_at?: string
          usage_count?: number | null
          usage_limit?: number | null
        }
        Relationships: []
      }
      clinicians: {
        Row: {
          availability_schedule: Json | null
          biography: string | null
          clinical_title: string
          clinician_name: string
          created_at: string
          email: string
          id: string
          phone: string | null
          practice_status: string
          profile_image_url: string | null
          specialization: string
          updated_at: string
        }
        Insert: {
          availability_schedule?: Json | null
          biography?: string | null
          clinical_title: string
          clinician_name: string
          created_at?: string
          email: string
          id?: string
          phone?: string | null
          practice_status?: string
          profile_image_url?: string | null
          specialization: string
          updated_at?: string
        }
        Update: {
          availability_schedule?: Json | null
          biography?: string | null
          clinical_title?: string
          clinician_name?: string
          created_at?: string
          email?: string
          id?: string
          phone?: string | null
          practice_status?: string
          profile_image_url?: string | null
          specialization?: string
          updated_at?: string
        }
        Relationships: []
      }
      durations: {
        Row: {
          created_at: string | null
          id: string
          label: string
          minutes: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          label: string
          minutes?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          label?: string
          minutes?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      order_statuses: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          key: string
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          key: string
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          key?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          carrier: string | null
          created_at: string
          currency: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          discount_amount: number | null
          discount_code: string | null
          estimated_delivery: string | null
          id: string
          items: Json
          metadata: Json | null
          order_number: string
          order_status: string | null
          payment_method: string | null
          payment_status: string | null
          shipping_address: Json
          shipping_fee: number | null
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          subtotal: number | null
          total_amount: number
          total_items: number | null
          tracking_number: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          carrier?: string | null
          created_at?: string
          currency?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          discount_amount?: number | null
          discount_code?: string | null
          estimated_delivery?: string | null
          id?: string
          items?: Json
          metadata?: Json | null
          order_number: string
          order_status?: string | null
          payment_method?: string | null
          payment_status?: string | null
          shipping_address: Json
          shipping_fee?: number | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal?: number | null
          total_amount: number
          total_items?: number | null
          tracking_number?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          carrier?: string | null
          created_at?: string
          currency?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          discount_amount?: number | null
          discount_code?: string | null
          estimated_delivery?: string | null
          id?: string
          items?: Json
          metadata?: Json | null
          order_number?: string
          order_status?: string | null
          payment_method?: string | null
          payment_status?: string | null
          shipping_address?: Json
          shipping_fee?: number | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal?: number | null
          total_amount?: number
          total_items?: number | null
          tracking_number?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      patients: {
        Row: {
          account_status: string | null
          address: string | null
          avatar: string | null
          created_at: string | null
          date_of_birth: string | null
          dob: string | null
          email: string
          full_name: string | null
          id: string
          last_visit: string | null
          name: string | null
          phone: string | null
          profile_photo_url: string | null
          profilePhotoUrl: string | null
          residential_address: string | null
          role: string | null
          status: string | null
          total_appointments: number | null
          total_spent: number | null
          updated_at: string | null
        }
        Insert: {
          account_status?: string | null
          address?: string | null
          avatar?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          dob?: string | null
          email: string
          full_name?: string | null
          id?: string
          last_visit?: string | null
          name?: string | null
          phone?: string | null
          profile_photo_url?: string | null
          profilePhotoUrl?: string | null
          residential_address?: string | null
          role?: string | null
          status?: string | null
          total_appointments?: number | null
          total_spent?: number | null
          updated_at?: string | null
        }
        Update: {
          account_status?: string | null
          address?: string | null
          avatar?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          dob?: string | null
          email?: string
          full_name?: string | null
          id?: string
          last_visit?: string | null
          name?: string | null
          phone?: string | null
          profile_photo_url?: string | null
          profilePhotoUrl?: string | null
          residential_address?: string | null
          role?: string | null
          status?: string | null
          total_appointments?: number | null
          total_spent?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          address_line1: string
          address_line2: string | null
          address_type: string | null
          cart_items: Json
          city: string
          country: string | null
          created_at: string
          currency: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          delivery_address: Json | null
          discount_amount: number | null
          discount_code: string | null
          discount_percent: number | null
          id: string
          metadata: Json | null
          order_id: string | null
          order_status: string | null
          payment_method: string | null
          payment_status: string | null
          pincode: string
          raw_subtotal: number | null
          shipping_fee: number | null
          state: string | null
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          total_amount: number
          total_items: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          address_type?: string | null
          cart_items?: Json
          city: string
          country?: string | null
          created_at?: string
          currency?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          delivery_address?: Json | null
          discount_amount?: number | null
          discount_code?: string | null
          discount_percent?: number | null
          id?: string
          metadata?: Json | null
          order_id?: string | null
          order_status?: string | null
          payment_method?: string | null
          payment_status?: string | null
          pincode: string
          raw_subtotal?: number | null
          shipping_fee?: number | null
          state?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          total_amount: number
          total_items?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          address_type?: string | null
          cart_items?: Json
          city?: string
          country?: string | null
          created_at?: string
          currency?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          delivery_address?: Json | null
          discount_amount?: number | null
          discount_code?: string | null
          discount_percent?: number | null
          id?: string
          metadata?: Json | null
          order_id?: string | null
          order_status?: string | null
          payment_method?: string | null
          payment_status?: string | null
          pincode?: string
          raw_subtotal?: number | null
          shipping_fee?: number | null
          state?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          total_amount?: number
          total_items?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          badge: string | null
          badge_color: string | null
          category: string
          category_id: string | null
          created_at: string | null
          description: string | null
          id: string
          image: string | null
          image_url: string | null
          ingredients: string | null
          name: string
          original_price: number | null
          price: number
          sku: string
          status: string
          stock: number
          subtitle: string | null
          updated_at: string | null
          usage: string | null
          usage_instructions: string | null
        }
        Insert: {
          badge?: string | null
          badge_color?: string | null
          category?: string
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image?: string | null
          image_url?: string | null
          ingredients?: string | null
          name: string
          original_price?: number | null
          price?: number
          sku: string
          status?: string
          stock?: number
          subtitle?: string | null
          updated_at?: string | null
          usage?: string | null
          usage_instructions?: string | null
        }
        Update: {
          badge?: string | null
          badge_color?: string | null
          category?: string
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image?: string | null
          image_url?: string | null
          ingredients?: string | null
          name?: string
          original_price?: number | null
          price?: number
          sku?: string
          status?: string
          stock?: number
          subtitle?: string | null
          updated_at?: string | null
          usage?: string | null
          usage_instructions?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_protocols: {
        Row: {
          appointment_date: string | null
          appointment_time: string | null
          category: string
          category_id: string | null
          clinical_description: string | null
          created_at: string
          duration: string
          id: string
          image_url: string | null
          images: Json | null
          price: number
          protocol_title: string
          status: string
          tagline: string | null
          updated_at: string
        }
        Insert: {
          appointment_date?: string | null
          appointment_time?: string | null
          category?: string
          category_id?: string | null
          clinical_description?: string | null
          created_at?: string
          duration?: string
          id?: string
          image_url?: string | null
          images?: Json | null
          price?: number
          protocol_title: string
          status?: string
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          appointment_date?: string | null
          appointment_time?: string | null
          category?: string
          category_id?: string | null
          clinical_description?: string | null
          created_at?: string
          duration?: string
          id?: string
          image_url?: string | null
          images?: Json | null
          price?: number
          protocol_title?: string
          status?: string
          tagline?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_protocols_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "treatment_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar: string | null
          created_at: string
          email: string
          id: string
          name: string
          profile_photo_url: string | null
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          email: string
          id: string
          name: string
          profile_photo_url?: string | null
          role?: string
          status?: string
          updated_at?: string
        }
        Update: {
          avatar?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          profile_photo_url?: string | null
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      website_content: {
        Row: {
          data: Json
          id: string
          section: string
          updated_at: string
        }
        Insert: {
          data?: Json
          id?: string
          section: string
          updated_at?: string
        }
        Update: {
          data?: Json
          id?: string
          section?: string
          updated_at?: string
        }
        Relationships: []
      }
      website_testimonials: {
        Row: {
          created_at: string
          display_order: number
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          rating: number
          review: string
          role: string
          treatment: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          rating?: number
          review: string
          role?: string
          treatment?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          rating?: number
          review?: string
          role?: string
          treatment?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_email_exists: { Args: { lookup_email: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
