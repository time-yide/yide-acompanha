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
      calendar_events: {
        Row: {
          client_id: string | null
          created_at: string
          criado_por: string
          descricao: string | null
          fim: string
          id: string
          inicio: string
          lead_id: string | null
          organization_id: string
          participantes_ids: string[]
          sub_calendar: Database["public"]["Enums"]["sub_calendar"]
          titulo: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          criado_por: string
          descricao?: string | null
          fim: string
          id?: string
          inicio: string
          lead_id?: string | null
          organization_id: string
          participantes_ids?: string[]
          sub_calendar?: Database["public"]["Enums"]["sub_calendar"]
          titulo: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          criado_por?: string
          descricao?: string | null
          fim?: string
          id?: string
          inicio?: string
          lead_id?: string | null
          organization_id?: string
          participantes_ids?: string[]
          sub_calendar?: Database["public"]["Enums"]["sub_calendar"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_briefing: {
        Row: {
          client_id: string
          texto_markdown: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          client_id: string
          texto_markdown?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          client_id?: string
          texto_markdown?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_briefing_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_briefing_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_files: {
        Row: {
          categoria: Database["public"]["Enums"]["file_category"]
          client_id: string
          created_at: string
          id: string
          mime_type: string | null
          nome_arquivo: string
          size_bytes: number
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          categoria?: Database["public"]["Enums"]["file_category"]
          client_id: string
          created_at?: string
          id?: string
          mime_type?: string | null
          nome_arquivo: string
          size_bytes: number
          storage_path: string
          uploaded_by: string
        }
        Update: {
          categoria?: Database["public"]["Enums"]["file_category"]
          client_id?: string
          created_at?: string
          id?: string
          mime_type?: string | null
          nome_arquivo?: string
          size_bytes?: number
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_important_dates: {
        Row: {
          client_id: string
          created_at: string
          data: string
          descricao: string
          id: string
          notify_days_before: number[]
          tipo: Database["public"]["Enums"]["important_date_type"]
        }
        Insert: {
          client_id: string
          created_at?: string
          data: string
          descricao: string
          id?: string
          notify_days_before?: number[]
          tipo?: Database["public"]["Enums"]["important_date_type"]
        }
        Update: {
          client_id?: string
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          notify_days_before?: number[]
          tipo?: Database["public"]["Enums"]["important_date_type"]
        }
        Relationships: [
          {
            foreignKeyName: "client_important_dates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          autor_id: string
          client_id: string
          created_at: string
          id: string
          texto_rico: string
          tipo: Database["public"]["Enums"]["note_type"]
        }
        Insert: {
          autor_id: string
          client_id: string
          created_at?: string
          id?: string
          texto_rico: string
          tipo?: Database["public"]["Enums"]["note_type"]
        }
        Update: {
          autor_id?: string
          client_id?: string
          created_at?: string
          id?: string
          texto_rico?: string
          tipo?: Database["public"]["Enums"]["note_type"]
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          assessor_id: string | null
          contato_principal: string | null
          coordenador_id: string | null
          created_at: string
          data_aniversario_socio_cliente: string | null
          data_churn: string | null
          data_entrada: string
          email: string | null
          id: string
          motivo_churn: string | null
          nome: string
          organization_id: string
          servico_contratado: string | null
          status: Database["public"]["Enums"]["client_status"]
          telefone: string | null
          updated_at: string
          valor_mensal: number
        }
        Insert: {
          assessor_id?: string | null
          contato_principal?: string | null
          coordenador_id?: string | null
          created_at?: string
          data_aniversario_socio_cliente?: string | null
          data_churn?: string | null
          data_entrada?: string
          email?: string | null
          id?: string
          motivo_churn?: string | null
          nome: string
          organization_id: string
          servico_contratado?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          telefone?: string | null
          updated_at?: string
          valor_mensal?: number
        }
        Update: {
          assessor_id?: string | null
          contato_principal?: string | null
          coordenador_id?: string | null
          created_at?: string
          data_aniversario_socio_cliente?: string | null
          data_churn?: string | null
          data_entrada?: string
          email?: string | null
          id?: string
          motivo_churn?: string | null
          nome?: string
          organization_id?: string
          servico_contratado?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          telefone?: string | null
          updated_at?: string
          valor_mensal?: number
        }
        Relationships: [
          {
            foreignKeyName: "clients_assessor_id_fkey"
            columns: ["assessor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_coordenador_id_fkey"
            columns: ["coordenador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_snapshot_items: {
        Row: {
          base: number
          client_id: string | null
          created_at: string
          descricao: string
          id: string
          lead_id: string | null
          percentual: number
          snapshot_id: string
          tipo: Database["public"]["Enums"]["snapshot_item_tipo"]
          valor: number
        }
        Insert: {
          base?: number
          client_id?: string | null
          created_at?: string
          descricao: string
          id?: string
          lead_id?: string | null
          percentual?: number
          snapshot_id: string
          tipo: Database["public"]["Enums"]["snapshot_item_tipo"]
          valor?: number
        }
        Update: {
          base?: number
          client_id?: string | null
          created_at?: string
          descricao?: string
          id?: string
          lead_id?: string | null
          percentual?: number
          snapshot_id?: string
          tipo?: Database["public"]["Enums"]["snapshot_item_tipo"]
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "commission_snapshot_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_snapshot_items_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_snapshot_items_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "commission_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_snapshots: {
        Row: {
          ajuste_manual: number
          aprovado_em: string | null
          aprovado_por: string | null
          base_calculo: number
          created_at: string
          fixo: number
          id: string
          justificativa_ajuste: string | null
          mes_referencia: string
          papel_naquele_mes: string
          percentual_aplicado: number
          status: Database["public"]["Enums"]["snapshot_status"]
          user_id: string
          valor_total: number
          valor_variavel: number
        }
        Insert: {
          ajuste_manual?: number
          aprovado_em?: string | null
          aprovado_por?: string | null
          base_calculo?: number
          created_at?: string
          fixo?: number
          id?: string
          justificativa_ajuste?: string | null
          mes_referencia: string
          papel_naquele_mes: string
          percentual_aplicado?: number
          status?: Database["public"]["Enums"]["snapshot_status"]
          user_id: string
          valor_total?: number
          valor_variavel?: number
        }
        Update: {
          ajuste_manual?: number
          aprovado_em?: string | null
          aprovado_por?: string | null
          base_calculo?: number
          created_at?: string
          fixo?: number
          id?: string
          justificativa_ajuste?: string | null
          mes_referencia?: string
          papel_naquele_mes?: string
          percentual_aplicado?: number
          status?: Database["public"]["Enums"]["snapshot_status"]
          user_id?: string
          valor_total?: number
          valor_variavel?: number
        }
        Relationships: [
          {
            foreignKeyName: "commission_snapshots_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_runs: {
        Row: {
          details: Json | null
          job_name: string
          ran_at: string
          run_date: string
        }
        Insert: {
          details?: Json | null
          job_name: string
          ran_at?: string
          run_date: string
        }
        Update: {
          details?: Json | null
          job_name?: string
          ran_at?: string
          run_date?: string
        }
        Relationships: []
      }
      lead_attempts: {
        Row: {
          autor_id: string
          canal: Database["public"]["Enums"]["attempt_channel"]
          created_at: string
          data_proximo_passo: string | null
          id: string
          lead_id: string
          observacao: string | null
          proximo_passo: string | null
          resultado: Database["public"]["Enums"]["attempt_result"]
        }
        Insert: {
          autor_id: string
          canal?: Database["public"]["Enums"]["attempt_channel"]
          created_at?: string
          data_proximo_passo?: string | null
          id?: string
          lead_id: string
          observacao?: string | null
          proximo_passo?: string | null
          resultado?: Database["public"]["Enums"]["attempt_result"]
        }
        Update: {
          autor_id?: string
          canal?: Database["public"]["Enums"]["attempt_channel"]
          created_at?: string
          data_proximo_passo?: string | null
          id?: string
          lead_id?: string
          observacao?: string | null
          proximo_passo?: string | null
          resultado?: Database["public"]["Enums"]["attempt_result"]
        }
        Relationships: [
          {
            foreignKeyName: "lead_attempts_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_attempts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_history: {
        Row: {
          ator_id: string
          created_at: string
          from_stage: Database["public"]["Enums"]["lead_stage"] | null
          id: string
          lead_id: string
          observacao: string | null
          to_stage: Database["public"]["Enums"]["lead_stage"]
        }
        Insert: {
          ator_id: string
          created_at?: string
          from_stage?: Database["public"]["Enums"]["lead_stage"] | null
          id?: string
          lead_id: string
          observacao?: string | null
          to_stage: Database["public"]["Enums"]["lead_stage"]
        }
        Update: {
          ator_id?: string
          created_at?: string
          from_stage?: Database["public"]["Enums"]["lead_stage"] | null
          id?: string
          lead_id?: string
          observacao?: string | null
          to_stage?: Database["public"]["Enums"]["lead_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "lead_history_ator_id_fkey"
            columns: ["ator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assessor_alocado_id: string | null
          client_id: string | null
          comercial_id: string
          contato_principal: string | null
          coord_alocado_id: string | null
          created_at: string
          data_fechamento: string | null
          data_prospeccao_agendada: string | null
          data_reuniao_marco_zero: string | null
          duracao_meses: number | null
          email: string | null
          id: string
          info_briefing: string | null
          motivo_perdido: string | null
          nome_prospect: string
          organization_id: string
          prioridade: Database["public"]["Enums"]["lead_priority"]
          servico_proposto: string | null
          site: string | null
          stage: Database["public"]["Enums"]["lead_stage"]
          telefone: string | null
          updated_at: string
          valor_proposto: number
        }
        Insert: {
          assessor_alocado_id?: string | null
          client_id?: string | null
          comercial_id: string
          contato_principal?: string | null
          coord_alocado_id?: string | null
          created_at?: string
          data_fechamento?: string | null
          data_prospeccao_agendada?: string | null
          data_reuniao_marco_zero?: string | null
          duracao_meses?: number | null
          email?: string | null
          id?: string
          info_briefing?: string | null
          motivo_perdido?: string | null
          nome_prospect: string
          organization_id: string
          prioridade?: Database["public"]["Enums"]["lead_priority"]
          servico_proposto?: string | null
          site?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          telefone?: string | null
          updated_at?: string
          valor_proposto?: number
        }
        Update: {
          assessor_alocado_id?: string | null
          client_id?: string | null
          comercial_id?: string
          contato_principal?: string | null
          coord_alocado_id?: string | null
          created_at?: string
          data_fechamento?: string | null
          data_prospeccao_agendada?: string | null
          data_reuniao_marco_zero?: string | null
          duracao_meses?: number | null
          email?: string | null
          id?: string
          info_briefing?: string | null
          motivo_perdido?: string | null
          nome_prospect?: string
          organization_id?: string
          prioridade?: Database["public"]["Enums"]["lead_priority"]
          servico_proposto?: string | null
          site?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          telefone?: string | null
          updated_at?: string
          valor_proposto?: number
        }
        Relationships: [
          {
            foreignKeyName: "leads_assessor_alocado_id_fkey"
            columns: ["assessor_alocado_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_comercial_id_fkey"
            columns: ["comercial_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_coord_alocado_id_fkey"
            columns: ["coord_alocado_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          email: boolean
          evento_tipo: Database["public"]["Enums"]["notification_event"]
          in_app: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          email?: boolean
          evento_tipo: Database["public"]["Enums"]["notification_event"]
          in_app?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          email?: boolean
          evento_tipo?: Database["public"]["Enums"]["notification_event"]
          in_app?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_rules: {
        Row: {
          ativo: boolean
          default_roles: string[]
          default_user_ids: string[]
          email_default: boolean
          evento_tipo: Database["public"]["Enums"]["notification_event"]
          mandatory: boolean
          permite_destinatarios_extras: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean
          default_roles?: string[]
          default_user_ids?: string[]
          email_default?: boolean
          evento_tipo: Database["public"]["Enums"]["notification_event"]
          mandatory?: boolean
          permite_destinatarios_extras?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean
          default_roles?: string[]
          default_user_ids?: string[]
          email_default?: boolean
          evento_tipo?: Database["public"]["Enums"]["notification_event"]
          mandatory?: boolean
          permite_destinatarios_extras?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_rules_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          link: string | null
          mensagem: string
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem: string
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      tasks: {
        Row: {
          atribuido_a: string
          client_id: string | null
          completed_at: string | null
          created_at: string
          criado_por: string
          descricao: string | null
          due_date: string | null
          id: string
          prioridade: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          titulo: string
          updated_at: string
        }
        Insert: {
          atribuido_a: string
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          criado_por: string
          descricao?: string | null
          due_date?: string | null
          id?: string
          prioridade?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          titulo: string
          updated_at?: string
        }
        Update: {
          atribuido_a?: string
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          criado_por?: string
          descricao?: string | null
          due_date?: string | null
          id?: string
          prioridade?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_atribuido_a_fkey"
            columns: ["atribuido_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      attempt_channel: "whatsapp" | "email" | "ligacao" | "presencial" | "outro"
      attempt_result:
        | "sem_resposta"
        | "agendou"
        | "recusou"
        | "pediu_proposta"
        | "outro"
      client_status: "ativo" | "churn" | "em_onboarding"
      file_category: "briefing" | "contrato" | "criativo" | "outro"
      important_date_type:
        | "aniversario_socio"
        | "renovacao"
        | "kickoff"
        | "custom"
      lead_priority: "alta" | "media" | "baixa"
      lead_stage:
        | "prospeccao"
        | "comercial"
        | "contrato"
        | "marco_zero"
        | "ativo"
      note_type: "reuniao" | "observacao" | "mudanca_status"
      notification_event:
        | "task_assigned"
        | "task_completed"
        | "kanban_moved"
        | "prospeccao_agendada"
        | "deal_fechado"
        | "mes_aguardando_aprovacao"
        | "mes_aprovado"
        | "cliente_perto_churn"
        | "task_prazo_amanha"
        | "task_overdue"
        | "evento_calendario_hoje"
        | "marco_zero_24h"
        | "aniversario_socio_cliente"
        | "aniversario_colaborador"
        | "renovacao_contrato"
        | "satisfacao_pendente"
      snapshot_item_tipo:
        | "fixo"
        | "carteira_assessor"
        | "carteira_coord_agencia"
        | "deal_fechado_comercial"
      snapshot_status: "pending_approval" | "aprovado"
      sub_calendar: "agencia" | "onboarding" | "aniversarios"
      task_priority: "alta" | "media" | "baixa"
      task_status: "aberta" | "em_andamento" | "concluida"
      theme_preference: "light" | "dark" | "system"
      user_role:
        | "adm"
        | "socio"
        | "comercial"
        | "coordenador"
        | "assessor"
        | "videomaker"
        | "designer"
        | "editor"
        | "audiovisual_chefe"
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
      attempt_channel: ["whatsapp", "email", "ligacao", "presencial", "outro"],
      attempt_result: [
        "sem_resposta",
        "agendou",
        "recusou",
        "pediu_proposta",
        "outro",
      ],
      client_status: ["ativo", "churn", "em_onboarding"],
      file_category: ["briefing", "contrato", "criativo", "outro"],
      important_date_type: [
        "aniversario_socio",
        "renovacao",
        "kickoff",
        "custom",
      ],
      lead_priority: ["alta", "media", "baixa"],
      lead_stage: [
        "prospeccao",
        "comercial",
        "contrato",
        "marco_zero",
        "ativo",
      ],
      note_type: ["reuniao", "observacao", "mudanca_status"],
      notification_event: [
        "task_assigned",
        "task_completed",
        "kanban_moved",
        "prospeccao_agendada",
        "deal_fechado",
        "mes_aguardando_aprovacao",
        "mes_aprovado",
        "cliente_perto_churn",
        "task_prazo_amanha",
        "task_overdue",
        "evento_calendario_hoje",
        "marco_zero_24h",
        "aniversario_socio_cliente",
        "aniversario_colaborador",
        "renovacao_contrato",
        "satisfacao_pendente",
      ],
      snapshot_item_tipo: [
        "fixo",
        "carteira_assessor",
        "carteira_coord_agencia",
        "deal_fechado_comercial",
      ],
      snapshot_status: ["pending_approval", "aprovado"],
      sub_calendar: ["agencia", "onboarding", "aniversarios"],
      task_priority: ["alta", "media", "baixa"],
      task_status: ["aberta", "em_andamento", "concluida"],
      theme_preference: ["light", "dark", "system"],
      user_role: [
        "adm",
        "socio",
        "comercial",
        "coordenador",
        "assessor",
        "videomaker",
        "designer",
        "editor",
        "audiovisual_chefe",
      ],
    },
  },
} as const
