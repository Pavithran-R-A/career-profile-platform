export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
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
    };
    Views: {
      public_profiles: {
        Row: {
          about: string | null;
          avatar_url: string | null;
          created_at: string | null;
          display_name: string | null;
          headline: string | null;
          id: string | null;
          location: string | null;
          published_at: string | null;
          updated_at: string | null;
          username: string | null;
          visibility: string | null;
        };
        Insert: {
          about?: string | null;
          avatar_url?: string | null;
          created_at?: string | null;
          display_name?: string | null;
          headline?: string | null;
          id?: string | null;
          location?: string | null;
          published_at?: string | null;
          updated_at?: string | null;
          username?: string | null;
          visibility?: string | null;
        };
        Update: {
          about?: string | null;
          avatar_url?: string | null;
          created_at?: string | null;
          display_name?: string | null;
          headline?: string | null;
          id?: string | null;
          location?: string | null;
          published_at?: string | null;
          updated_at?: string | null;
          username?: string | null;
          visibility?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      apply_resume_import: { Args: { payload: Json }; Returns: undefined };
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
