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
      auth_rate_limit: {
        Row: {
          attempts: number
          blocked_until: string | null
          key: string
          window_start: string
        }
        Insert: {
          attempts?: number
          blocked_until?: string | null
          key: string
          window_start?: string
        }
        Update: {
          attempts?: number
          blocked_until?: string | null
          key?: string
          window_start?: string
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
          link_roteiro: string | null
          localizacao_endereco: string | null
          localizacao_maps_url: string | null
          observacoes_gravacao: string | null
          organization_id: string
          participantes_ids: string[]
          reminded_30min_at: string | null
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
          link_roteiro?: string | null
          localizacao_endereco?: string | null
          localizacao_maps_url?: string | null
          observacoes_gravacao?: string | null
          organization_id: string
          participantes_ids?: string[]
          reminded_30min_at?: string | null
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
          link_roteiro?: string | null
          localizacao_endereco?: string | null
          localizacao_maps_url?: string | null
          observacoes_gravacao?: string | null
          organization_id?: string
          participantes_ids?: string[]
          reminded_30min_at?: string | null
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
      client_onboarding_etapas: {
        Row: {
          id: string
          client_id: string
          etapa_numero: number
          etapa_codigo: string
          status: string
          dia_inicio_previsto: number | null
          dia_fim_previsto: number | null
          iniciado_em: string | null
          concluido_em: string | null
          concluido_por: string | null
          observacoes: string | null
          fluxo_checklist: Json
          saidas_checklist: Json
          d0_date: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          etapa_numero: number
          etapa_codigo: string
          status?: string
          dia_inicio_previsto?: number | null
          dia_fim_previsto?: number | null
          iniciado_em?: string | null
          concluido_em?: string | null
          concluido_por?: string | null
          observacoes?: string | null
          fluxo_checklist?: Json
          saidas_checklist?: Json
          d0_date: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          etapa_numero?: number
          etapa_codigo?: string
          status?: string
          dia_inicio_previsto?: number | null
          dia_fim_previsto?: number | null
          iniciado_em?: string | null
          concluido_em?: string | null
          concluido_por?: string | null
          observacoes?: string | null
          fluxo_checklist?: Json
          saidas_checklist?: Json
          d0_date?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_onboarding_etapas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_onboarding_etapas_concluido_por_fkey"
            columns: ["concluido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_self_satisfaction: {
        Row: {
          id: string
          client_id: string
          submitted_by: string
          score: number
          comentario: string | null
          submitted_at: string
        }
        Insert: {
          id?: string
          client_id: string
          submitted_by: string
          score: number
          comentario?: string | null
          submitted_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          submitted_by?: string
          score?: number
          comentario?: string | null
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_self_satisfaction_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_self_satisfaction_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      client_portal_users: {
        Row: {
          user_id: string
          client_id: string
          nome_contato: string | null
          ativo: boolean
          created_at: string
          last_login_at: string | null
        }
        Insert: {
          user_id: string
          client_id: string
          nome_contato?: string | null
          ativo?: boolean
          created_at?: string
          last_login_at?: string | null
        }
        Update: {
          user_id?: string
          client_id?: string
          nome_contato?: string | null
          ativo?: boolean
          created_at?: string
          last_login_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portal_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_monthly_adjustments: {
        Row: {
          client_id: string
          created_at: string
          criado_por: string
          id: string
          mes_referencia: string
          motivo: string
          tipo: Database["public"]["Enums"]["tipo_ajuste_mensal"]
          valor_desconto: number | null
        }
        Insert: {
          client_id: string
          created_at?: string
          criado_por: string
          id?: string
          mes_referencia: string
          motivo: string
          tipo: Database["public"]["Enums"]["tipo_ajuste_mensal"]
          valor_desconto?: number | null
        }
        Update: {
          client_id?: string
          created_at?: string
          criado_por?: string
          id?: string
          mes_referencia?: string
          motivo?: string
          tipo?: Database["public"]["Enums"]["tipo_ajuste_mensal"]
          valor_desconto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_monthly_adjustments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_monthly_adjustments_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_monthly_checklist: {
        Row: {
          client_id: string
          created_at: string
          gmn_avaliacoes: number
          gmn_comentarios: number
          gmn_nota_media: number | null
          gmn_observacoes: string | null
          gmn_otimizado: boolean
          id: string
          mes_referencia: string
          organization_id: string
          pacote_post: number | null
          quantidade_postada: number | null
          tpg_ativo: boolean | null
          tpm_ativo: boolean | null
          updated_at: string
          valor_trafego_mes: number | null
        }
        Insert: {
          client_id: string
          created_at?: string
          gmn_avaliacoes?: number
          gmn_comentarios?: number
          gmn_nota_media?: number | null
          gmn_observacoes?: string | null
          gmn_otimizado?: boolean
          id?: string
          mes_referencia: string
          organization_id: string
          pacote_post?: number | null
          quantidade_postada?: number | null
          tpg_ativo?: boolean | null
          tpm_ativo?: boolean | null
          updated_at?: string
          valor_trafego_mes?: number | null
        }
        Update: {
          client_id?: string
          created_at?: string
          gmn_avaliacoes?: number
          gmn_comentarios?: number
          gmn_nota_media?: number | null
          gmn_observacoes?: string | null
          gmn_otimizado?: boolean
          id?: string
          mes_referencia?: string
          organization_id?: string
          pacote_post?: number | null
          quantidade_postada?: number | null
          tpg_ativo?: boolean | null
          tpm_ativo?: boolean | null
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
          cadencia_reuniao:
            | Database["public"]["Enums"]["cadencia_reuniao"]
            | null
          contato_principal: string | null
          coordenador_id: string | null
          created_at: string
          crm_identifier: string | null
          crm_observacoes: string | null
          crm_tipo: string | null
          crm_url: string | null
          data_aniversario_socio_cliente: string | null
          data_churn: string | null
          data_entrada: string
          design_style_guide: Json | null
          designer_id: string | null
          drive_url: string | null
          editor_id: string | null
          email: string | null
          facebook_page_id: string | null
          gmn_location_id: string | null
          gmn_url: string | null
          google_ads_customer_id: string | null
          id: string
          instagram_business_id: string | null
          instagram_url: string | null
          link_estrategia: string | null
          linkedin_company_id: string | null
          meta_ad_account_id: string | null
          motivo_churn: string | null
          nome: string
          numero_unidades: number
          organization_id: string
          pacote_post_padrao: number | null
          servico_contratado: string | null
          status: Database["public"]["Enums"]["client_status"]
          telefone: string | null
          tipo_pacote: Database["public"]["Enums"]["tipo_pacote"]
          tipo_pacote_revisado: boolean
          tipo_relacao: Database["public"]["Enums"]["tipo_relacao_cliente"]
          updated_at: string
          valor_mensal: number
          valor_trafego_google: number | null
          valor_trafego_meta: number | null
          videomaker_id: string | null
        }
        Insert: {
          assessor_id?: string | null
          cadencia_reuniao?:
            | Database["public"]["Enums"]["cadencia_reuniao"]
            | null
          contato_principal?: string | null
          coordenador_id?: string | null
          created_at?: string
          crm_identifier?: string | null
          crm_observacoes?: string | null
          crm_tipo?: string | null
          crm_url?: string | null
          data_aniversario_socio_cliente?: string | null
          data_churn?: string | null
          data_entrada?: string
          design_style_guide?: Json | null
          designer_id?: string | null
          drive_url?: string | null
          editor_id?: string | null
          email?: string | null
          facebook_page_id?: string | null
          gmn_location_id?: string | null
          gmn_url?: string | null
          google_ads_customer_id?: string | null
          id?: string
          instagram_business_id?: string | null
          instagram_url?: string | null
          link_estrategia?: string | null
          linkedin_company_id?: string | null
          meta_ad_account_id?: string | null
          motivo_churn?: string | null
          nome: string
          numero_unidades?: number
          organization_id: string
          pacote_post_padrao?: number | null
          servico_contratado?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          telefone?: string | null
          tipo_pacote: Database["public"]["Enums"]["tipo_pacote"]
          tipo_pacote_revisado?: boolean
          tipo_relacao?: Database["public"]["Enums"]["tipo_relacao_cliente"]
          updated_at?: string
          valor_mensal?: number
          valor_trafego_google?: number | null
          valor_trafego_meta?: number | null
          videomaker_id?: string | null
        }
        Update: {
          assessor_id?: string | null
          cadencia_reuniao?:
            | Database["public"]["Enums"]["cadencia_reuniao"]
            | null
          contato_principal?: string | null
          coordenador_id?: string | null
          created_at?: string
          crm_identifier?: string | null
          crm_observacoes?: string | null
          crm_tipo?: string | null
          crm_url?: string | null
          data_aniversario_socio_cliente?: string | null
          data_churn?: string | null
          data_entrada?: string
          design_style_guide?: Json | null
          designer_id?: string | null
          drive_url?: string | null
          editor_id?: string | null
          email?: string | null
          facebook_page_id?: string | null
          gmn_location_id?: string | null
          gmn_url?: string | null
          google_ads_customer_id?: string | null
          id?: string
          instagram_business_id?: string | null
          instagram_url?: string | null
          link_estrategia?: string | null
          linkedin_company_id?: string | null
          meta_ad_account_id?: string | null
          motivo_churn?: string | null
          nome?: string
          numero_unidades?: number
          organization_id?: string
          pacote_post_padrao?: number | null
          servico_contratado?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          telefone?: string | null
          tipo_pacote?: Database["public"]["Enums"]["tipo_pacote"]
          tipo_pacote_revisado?: boolean
          tipo_relacao?: Database["public"]["Enums"]["tipo_relacao_cliente"]
          updated_at?: string
          valor_mensal?: number
          valor_trafego_google?: number | null
          valor_trafego_meta?: number | null
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
      design_artes: {
        Row: {
          ai_metadata: Json | null
          ai_modelo: string | null
          ai_prompt: string | null
          agendado_para: string | null
          ajuste_observacoes: string | null
          aprovacao_token: string | null
          aprovado_em: string | null
          aprovado_por_email: string | null
          archived_at: string | null
          client_id: string
          copy: string | null
          created_at: string
          criado_por: string | null
          descricao: string | null
          fonte_origem: string
          formato: string
          hashtags: string | null
          id: string
          midias: Json
          observacoes: string | null
          organization_id: string
          publicado_em: string | null
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ai_metadata?: Json | null
          ai_modelo?: string | null
          ai_prompt?: string | null
          agendado_para?: string | null
          ajuste_observacoes?: string | null
          aprovacao_token?: string | null
          aprovado_em?: string | null
          aprovado_por_email?: string | null
          archived_at?: string | null
          client_id: string
          copy?: string | null
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          fonte_origem?: string
          formato?: string
          hashtags?: string | null
          id?: string
          midias?: Json
          observacoes?: string | null
          organization_id: string
          publicado_em?: string | null
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          ai_metadata?: Json | null
          ai_modelo?: string | null
          ai_prompt?: string | null
          agendado_para?: string | null
          ajuste_observacoes?: string | null
          aprovacao_token?: string | null
          aprovado_em?: string | null
          aprovado_por_email?: string | null
          archived_at?: string | null
          client_id?: string
          copy?: string | null
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          fonte_origem?: string
          formato?: string
          hashtags?: string | null
          id?: string
          midias?: Json
          observacoes?: string | null
          organization_id?: string
          publicado_em?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_artes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_artes_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_artes_organization_id_fkey"
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
          link_proposta: string | null
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
          link_proposta?: string | null
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
          link_proposta?: string | null
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
      leads_gerados: {
        Row: {
          arquivado_em: string | null
          categoria: string | null
          cidade: string | null
          created_at: string
          decisor_cargo: string | null
          decisor_email: string | null
          decisor_linkedin: string | null
          decisor_nome: string | null
          decisor_telefone: string | null
          diagnostico: Json
          dominio: string | null
          email: string | null
          empresa: string
          endereco: string | null
          estado: string | null
          fonte: string
          google_maps_url: string | null
          google_place_id: string | null
          google_rating: number | null
          google_reviews_count: number | null
          horario_funcionamento: string | null
          id: string
          instagram: string | null
          instagram_ativo: boolean | null
          instagram_bio: string | null
          instagram_metadata: Json
          instagram_posts: number | null
          instagram_seguidores: number | null
          instagram_seguindo: number | null
          latitude: number | null
          lead_onboarding_id: string | null
          longitude: number | null
          observacoes: string | null
          observacoes_ia: string | null
          organization_id: string
          outros_decisores: Json
          pais: string | null
          pesquisa_id: string | null
          potencial_comercial: string | null
          qualificado: boolean | null
          raw_data: Json | null
          responsavel_id: string | null
          score: number | null
          status: string
          tags: string[]
          telefone: string | null
          updated_at: string
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          arquivado_em?: string | null
          categoria?: string | null
          cidade?: string | null
          created_at?: string
          decisor_cargo?: string | null
          decisor_email?: string | null
          decisor_linkedin?: string | null
          decisor_nome?: string | null
          decisor_telefone?: string | null
          diagnostico?: Json
          dominio?: string | null
          email?: string | null
          empresa: string
          endereco?: string | null
          estado?: string | null
          fonte?: string
          google_maps_url?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          google_reviews_count?: number | null
          horario_funcionamento?: string | null
          id?: string
          instagram?: string | null
          instagram_ativo?: boolean | null
          instagram_bio?: string | null
          instagram_metadata?: Json
          instagram_posts?: number | null
          instagram_seguidores?: number | null
          instagram_seguindo?: number | null
          latitude?: number | null
          lead_onboarding_id?: string | null
          longitude?: number | null
          observacoes?: string | null
          observacoes_ia?: string | null
          organization_id: string
          outros_decisores?: Json
          pais?: string | null
          pesquisa_id?: string | null
          potencial_comercial?: string | null
          qualificado?: boolean | null
          raw_data?: Json | null
          responsavel_id?: string | null
          score?: number | null
          status?: string
          tags?: string[]
          telefone?: string | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          arquivado_em?: string | null
          categoria?: string | null
          cidade?: string | null
          created_at?: string
          decisor_cargo?: string | null
          decisor_email?: string | null
          decisor_linkedin?: string | null
          decisor_nome?: string | null
          decisor_telefone?: string | null
          diagnostico?: Json
          dominio?: string | null
          email?: string | null
          empresa?: string
          endereco?: string | null
          estado?: string | null
          fonte?: string
          google_maps_url?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          google_reviews_count?: number | null
          horario_funcionamento?: string | null
          id?: string
          instagram?: string | null
          instagram_ativo?: boolean | null
          instagram_bio?: string | null
          instagram_metadata?: Json
          instagram_posts?: number | null
          instagram_seguidores?: number | null
          instagram_seguindo?: number | null
          latitude?: number | null
          lead_onboarding_id?: string | null
          longitude?: number | null
          observacoes?: string | null
          observacoes_ia?: string | null
          organization_id?: string
          outros_decisores?: Json
          pais?: string | null
          pesquisa_id?: string | null
          potencial_comercial?: string | null
          qualificado?: boolean | null
          raw_data?: Json | null
          responsavel_id?: string | null
          score?: number | null
          status?: string
          tags?: string[]
          telefone?: string | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_gerados_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_gerados_pesquisa_id_fkey"
            columns: ["pesquisa_id"]
            isOneToOne: false
            referencedRelation: "leads_gerados_pesquisas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_gerados_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_gerados_lead_onboarding_id_fkey"
            columns: ["lead_onboarding_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_gerados_pesquisas: {
        Row: {
          cidade: string
          concluido_em: string | null
          created_at: string
          criado_por: string | null
          erro_mensagem: string | null
          external_request_id: string | null
          fonte: string
          id: string
          iniciado_em: string | null
          limite: number
          nicho: string
          organization_id: string
          query: string | null
          status: string
          total_novos: number
          total_resultados: number
        }
        Insert: {
          cidade: string
          concluido_em?: string | null
          created_at?: string
          criado_por?: string | null
          erro_mensagem?: string | null
          external_request_id?: string | null
          fonte?: string
          id?: string
          iniciado_em?: string | null
          limite?: number
          nicho: string
          organization_id: string
          query?: string | null
          status?: string
          total_novos?: number
          total_resultados?: number
        }
        Update: {
          cidade?: string
          concluido_em?: string | null
          created_at?: string
          criado_por?: string | null
          erro_mensagem?: string | null
          external_request_id?: string | null
          fonte?: string
          id?: string
          iniciado_em?: string | null
          limite?: number
          nicho?: string
          organization_id?: string
          query?: string | null
          status?: string
          total_novos?: number
          total_resultados?: number
        }
        Relationships: [
          {
            foreignKeyName: "leads_gerados_pesquisas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_gerados_pesquisas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ligacoes: {
        Row: {
          arquivado_em: string | null
          client_id: string | null
          colaborador_id: string | null
          contato_nome: string | null
          created_at: string
          direcao: string
          duracao_segundos: number
          external_id: string | null
          finalizada_em: string | null
          gravacao_url: string | null
          id: string
          iniciada_em: string
          lead_gerado_id: string | null
          lead_id: string | null
          numero: string
          observacoes: string | null
          organization_id: string
          origem: string
          instancia_id: string | null
          raw_data: Json | null
          resumo_ia: string | null
          status: string
          tags: string[]
          tipo: string
          transcricao: string | null
          updated_at: string
        }
        Insert: {
          arquivado_em?: string | null
          client_id?: string | null
          colaborador_id?: string | null
          contato_nome?: string | null
          created_at?: string
          direcao?: string
          duracao_segundos?: number
          external_id?: string | null
          finalizada_em?: string | null
          gravacao_url?: string | null
          id?: string
          iniciada_em: string
          lead_gerado_id?: string | null
          lead_id?: string | null
          numero: string
          observacoes?: string | null
          organization_id: string
          origem?: string
          instancia_id?: string | null
          raw_data?: Json | null
          resumo_ia?: string | null
          status: string
          tags?: string[]
          tipo: string
          transcricao?: string | null
          updated_at?: string
        }
        Update: {
          arquivado_em?: string | null
          client_id?: string | null
          colaborador_id?: string | null
          contato_nome?: string | null
          created_at?: string
          direcao?: string
          duracao_segundos?: number
          external_id?: string | null
          finalizada_em?: string | null
          gravacao_url?: string | null
          id?: string
          iniciada_em?: string
          instancia_id?: string | null
          lead_gerado_id?: string | null
          lead_id?: string | null
          numero?: string
          observacoes?: string | null
          organization_id?: string
          origem?: string
          raw_data?: Json | null
          resumo_ia?: string | null
          status?: string
          tags?: string[]
          tipo?: string
          transcricao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ligacoes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ligacoes_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ligacoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ligacoes_lead_gerado_id_fkey"
            columns: ["lead_gerado_id"]
            isOneToOne: false
            referencedRelation: "leads_gerados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ligacoes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ligacoes_instancia_id_fkey"
            columns: ["instancia_id"]
            isOneToOne: false
            referencedRelation: "ligacoes_instancias"
            referencedColumns: ["id"]
          },
        ]
      }
      ligacoes_instancias: {
        Row: {
          arquivado_em: string | null
          colaborador_id: string | null
          created_at: string
          credenciais: Json
          id: string
          nome: string
          numero: string | null
          organization_id: string
          provedor: string
          ramal: string | null
          status: string
          status_mensagem: string | null
          tipo: string
          total_ligacoes: number
          ultimo_evento_em: string | null
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          arquivado_em?: string | null
          colaborador_id?: string | null
          created_at?: string
          credenciais?: Json
          id?: string
          nome: string
          numero?: string | null
          organization_id: string
          provedor?: string
          ramal?: string | null
          status?: string
          status_mensagem?: string | null
          tipo: string
          total_ligacoes?: number
          ultimo_evento_em?: string | null
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          arquivado_em?: string | null
          colaborador_id?: string | null
          created_at?: string
          credenciais?: Json
          id?: string
          nome?: string
          numero?: string | null
          organization_id?: string
          provedor?: string
          ramal?: string | null
          status?: string
          status_mensagem?: string | null
          tipo?: string
          total_ligacoes?: number
          ultimo_evento_em?: string | null
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ligacoes_instancias_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ligacoes_instancias_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          trafego_metricas_visiveis: string[] | null
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
          trafego_metricas_visiveis?: string[] | null
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
          trafego_metricas_visiveis?: string[] | null
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
      social_media_posts: {
        Row: {
          agendar_para: string | null
          ajuste_observacoes: string | null
          aprovacao_token: string | null
          aprovado_em: string | null
          aprovado_por_email: string | null
          archived_at: string | null
          client_id: string
          created_at: string
          criado_por: string | null
          design_arte_id: string | null
          formato: string
          hashtags: string | null
          id: string
          legenda: string | null
          midias: Json
          observacoes: string | null
          organization_id: string
          primeiro_comentario: string | null
          redes: string[]
          status: string
          titulo: string | null
          updated_at: string
        }
        Insert: {
          agendar_para?: string | null
          ajuste_observacoes?: string | null
          aprovacao_token?: string | null
          aprovado_em?: string | null
          aprovado_por_email?: string | null
          archived_at?: string | null
          client_id: string
          created_at?: string
          criado_por?: string | null
          design_arte_id?: string | null
          formato?: string
          hashtags?: string | null
          id?: string
          legenda?: string | null
          midias?: Json
          observacoes?: string | null
          organization_id: string
          primeiro_comentario?: string | null
          redes?: string[]
          status?: string
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          agendar_para?: string | null
          ajuste_observacoes?: string | null
          aprovacao_token?: string | null
          aprovado_em?: string | null
          aprovado_por_email?: string | null
          archived_at?: string | null
          client_id?: string
          created_at?: string
          criado_por?: string | null
          design_arte_id?: string | null
          formato?: string
          hashtags?: string | null
          id?: string
          legenda?: string | null
          midias?: Json
          observacoes?: string | null
          organization_id?: string
          primeiro_comentario?: string | null
          redes?: string[]
          status?: string
          titulo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_media_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_media_posts_design_arte_id_fkey"
            columns: ["design_arte_id"]
            isOneToOne: false
            referencedRelation: "design_artes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_media_posts_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_media_posts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      social_media_publicacoes: {
        Row: {
          created_at: string
          erro: string | null
          external_id: string | null
          external_url: string | null
          id: string
          post_id: string
          publicado_em: string | null
          rede: string
        }
        Insert: {
          created_at?: string
          erro?: string | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          post_id: string
          publicado_em?: string | null
          rede: string
        }
        Update: {
          created_at?: string
          erro?: string | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          post_id?: string
          publicado_em?: string | null
          rede?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_media_publicacoes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_media_posts"
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
          drive_link: string | null
          entrega_observacoes: string | null
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
          drive_link?: string | null
          entrega_observacoes?: string | null
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
          drive_link?: string | null
          entrega_observacoes?: string | null
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
      trafego_campanhas: {
        Row: {
          archived_at: string | null
          budget_diario: number | null
          budget_total: number | null
          client_id: string
          copy: string | null
          created_at: string
          created_by: string | null
          criativo_url: string | null
          data_fim: string | null
          data_inicio: string | null
          external_account_id: string | null
          external_ad_id: string | null
          external_adset_id: string | null
          external_campaign_id: string | null
          id: string
          link_destino: string | null
          nome: string
          objetivo: string | null
          observacoes: string | null
          organization_id: string
          plataforma: string
          publico_alvo: string | null
          status: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          budget_diario?: number | null
          budget_total?: number | null
          client_id: string
          copy?: string | null
          created_at?: string
          created_by?: string | null
          criativo_url?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          external_account_id?: string | null
          external_ad_id?: string | null
          external_adset_id?: string | null
          external_campaign_id?: string | null
          id?: string
          link_destino?: string | null
          nome: string
          objetivo?: string | null
          observacoes?: string | null
          organization_id: string
          plataforma: string
          publico_alvo?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          budget_diario?: number | null
          budget_total?: number | null
          client_id?: string
          copy?: string | null
          created_at?: string
          created_by?: string | null
          criativo_url?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          external_account_id?: string | null
          external_ad_id?: string | null
          external_adset_id?: string | null
          external_campaign_id?: string | null
          id?: string
          link_destino?: string | null
          nome?: string
          objetivo?: string | null
          observacoes?: string | null
          organization_id?: string
          plataforma?: string
          publico_alvo?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trafego_campanhas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trafego_campanhas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trafego_campanhas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trafego_metricas_diarias: {
        Row: {
          campanha_id: string
          created_at: string
          data: string
          fonte: string
          id: string
          metrica_key: string
          valor_numerico: number | null
          valor_texto: string | null
        }
        Insert: {
          campanha_id: string
          created_at?: string
          data: string
          fonte?: string
          id?: string
          metrica_key: string
          valor_numerico?: number | null
          valor_texto?: string | null
        }
        Update: {
          campanha_id?: string
          created_at?: string
          data?: string
          fonte?: string
          id?: string
          metrica_key?: string
          valor_numerico?: number | null
          valor_texto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trafego_metricas_diarias_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "trafego_campanhas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_auth_rate_limit: {
        Args: {
          block_seconds?: number
          max_attempts: number
          rate_key: string
          window_seconds: number
        }
        Returns: {
          allowed: boolean
          retry_after_seconds: number
        }[]
      }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_my_profile_sensitive: {
        Args: never
        Returns: {
          comissao_percent: number
          comissao_primeiro_mes_percent: number
          data_admissao: string
          data_nascimento: string
          endereco: string
          fixo_mensal: number
          meta_fechamentos_mes: number
          meta_prospects_mes: number
          meta_receita_mes: number
          pix: string
          telefone: string
        }[]
      }
      recados_team_member_ids: { Args: { autor: string }; Returns: string[] }
      reset_auth_rate_limit: { Args: { rate_key: string }; Returns: undefined }
    }
    Enums: {
      attempt_channel: "whatsapp" | "email" | "ligacao" | "presencial" | "outro"
      attempt_result:
        | "sem_resposta"
        | "agendou"
        | "recusou"
        | "pediu_proposta"
        | "outro"
      cadencia_reuniao: "semanal" | "quinzenal" | "mensal" | "trimestral"
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
      checklist_step_status:
        | "pendente"
        | "em_andamento"
        | "pronto"
        | "atrasada"
        | "delegado"
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
        | "evento_calendario_amanha"
        | "evento_calendario_30min"
        | "chat_mensagem"
        | "task_alteracao_solicitada"
      satisfaction_color: "verde" | "amarelo" | "vermelho"
      snapshot_item_tipo:
        | "fixo"
        | "carteira_assessor"
        | "carteira_coord_agencia"
        | "deal_fechado_comercial"
      snapshot_status: "pending_approval" | "aprovado"
      sub_calendar:
        | "agencia"
        | "onboarding"
        | "aniversarios"
        | "videomakers"
        | "assessores"
        | "coordenadores"
      task_priority: "alta" | "media" | "baixa"
      task_status:
        | "aberta"
        | "em_andamento"
        | "concluida"
        | "alteracao"
        | "agendado"
      theme_preference: "light" | "dark" | "system"
      tipo_ajuste_mensal: "desconto_parcial" | "gratuidade_total"
      tipo_pacote:
        | "trafego_estrategia"
        | "trafego"
        | "estrategia"
        | "audiovisual"
        | "yide_360"
        | "ecommerce"
        | "site"
        | "ia"
        | "crm"
        | "crm_ia"
      tipo_relacao_cliente: "comum" | "parceria" | "permuta"
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
      cadencia_reuniao: ["semanal", "quinzenal", "mensal", "trimestral"],
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
      checklist_step_status: [
        "pendente",
        "em_andamento",
        "pronto",
        "atrasada",
        "delegado",
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
        "checklist_step_delegada",
        "checklist_step_atrasada",
        "checklist_step_concluida",
        "recado_novo",
        "evento_calendario_amanha",
        "evento_calendario_30min",
        "chat_mensagem",
        "task_alteracao_solicitada",
      ],
      satisfaction_color: ["verde", "amarelo", "vermelho"],
      snapshot_item_tipo: [
        "fixo",
        "carteira_assessor",
        "carteira_coord_agencia",
        "deal_fechado_comercial",
      ],
      snapshot_status: ["pending_approval", "aprovado"],
      sub_calendar: [
        "agencia",
        "onboarding",
        "aniversarios",
        "videomakers",
        "assessores",
        "coordenadores",
      ],
      task_priority: ["alta", "media", "baixa"],
      task_status: ["aberta", "em_andamento", "concluida", "alteracao", "agendado"],
      theme_preference: ["light", "dark", "system"],
      tipo_ajuste_mensal: ["desconto_parcial", "gratuidade_total"],
      tipo_pacote: [
        "trafego_estrategia",
        "trafego",
        "estrategia",
        "audiovisual",
        "yide_360",
        "ecommerce",
        "site",
        "ia",
        "crm",
        "crm_ia",
      ],
      tipo_relacao_cliente: ["comum", "parceria", "permuta"],
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
