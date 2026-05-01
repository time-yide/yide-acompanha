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
      checklist_step: {
        Row: {
          checklist_id: string
          completed_at: string | null
          completed_by: string | null
          id: string
          iniciado_em: string | null
          responsavel_id: string | null
          status: Database["public"]["Enums"]["checklist_step_status"]
          step_key: Database["public"]["Enums"]["checklist_step_key"]
        }
        Insert: {
          checklist_id: string
          completed_at?: string | null
          completed_by?: string | null
          id?: string
          iniciado_em?: string | null
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["checklist_step_status"]
          step_key: Database["public"]["Enums"]["checklist_step_key"]
        }
        Update: {
          checklist_id?: string
          completed_at?: string | null
          completed_by?: string | null
          id?: string
          iniciado_em?: string | null
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["checklist_step_status"]
          step_key?: Database["public"]["Enums"]["checklist_step_key"]
        }
        Relationships: [
          {
            foreignKeyName: "checklist_step_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "client_monthly_checklist"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_step_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_step_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      client_monthly_checklist: {
        Row: {
          client_id: string
          created_at: string
          id: string
          mes_referencia: string
          organization_id: string
          pacote_post: number | null
          quantidade_postada: number | null
          updated_at: string
          valor_trafego_mes: number | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          mes_referencia: string
          organization_id: string
          pacote_post?: number | null
          quantidade_postada?: number | null
          updated_at?: string
          valor_trafego_mes?: number | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          mes_referencia?: string
          organization_id?: string
          pacote_post?: number | null
          quantidade_postada?: number | null
          updated_at?: string
          valor_trafego_mes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_monthly_checklist_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_monthly_checklist_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          designer_id: string | null
          drive_url: string | null
          editor_id: string | null
          email: string | null
          gmn_url: string | null
          id: string
          instagram_url: string | null
          motivo_churn: string | null
          nome: string
          organization_id: string
          pacote_post_padrao: number | null
          servico_contratado: string | null
          status: Database["public"]["Enums"]["client_status"]
          telefone: string | null
          updated_at: string
          valor_mensal: number
          videomaker_id: string | null
        }
        Insert: {
          assessor_id?: string | null
          contato_principal?: string | null
          coordenador_id?: string | null
          created_at?: string
          data_aniversario_socio_cliente?: string | null
          data_churn?: string | null
          data_entrada?: string
          designer_id?: string | null
          drive_url?: string | null
          editor_id?: string | null
          email?: string | null
          gmn_url?: string | null
          id?: string
          instagram_url?: string | null
          motivo_churn?: string | null
          nome: string
          organization_id: string
          pacote_post_padrao?: number | null
          servico_contratado?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          telefone?: string | null
          updated_at?: string
          valor_mensal?: number
          videomaker_id?: string | null
        }
        Update: {
          assessor_id?: string | null
          contato_principal?: string | null
          coordenador_id?: string | null
          created_at?: string
          data_aniversario_socio_cliente?: string | null
          data_churn?: string | null
          data_entrada?: string
          designer_id?: string | null
          drive_url?: string | null
          editor_id?: string | null
          email?: string | null
          gmn_url?: string | null
          id?: string
          instagram_url?: string | null
          motivo_churn?: string | null
          nome?: string
          organization_id?: string
          pacote_post_padrao?: number | null
          servico_contratado?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          telefone?: string | null
          updated_at?: string
          valor_mensal?: number
          videomaker_id?: string | null
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
            foreignKeyName: "clients_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_editor_id_fkey"
            columns: ["editor_id"]
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
          {
            foreignKeyName: "clients_videomaker_id_fkey"
            columns: ["videomaker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          meta_fechamentos_mes: number | null
          meta_prospects_mes: number | null
          meta_receita_mes: number | null
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
          meta_fechamentos_mes?: number | null
          meta_prospects_mes?: number | null
          meta_receita_mes?: number | null
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
          meta_fechamentos_mes?: number | null
          meta_prospects_mes?: number | null
          meta_receita_mes?: number | null
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
      recado_reacoes: {
        Row: {
          criado_em: string
          emoji: string
          recado_id: string
          user_id: string
        }
        Insert: {
          criado_em?: string
          emoji: string
          recado_id: string
          user_id: string
        }
        Update: {
          criado_em?: string
          emoji?: string
          recado_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recado_reacoes_recado_id_fkey"
            columns: ["recado_id"]
            isOneToOne: false
            referencedRelation: "recados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recado_reacoes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recado_visualizacoes: {
        Row: {
          last_seen_at: string
          user_id: string
        }
        Insert: {
          last_seen_at?: string
          user_id: string
        }
        Update: {
          last_seen_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recado_visualizacoes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recados: {
        Row: {
          arquivado: boolean
          atualizado_em: string
          autor_id: string | null
          autor_role_snapshot: string
          corpo: string
          criado_em: string
          id: string
          notif_scope: string
          permanente: boolean
          titulo: string
        }
        Insert: {
          arquivado?: boolean
          atualizado_em?: string
          autor_id?: string | null
          autor_role_snapshot: string
          corpo: string
          criado_em?: string
          id?: string
          notif_scope: string
          permanente?: boolean
          titulo: string
        }
        Update: {
          arquivado?: boolean
          atualizado_em?: string
          autor_id?: string | null
          autor_role_snapshot?: string
          corpo?: string
          criado_em?: string
          id?: string
          notif_scope?: string
          permanente?: boolean
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "recados_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      satisfaction_entries: {
        Row: {
          autor_id: string
          client_id: string
          comentario: string | null
          cor: Database["public"]["Enums"]["satisfaction_color"] | null
          created_at: string
          id: string
          papel_autor: string
          semana_iso: string
          updated_at: string
        }
        Insert: {
          autor_id: string
          client_id: string
          comentario?: string | null
          cor?: Database["public"]["Enums"]["satisfaction_color"] | null
          created_at?: string
          id?: string
          papel_autor: string
          semana_iso: string
          updated_at?: string
        }
        Update: {
          autor_id?: string
          client_id?: string
          comentario?: string | null
          cor?: Database["public"]["Enums"]["satisfaction_color"] | null
          created_at?: string
          id?: string
          papel_autor?: string
          semana_iso?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "satisfaction_entries_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "satisfaction_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      satisfaction_synthesis: {
        Row: {
          acao_sugerida: string | null
          ai_input_hash: string | null
          ai_tokens_used: number | null
          client_id: string
          cor_final: Database["public"]["Enums"]["satisfaction_color"]
          created_at: string
          divergencia_detectada: boolean
          id: string
          resumo_ia: string
          score_final: number
          semana_iso: string
        }
        Insert: {
          acao_sugerida?: string | null
          ai_input_hash?: string | null
          ai_tokens_used?: number | null
          client_id: string
          cor_final: Database["public"]["Enums"]["satisfaction_color"]
          created_at?: string
          divergencia_detectada?: boolean
          id?: string
          resumo_ia: string
          score_final: number
          semana_iso: string
        }
        Update: {
          acao_sugerida?: string | null
          ai_input_hash?: string | null
          ai_tokens_used?: number | null
          client_id?: string
          cor_final?: Database["public"]["Enums"]["satisfaction_color"]
          created_at?: string
          divergencia_detectada?: boolean
          id?: string
          resumo_ia?: string
          score_final?: number
          semana_iso?: string
        }
        Relationships: [
          {
            foreignKeyName: "satisfaction_synthesis_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
      recados_team_member_ids: { Args: { autor: string }; Returns: string[] }
    }
    Enums: {
      attempt_channel: "whatsapp" | "email" | "ligacao" | "presencial" | "outro"
      attempt_result:
        | "sem_resposta"
        | "agendou"
        | "recusou"
        | "pediu_proposta"
        | "outro"
      checklist_step_key:
        | "cronograma"
        | "design"
        | "tpg"
        | "tpm"
        | "valor_trafego"
        | "gmn_post"
        | "camera"
        | "mobile"
        | "edicao"
        | "reuniao"
        | "postagem"
      checklist_step_status: "pendente" | "em_andamento" | "pronto" | "atrasada"
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
        | "checklist_step_delegada"
        | "checklist_step_atrasada"
        | "checklist_step_concluida"
        | "recado_novo"
      satisfaction_color: "verde" | "amarelo" | "vermelho"
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
      checklist_step_key: [
        "cronograma",
        "design",
        "tpg",
        "tpm",
        "valor_trafego",
        "gmn_post",
        "camera",
        "mobile",
        "edicao",
        "reuniao",
        "postagem",
      ],
      checklist_step_status: ["pendente", "em_andamento", "pronto", "atrasada"],
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
        "checklist_step_delegada",
        "checklist_step_atrasada",
        "checklist_step_concluida",
        "recado_novo",
      ],
      satisfaction_color: ["verde", "amarelo", "vermelho"],
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
