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
      audit_log: {
        Row: {
          acao: string
          ator_id: string | null
          created_at: string
          dados_antes: Json | null
          dados_depois: Json | null
          entidade: string
          entidade_id: string
          id: string
          justificativa: string | null
        }
        Insert: {
          acao: string
          ator_id?: string | null
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          entidade: string
          entidade_id: string
          id?: string
          justificativa?: string | null
        }
        Update: {
          acao?: string
          ator_id?: string | null
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          entidade?: string
          entidade_id?: string
          id?: string
          justificativa?: string | null
        }
        Relationships: []
      }
      organizations: {
        Row: {
          cnpj: string | null
          created_at: string
          id: string
          logo_url: string | null
          nome: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          nome: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          nome?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean
          avatar_url: string | null
          comissao_percent: number
          comissao_primeiro_mes_percent: number
          created_at: string
          data_admissao: string | null
          data_nascimento: string | null
          email: string
          endereco: string | null
          fixo_mensal: number
          id: string
          nome: string
          organization_id: string
          pix: string | null
          role: Database["public"]["Enums"]["user_role"]
          telefone: string | null
          tema_preferido: Database["public"]["Enums"]["theme_preference"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          avatar_url?: string | null
          comissao_percent?: number
          comissao_primeiro_mes_percent?: number
          created_at?: string
          data_admissao?: string | null
          data_nascimento?: string | null
          email: string
          endereco?: string | null
          fixo_mensal?: number
          id: string
          nome: string
          organization_id: string
          pix?: string | null
          role: Database["public"]["Enums"]["user_role"]
          telefone?: string | null
          tema_preferido?: Database["public"]["Enums"]["theme_preference"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          avatar_url?: string | null
          comissao_percent?: number
          comissao_primeiro_mes_percent?: number
          created_at?: string
          data_admissao?: string | null
          data_nascimento?: string | null
          email?: string
          endereco?: string | null
          fixo_mensal?: number
          id?: string
          nome?: string
          organization_id?: string
          pix?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          telefone?: string | null
          tema_preferido?: Database["public"]["Enums"]["theme_preference"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
    }
    Enums: {
      theme_preference: "light" | "dark" | "system"
      user_role: "adm" | "socio" | "comercial" | "coordenador" | "assessor"
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
      theme_preference: ["light", "dark", "system"],
      user_role: ["adm", "socio", "comercial", "coordenador", "assessor"],
    },
  },
} as const
