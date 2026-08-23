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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      alert_subscriptions: {
        Row: {
          created_at: string
          domain_ids: string[]
          email: string
          frequency: string
          id: string
          is_active: boolean
          keywords: string[]
          last_host_seen_at: string
          last_sent_at: string | null
          platform_ids: string[]
          scope: string
          sent_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          domain_ids?: string[]
          email: string
          frequency?: string
          id?: string
          is_active?: boolean
          keywords?: string[]
          last_host_seen_at?: string
          last_sent_at?: string | null
          platform_ids?: string[]
          scope?: string
          sent_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          domain_ids?: string[]
          email?: string
          frequency?: string
          id?: string
          is_active?: boolean
          keywords?: string[]
          last_host_seen_at?: string
          last_sent_at?: string | null
          platform_ids?: string[]
          scope?: string
          sent_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked: boolean
          scopes: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked?: boolean
          scopes?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked?: boolean
          scopes?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      api_request_logs: {
        Row: {
          created_at: string
          duration_ms: number
          id: string
          key_id: string
          method: string
          path: string
          request_id: string | null
          status: number
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number
          id?: string
          key_id: string
          method: string
          path: string
          request_id?: string | null
          status: number
          user_id: string
        }
        Update: {
          created_at?: string
          duration_ms?: number
          id?: string
          key_id?: string
          method?: string
          path?: string
          request_id?: string | null
          status?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_request_logs_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_stats: {
        Row: {
          created_at: string
          day: string
          id: string
          new_subdomains: number
          scan_errors: number
          scans_run: number
          total_subdomains: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          day: string
          id?: string
          new_subdomains?: number
          scan_errors?: number
          scans_run?: number
          total_subdomains?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          day?: string
          id?: string
          new_subdomains?: number
          scan_errors?: number
          scans_run?: number
          total_subdomains?: number
          updated_at?: string
        }
        Relationships: []
      }
      domains: {
        Row: {
          claimed_at: string | null
          created_at: string
          domain: string
          enabled: boolean
          id: string
          last_scan_status: string | null
          last_scanned_at: string | null
          new_subdomains_last_scan: number
          platform_id: string | null
          total_subdomains: number
          updated_at: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          domain: string
          enabled?: boolean
          id?: string
          last_scan_status?: string | null
          last_scanned_at?: string | null
          new_subdomains_last_scan?: number
          platform_id?: string | null
          total_subdomains?: number
          updated_at?: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          domain?: string
          enabled?: boolean
          id?: string
          last_scan_status?: string | null
          last_scanned_at?: string | null
          new_subdomains_last_scan?: number
          platform_id?: string | null
          total_subdomains?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "domains_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      live_hosts: {
        Row: {
          created_at: string
          host: string
          id: string
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          host: string
          id?: string
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          host?: string
          id?: string
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          board: string
          body: string
          created_at: string
          host: string | null
          id: string
          scheme: string
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          board?: string
          body?: string
          created_at?: string
          host?: string | null
          id?: string
          scheme?: string
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          board?: string
          body?: string
          created_at?: string
          host?: string | null
          id?: string
          scheme?: string
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platforms: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          slug: string
          website: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          slug: string
          website?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          slug?: string
          website?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      scan_jobs: {
        Row: {
          claimed_at: string | null
          created_at: string
          domain_id: string
          error_message: string | null
          finished_at: string | null
          hosts: Json | null
          id: string
          new_count: number
          processed_hosts: number
          started_at: string | null
          status: string
          total_hosts: number
          updated_at: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          domain_id: string
          error_message?: string | null
          finished_at?: string | null
          hosts?: Json | null
          id?: string
          new_count?: number
          processed_hosts?: number
          started_at?: string | null
          status?: string
          total_hosts?: number
          updated_at?: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          domain_id?: string
          error_message?: string | null
          finished_at?: string | null
          hosts?: Json | null
          id?: string
          new_count?: number
          processed_hosts?: number
          started_at?: string | null
          status?: string
          total_hosts?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_jobs_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      scans: {
        Row: {
          domain_id: string
          error_message: string | null
          finished_at: string | null
          id: string
          new_count: number
          removed_count: number
          started_at: string
          status: string
          total_returned: number
          trigger: string
        }
        Insert: {
          domain_id: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          new_count?: number
          removed_count?: number
          started_at?: string
          status?: string
          total_returned?: number
          trigger?: string
        }
        Update: {
          domain_id?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          new_count?: number
          removed_count?: number
          started_at?: string
          status?: string
          total_returned?: number
          trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: "scans_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      subdomains: {
        Row: {
          domain_id: string
          first_seen_at: string
          host: string
          id: string
          is_active: boolean
          label: string
          last_seen_at: string
        }
        Insert: {
          domain_id: string
          first_seen_at?: string
          host: string
          id?: string
          is_active?: boolean
          label: string
          last_seen_at?: string
        }
        Update: {
          domain_id?: string
          first_seen_at?: string
          host?: string
          id?: string
          is_active?: boolean
          label?: string
          last_seen_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subdomains_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
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
          role: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      api_rate_check: {
        Args: { _key_id: string; _limit?: number }
        Returns: {
          allowed: boolean
          reset_at: string
          used: number
        }[]
      }
      api_usage_summary: {
        Args: { _user_id: string }
        Returns: {
          error_rate_24h: number
          key_id: string
          last_request_at: string
          requests_1h: number
          requests_24h: number
          requests_7d: number
        }[]
      }
      bump_daily_stats: {
        Args: { _errors: number; _new: number }
        Returns: undefined
      }
      count_new_subs: { Args: { since: string }; Returns: number }
      discovery_timeseries: {
        Args: { bucket: string; since: string }
        Returns: {
          new_subdomains: number
          ts: string
        }[]
      }
      domain_cycle_counts: {
        Args: { cycle_minutes?: number }
        Returns: {
          due_domains: number
          total_domains: number
        }[]
      }
      domain_new_subs: {
        Args: { _domain_id: string; lim?: number; since: string }
        Returns: {
          first_seen_at: string
          host: string
          id: string
        }[]
      }
      domain_subdomain_stats: {
        Args: { _domain_id: string }
        Returns: {
          active: number
          inactive: number
          latest_seen: string
          new_24h: number
          new_7d: number
          total: number
        }[]
      }
      domain_subdomains_count: {
        Args: { _domain_id: string; _filter?: string; _search?: string }
        Returns: number
      }
      domain_subdomains_page: {
        Args: {
          _domain_id: string
          _filter?: string
          _limit?: number
          _offset?: number
          _search?: string
        }
        Returns: {
          first_seen_at: string
          host: string
          id: string
          is_active: boolean
          label: string
          last_seen_at: string
        }[]
      }
      domain_updates_count: {
        Args: {
          _keyword?: string
          _only_new?: boolean
          _platform_id?: string
          _search?: string
          _since?: string
        }
        Returns: number
      }
      domain_updates_page: {
        Args: {
          _dir?: string
          _keyword?: string
          _limit?: number
          _offset?: number
          _only_new?: boolean
          _platform_id?: string
          _search?: string
          _since: string
          _sort?: string
        }
        Returns: {
          domain: string
          id: string
          last_scanned_at: string
          last_seen: string
          new_count: number
          platform_color: string
          platform_id: string
          platform_name: string
          platform_slug: string
          total_subdomains: number
        }[]
      }
      domain_updates_summary: {
        Args: {
          _keyword?: string
          _only_new?: boolean
          _platform_id?: string
          _search?: string
          _since: string
        }
        Returns: {
          companies: number
          companies_with_new: number
          new_hosts: number
          total_subdomains: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      ingest_chunk_with_scan: {
        Args: {
          _domain_id: string
          _hosts: Json
          _scan_id: string
          _stamp: string
          _total_returned?: number
        }
        Returns: number
      }
      ingest_subdomain_chunk: {
        Args: { _domain_id: string; _hosts: Json; _stamp: string }
        Returns: number
      }
      mark_all_domains_due: { Args: never; Returns: number }
      new_subdomain_counts: {
        Args: never
        Returns: {
          last_day: number
          last_half_year: number
          last_hour: number
          last_month: number
          last_week: number
        }[]
      }
      new_subs_hour_heatmap: {
        Args: { since: string }
        Returns: {
          c: number
          dow: number
          hour: number
        }[]
      }
      new_subs_label_breakdown: {
        Args: { lim?: number; since: string }
        Returns: {
          c: number
          prefix: string
        }[]
      }
      new_subs_page: {
        Args: {
          before_id?: string
          before_ts?: string
          lim?: number
          since: string
        }
        Returns: {
          domain: string
          first_seen_at: string
          host: string
          id: string
        }[]
      }
      platform_recent_subdomains: {
        Args: { _platform_id: string; lim?: number; since: string }
        Returns: {
          domain: string
          first_seen_at: string
          host: string
        }[]
      }
      platform_stats: {
        Args: never
        Returns: {
          color: string
          domain_count: number
          name: string
          new_24h: number
          platform_id: string
          slug: string
          subdomain_count: number
        }[]
      }
      platform_updates: {
        Args: { since: string }
        Returns: {
          color: string
          domains_affected: number
          last_seen: string
          name: string
          new_count: number
          platform_id: string
          slug: string
        }[]
      }
      recent_subs_overview: {
        Args: { since: string }
        Returns: {
          domains_active: number
          latest_at: string
          per_hour: number
          programs_active: number
          total_new: number
        }[]
      }
      reconcile_scan_counts: { Args: { _since?: string }; Returns: number }
      running_scans_detail: {
        Args: { lim?: number }
        Returns: {
          domain: string
          elapsed_seconds: number
          platform_color: string
          platform_name: string
          platform_slug: string
          scan_id: string
          started_at: string
          trigger: string
        }[]
      }
      scan_activity_summary: {
        Args: never
        Returns: {
          claimed_5m: number
          finished_5m: number
          new_subs_1h: number
          new_subs_5m: number
          running: number
        }[]
      }
      scan_cycle_health: {
        Args: never
        Returns: {
          errors_1h: number
          never_scanned: number
          new_subs_30m: number
          newest_scan: string
          oldest_scan: string
          running_scans: number
          scanned_30m: number
          total_domains: number
        }[]
      }
      scan_timeseries: {
        Args: { bucket: string; since: string }
        Returns: {
          errors: number
          new_found: number
          scans: number
          ts: string
        }[]
      }
      search_subdomains: {
        Args: { lim?: number; off?: number; q: string }
        Returns: {
          domain: string
          first_seen_at: string
          host: string
          id: string
          is_active: boolean
        }[]
      }
      top_domains_by_new: {
        Args: { lim: number; since: string }
        Returns: {
          domain: string
          new_count: number
        }[]
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
