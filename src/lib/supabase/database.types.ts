export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      billing_orders: {
        Row: {
          amount_paise: number;
          created_at: string;
          currency: string;
          id: string;
          paid_at: string | null;
          plan_id: string;
          razorpay_order_id: string | null;
          razorpay_payment_id: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount_paise: number;
          created_at?: string;
          currency?: string;
          id?: string;
          paid_at?: string | null;
          plan_id?: string;
          razorpay_order_id?: string | null;
          razorpay_payment_id?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount_paise?: number;
          created_at?: string;
          currency?: string;
          id?: string;
          paid_at?: string | null;
          plan_id?: string;
          razorpay_order_id?: string | null;
          razorpay_payment_id?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      billing_webhook_events: {
        Row: {
          event_id: string;
          event_type: string | null;
          received_at: string;
        };
        Insert: {
          event_id: string;
          event_type?: string | null;
          received_at?: string;
        };
        Update: {
          event_id?: string;
          event_type?: string | null;
          received_at?: string;
        };
        Relationships: [];
      };
      custom_domains: {
        Row: {
          cloudflare_hostname_id: string | null;
          created_at: string;
          hostname: string;
          id: string;
          last_error: string | null;
          profile_id: string;
          status: string;
          updated_at: string;
          verification_token: string | null;
        };
        Insert: {
          cloudflare_hostname_id?: string | null;
          created_at?: string;
          hostname: string;
          id?: string;
          last_error?: string | null;
          profile_id: string;
          status?: string;
          updated_at?: string;
          verification_token?: string | null;
        };
        Update: {
          cloudflare_hostname_id?: string | null;
          created_at?: string;
          hostname?: string;
          id?: string;
          last_error?: string | null;
          profile_id?: string;
          status?: string;
          updated_at?: string;
          verification_token?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'custom_domains_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'custom_domains_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      dotcv_domains: {
        Row: {
          created_at: string;
          domain_label: string;
          domain_name: string;
          id: string;
          last_error: string | null;
          profile_id: string;
          provider: string;
          provider_reference: string | null;
          quote_price_paise: number | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          domain_label: string;
          domain_name: string;
          id?: string;
          last_error?: string | null;
          profile_id: string;
          provider?: string;
          provider_reference?: string | null;
          quote_price_paise?: number | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          domain_label?: string;
          domain_name?: string;
          id?: string;
          last_error?: string | null;
          profile_id?: string;
          provider?: string;
          provider_reference?: string | null;
          quote_price_paise?: number | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'dotcv_domains_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'dotcv_domains_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      funnel_events: {
        Row: {
          created_at: string;
          event_name: string;
          id: string;
          metadata: Json;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          event_name: string;
          id?: string;
          metadata?: Json;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          event_name?: string;
          id?: string;
          metadata?: Json;
          user_id?: string;
        };
        Relationships: [];
      };
      github_connections: {
        Row: {
          connected_at: string;
          created_at: string;
          github_account_id: number;
          github_account_login: string;
          github_account_type: string;
          id: string;
          installation_id: number;
          last_error_code: string | null;
          last_sync_status: string | null;
          last_synced_at: string | null;
          profile_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          connected_at?: string;
          created_at?: string;
          github_account_id: number;
          github_account_login: string;
          github_account_type?: string;
          id?: string;
          installation_id: number;
          last_error_code?: string | null;
          last_sync_status?: string | null;
          last_synced_at?: string | null;
          profile_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          connected_at?: string;
          created_at?: string;
          github_account_id?: number;
          github_account_login?: string;
          github_account_type?: string;
          id?: string;
          installation_id?: number;
          last_error_code?: string | null;
          last_sync_status?: string | null;
          last_synced_at?: string | null;
          profile_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'github_connections_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'github_connections_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      github_repositories: {
        Row: {
          connection_id: string;
          created_at: string;
          default_branch: string;
          default_branch_sha: string | null;
          description: string | null;
          forks_count: number;
          full_name: string;
          github_created_at: string | null;
          github_pushed_at: string | null;
          github_repo_id: number;
          github_updated_at: string | null;
          html_url: string;
          id: string;
          is_archived: boolean;
          is_fork: boolean;
          is_private: boolean;
          languages: Json;
          last_synced_at: string | null;
          name: string;
          owner_login: string;
          primary_language: string | null;
          selected_for_evidence: boolean;
          show_publicly: boolean;
          stars_count: number;
          topics: Json;
          updated_at: string;
        };
        Insert: {
          connection_id: string;
          created_at?: string;
          default_branch?: string;
          default_branch_sha?: string | null;
          description?: string | null;
          forks_count?: number;
          full_name: string;
          github_created_at?: string | null;
          github_pushed_at?: string | null;
          github_repo_id: number;
          github_updated_at?: string | null;
          html_url: string;
          id?: string;
          is_archived?: boolean;
          is_fork?: boolean;
          is_private?: boolean;
          languages?: Json;
          last_synced_at?: string | null;
          name: string;
          owner_login: string;
          primary_language?: string | null;
          selected_for_evidence?: boolean;
          show_publicly?: boolean;
          stars_count?: number;
          topics?: Json;
          updated_at?: string;
        };
        Update: {
          connection_id?: string;
          created_at?: string;
          default_branch?: string;
          default_branch_sha?: string | null;
          description?: string | null;
          forks_count?: number;
          full_name?: string;
          github_created_at?: string | null;
          github_pushed_at?: string | null;
          github_repo_id?: number;
          github_updated_at?: string | null;
          html_url?: string;
          id?: string;
          is_archived?: boolean;
          is_fork?: boolean;
          is_private?: boolean;
          languages?: Json;
          last_synced_at?: string | null;
          name?: string;
          owner_login?: string;
          primary_language?: string | null;
          selected_for_evidence?: boolean;
          show_publicly?: boolean;
          stars_count?: number;
          topics?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'github_repositories_connection_id_fkey';
            columns: ['connection_id'];
            isOneToOne: false;
            referencedRelation: 'github_connections';
            referencedColumns: ['id'];
          },
        ];
      };
      profile_achievements: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_featured: boolean;
          is_public: boolean;
          metric_text: string | null;
          profile_id: string;
          sort_order: number;
          source_url: string | null;
          timeframe: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_featured?: boolean;
          is_public?: boolean;
          metric_text?: string | null;
          profile_id: string;
          sort_order?: number;
          source_url?: string | null;
          timeframe?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_featured?: boolean;
          is_public?: boolean;
          metric_text?: string | null;
          profile_id?: string;
          sort_order?: number;
          source_url?: string | null;
          timeframe?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profile_achievements_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'profile_achievements_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profile_education: {
        Row: {
          created_at: string;
          degree: string | null;
          description: string | null;
          end_month: number | null;
          end_year: number | null;
          field_of_study: string | null;
          id: string;
          institution: string;
          profile_id: string;
          sort_order: number;
          start_month: number | null;
          start_year: number | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          degree?: string | null;
          description?: string | null;
          end_month?: number | null;
          end_year?: number | null;
          field_of_study?: string | null;
          id?: string;
          institution: string;
          profile_id: string;
          sort_order?: number;
          start_month?: number | null;
          start_year?: number | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          degree?: string | null;
          description?: string | null;
          end_month?: number | null;
          end_year?: number | null;
          field_of_study?: string | null;
          id?: string;
          institution?: string;
          profile_id?: string;
          sort_order?: number;
          start_month?: number | null;
          start_year?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profile_education_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'profile_education_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profile_evidence: {
        Row: {
          created_at: string;
          evidence_type: string;
          github_repository_id: string | null;
          id: string;
          is_public: boolean;
          metadata: Json;
          observed_at: string;
          profile_id: string;
          source_commit_sha: string | null;
          source_path: string | null;
          source_url: string | null;
          subject: string;
          summary: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          evidence_type: string;
          github_repository_id?: string | null;
          id?: string;
          is_public?: boolean;
          metadata?: Json;
          observed_at?: string;
          profile_id: string;
          source_commit_sha?: string | null;
          source_path?: string | null;
          source_url?: string | null;
          subject: string;
          summary: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          evidence_type?: string;
          github_repository_id?: string | null;
          id?: string;
          is_public?: boolean;
          metadata?: Json;
          observed_at?: string;
          profile_id?: string;
          source_commit_sha?: string | null;
          source_path?: string | null;
          source_url?: string | null;
          subject?: string;
          summary?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profile_evidence_github_repository_id_fkey';
            columns: ['github_repository_id'];
            isOneToOne: false;
            referencedRelation: 'github_repositories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'profile_evidence_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'profile_evidence_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profile_experiences: {
        Row: {
          company: string;
          created_at: string;
          description: string | null;
          end_month: number | null;
          end_year: number | null;
          id: string;
          is_current: boolean;
          location: string | null;
          profile_id: string;
          role: string;
          sort_order: number;
          start_month: number | null;
          start_year: number;
          updated_at: string;
        };
        Insert: {
          company: string;
          created_at?: string;
          description?: string | null;
          end_month?: number | null;
          end_year?: number | null;
          id?: string;
          is_current?: boolean;
          location?: string | null;
          profile_id: string;
          role: string;
          sort_order?: number;
          start_month?: number | null;
          start_year: number;
          updated_at?: string;
        };
        Update: {
          company?: string;
          created_at?: string;
          description?: string | null;
          end_month?: number | null;
          end_year?: number | null;
          id?: string;
          is_current?: boolean;
          location?: string | null;
          profile_id?: string;
          role?: string;
          sort_order?: number;
          start_month?: number | null;
          start_year?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profile_experiences_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'profile_experiences_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profile_links: {
        Row: {
          created_at: string;
          id: string;
          label: string;
          profile_id: string;
          sort_order: number;
          updated_at: string;
          url: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          label: string;
          profile_id: string;
          sort_order?: number;
          updated_at?: string;
          url: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          label?: string;
          profile_id?: string;
          sort_order?: number;
          updated_at?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profile_links_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'profile_links_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profile_preferences: {
        Row: {
          accent_key: string;
          created_at: string;
          hidden_sections: Json;
          id: string;
          profile_id: string;
          section_order: Json;
          template_id: string;
          template_key: string;
          updated_at: string;
        };
        Insert: {
          accent_key?: string;
          created_at?: string;
          hidden_sections?: Json;
          id?: string;
          profile_id: string;
          section_order?: Json;
          template_id?: string;
          template_key?: string;
          updated_at?: string;
        };
        Update: {
          accent_key?: string;
          created_at?: string;
          hidden_sections?: Json;
          id?: string;
          profile_id?: string;
          section_order?: Json;
          template_id?: string;
          template_key?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profile_preferences_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'profile_preferences_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: true;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profile_projects: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          profile_id: string;
          project_url: string | null;
          repository_url: string | null;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          profile_id: string;
          project_url?: string | null;
          repository_url?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          profile_id?: string;
          project_url?: string | null;
          repository_url?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profile_projects_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'profile_projects_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profile_skills: {
        Row: {
          category: string | null;
          created_at: string;
          id: string;
          name: string;
          profile_id: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          profile_id: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          profile_id?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profile_skills_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'profile_skills_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profile_variants: {
        Row: {
          created_at: string;
          id: string;
          job_description_sha256: string | null;
          job_requirements: Json | null;
          name: string;
          profile_id: string;
          status: string;
          target_company: string | null;
          target_role: string | null;
          updated_at: string;
          variant_data: Json;
        };
        Insert: {
          created_at?: string;
          id?: string;
          job_description_sha256?: string | null;
          job_requirements?: Json | null;
          name: string;
          profile_id: string;
          status?: string;
          target_company?: string | null;
          target_role?: string | null;
          updated_at?: string;
          variant_data?: Json;
        };
        Update: {
          created_at?: string;
          id?: string;
          job_description_sha256?: string | null;
          job_requirements?: Json | null;
          name?: string;
          profile_id?: string;
          status?: string;
          target_company?: string | null;
          target_role?: string | null;
          updated_at?: string;
          variant_data?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'profile_variants_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'profile_variants_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          about: string | null;
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          headline: string | null;
          id: string;
          location: string | null;
          published_at: string | null;
          updated_at: string;
          user_id: string;
          username: string;
          visibility: string;
        };
        Insert: {
          about?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          headline?: string | null;
          id?: string;
          location?: string | null;
          published_at?: string | null;
          updated_at?: string;
          user_id: string;
          username: string;
          visibility?: string;
        };
        Update: {
          about?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          headline?: string | null;
          id?: string;
          location?: string | null;
          published_at?: string | null;
          updated_at?: string;
          user_id?: string;
          username?: string;
          visibility?: string;
        };
        Relationships: [];
      };
      resume_sources: {
        Row: {
          byte_size: number;
          created_at: string;
          error_message: string | null;
          id: string;
          original_filename: string;
          page_count: number | null;
          profile_id: string;
          sha256: string | null;
          status: string;
          storage_path: string;
          structured_draft: Json | null;
          updated_at: string;
          warnings: Json | null;
        };
        Insert: {
          byte_size: number;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          original_filename: string;
          page_count?: number | null;
          profile_id: string;
          sha256?: string | null;
          status?: string;
          storage_path: string;
          structured_draft?: Json | null;
          updated_at?: string;
          warnings?: Json | null;
        };
        Update: {
          byte_size?: number;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          original_filename?: string;
          page_count?: number | null;
          profile_id?: string;
          sha256?: string | null;
          status?: string;
          storage_path?: string;
          structured_draft?: Json | null;
          updated_at?: string;
          warnings?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: 'resume_sources_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'resume_sources_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      usage_counters: {
        Row: {
          count: number;
          metric: string;
          updated_at: string;
          user_id: string;
          window_key: string;
        };
        Insert: {
          count?: number;
          metric: string;
          updated_at?: string;
          user_id: string;
          window_key: string;
        };
        Update: {
          count?: number;
          metric?: string;
          updated_at?: string;
          user_id?: string;
          window_key?: string;
        };
        Relationships: [];
      };
      user_subscriptions: {
        Row: {
          cancel_at_period_end: boolean;
          created_at: string;
          current_period_end: string | null;
          current_period_start: string | null;
          plan: string;
          provider: string;
          provider_customer_id: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          plan?: string;
          provider?: string;
          provider_customer_id?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          plan?: string;
          provider?: string;
          provider_customer_id?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      public_profiles: {
        Row: {
          about: string | null;
          achievements: Json | null;
          avatar_url: string | null;
          created_at: string | null;
          display_name: string | null;
          education: Json | null;
          evidence: Json | null;
          experiences: Json | null;
          headline: string | null;
          id: string | null;
          links: Json | null;
          location: string | null;
          preferences: Json | null;
          projects: Json | null;
          published_at: string | null;
          skills: Json | null;
          updated_at: string | null;
          username: string | null;
          visibility: string | null;
        };
        Relationships: [];
      };
      published_evidence: {
        Row: {
          evidence_type: string | null;
          id: string | null;
          metadata: Json | null;
          observed_at: string | null;
          profile_id: string | null;
          repository_full_name: string | null;
          repository_language: string | null;
          repository_topics: Json | null;
          repository_url: string | null;
          source_commit_sha: string | null;
          source_path: string | null;
          source_url: string | null;
          subject: string | null;
          summary: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'profile_evidence_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'profile_evidence_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      apply_resume_import: { Args: { payload: Json }; Returns: Json };
      safe_int: { Args: { fallback: number; value: string }; Returns: number };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
