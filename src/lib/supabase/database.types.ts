/**
 * Database types for the career profile platform.
 *
 * These types are manually maintained to match the Stage 1 migration schema.
 * They should be updated whenever the database schema changes.
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          username: string;
          display_name: string | null;
          headline: string | null;
          about: string | null;
          location: string | null;
          avatar_url: string | null;
          visibility: 'draft' | 'published';
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          username: string;
          display_name?: string | null;
          headline?: string | null;
          about?: string | null;
          location?: string | null;
          avatar_url?: string | null;
          visibility?: 'draft' | 'published';
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          username?: string;
          display_name?: string | null;
          headline?: string | null;
          about?: string | null;
          location?: string | null;
          avatar_url?: string | null;
          visibility?: 'draft' | 'published';
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      profile_experiences: {
        Row: {
          id: string;
          profile_id: string;
          company: string;
          role: string;
          location: string | null;
          start_year: number;
          start_month: number | null;
          end_year: number | null;
          end_month: number | null;
          is_current: boolean;
          description: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          company: string;
          role: string;
          location?: string | null;
          start_year: number;
          start_month?: number | null;
          end_year?: number | null;
          end_month?: number | null;
          is_current?: boolean;
          description?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          company?: string;
          role?: string;
          location?: string | null;
          start_year?: number;
          start_month?: number | null;
          end_year?: number | null;
          end_month?: number | null;
          is_current?: boolean;
          description?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      profile_education: {
        Row: {
          id: string;
          profile_id: string;
          institution: string;
          degree: string | null;
          field_of_study: string | null;
          start_year: number | null;
          start_month: number | null;
          end_year: number | null;
          end_month: number | null;
          description: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          institution: string;
          degree?: string | null;
          field_of_study?: string | null;
          start_year?: number | null;
          start_month?: number | null;
          end_year?: number | null;
          end_month?: number | null;
          description?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          institution?: string;
          degree?: string | null;
          field_of_study?: string | null;
          start_year?: number | null;
          start_month?: number | null;
          end_year?: number | null;
          end_month?: number | null;
          description?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      profile_projects: {
        Row: {
          id: string;
          profile_id: string;
          name: string;
          description: string | null;
          project_url: string | null;
          repository_url: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          name: string;
          description?: string | null;
          project_url?: string | null;
          repository_url?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          name?: string;
          description?: string | null;
          project_url?: string | null;
          repository_url?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      profile_skills: {
        Row: {
          id: string;
          profile_id: string;
          name: string;
          category: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          name: string;
          category?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          name?: string;
          category?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      profile_links: {
        Row: {
          id: string;
          profile_id: string;
          label: string;
          url: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          label: string;
          url: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          label?: string;
          url?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
