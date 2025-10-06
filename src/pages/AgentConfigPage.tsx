import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Bot, Save, ArrowLeft, History, Users, MessageSquare, Sparkles, Code, Info, Lock, Zap, Headphones, Server, Gauge, DollarSign, Share2, Copy, Trash2, RotateCcw } from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import { useToast } from "@/hooks/use-toast";
import { Agent } from "@/contexts/AppContext";
import { supabase } from "@/lib/supabaseClient";
import { listOpenAIAssistants, getAvailableModels, getOpenAIAssistant, getGenModelInfo, getEmbeddingModelInfo, fetchModelCatalog, getCatalogGenModelInfo, getCatalogEmbeddingModelInfo, getLLMKey, ensureVectorStoreForAgent, type ModelCatalog } from "@/lib/llm";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";

const AgentConfigPage = () => {
  const { agentId, id } = useParams();
  const routeAgentId = agentId ?? id;
  const navigate = useNavigate();
  const { currentUser, agents, setAgents, organization } = useApp();
  const location = useLocation();
  const { toast } = useToast();

  const agent = agents.find(a => a.id === routeAgentId || a.slug === routeAgentId);
  const isNewAgent = !routeAgentId;
  const [sharePerm, setSharePerm] = useState<'none'|'view'|'edit'|'admin'|'loading'>(isNewAgent ? 'admin' : 'loading');

  // Inicializa com valor estável para não variar ordem de hooks; sincroniza via useEffect abaixo
  const [agentType, setAgentType] = useState<'custom' | 'assistant'>('custom');
  const [assistantProvider, setAssistantProvider] = useState<'openai' | 'anthropic' | 'google' | 'custom'>((agent?.assistant_provider as any) || 'openai');
  const [assistantId, setAssistantId] = useState(agent?.assistant_id || '');
  const [selectedAssistant, setSelectedAssistant] = useState(agent?.assistant_id || '');
  const [fetchedAssistants, setFetchedAssistants] = useState<{ id: string; name: string; description?: string }[]>([]);
  const [loadingAssistants, setLoadingAssistants] = useState(false);
  // Toggle para salvar o Assistant ID como padrão local (navegador)
  const [saveLocalAssistant, setSaveLocalAssistant] = useState<boolean>(false);
  const [modelCatalog, setModelCatalog] = useState<ModelCatalog | null>(null);
  // Hooks de dados dinâmicos DEVEM vir antes de quaisquer returns condicionais para manter a ordem
  const [availableModels, setAvailableModels] = useState<{ value: string; label: string; description?: string; provider: string }[]>([]);
  const [name, setName] = useState(agent?.name || "");
  const [description, setDescription] = useState(agent?.description || "");
  const [category, setCategory] = useState(agent?.category || "");
  const [requestedPublic, setRequestedPublic] = useState<boolean>(false);
  const [model, setModel] = useState(agent?.model || "gpt-4");
  const [systemPrompt, setSystemPrompt] = useState(agent?.systemPrompt || "");
  const [tags, setTags] = useState(agent?.tags?.join(", ") || "");
  const [retentionLimit, setRetentionLimit] = useState<number>(agent?.retention_limit || 200);
  const [retentionDays, setRetentionDays] = useState<number>(agent?.retention_days || 0);
  const [prevAssistantInstructions, setPrevAssistantInstructions] = useState<string>("");
  const [assistantInstructionsImported, setAssistantInstructionsImported] = useState<boolean>(false);
  const [prevName, setPrevName] = useState<string>(name);
  const [prevDescription, setPrevDescription] = useState<string>(description);
  const [allowUploads, setAllowUploads] = useState<boolean>(agent?.allow_file_uploads ?? false);
  const [fileStorageMode, setFileStorageMode] = useState<'openai_vector_store'|'local_rag'>(agent?.file_storage_mode ?? 'openai_vector_store');
  const [vectorStoreId, setVectorStoreId] = useState<string | null>((agent as any)?.vector_store_id || null);
  const [vsFiles, setVsFiles] = useState<Array<{ id: string; filename?: string; created_at?: string }>>([]);
  const [vsLoading, setVsLoading] = useState<boolean>(false);
  const [vsUploading, setVsUploading] = useState<boolean>(false);
  const [deletingAgent, setDeletingAgent] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  // Novos campos: provider de geração e de embeddings
  const [generationProvider, setGenerationProvider] = useState<'openai'|'anthropic'|'google'|'perplexity'|'ollama'>(
    (agent as any)?.generation_provider || 'openai'
  );
  
  // Debug: wrapper para setGenerationProvider
  const debugSetGenerationProvider = (value: 'openai'|'anthropic'|'google'|'perplexity'|'ollama') => {
    console.log('🔄 setGenerationProvider chamado:', { de: generationProvider, para: value });
    setGenerationProvider(value);
  };
  const [embeddingProvider, setEmbeddingProvider] = useState<'openai'|'ollama'>(
    (agent as any)?.embedding_provider || 'openai'
  );
  const [embeddingModel, setEmbeddingModel] = useState<string>((agent as any)?.embedding_model || '');
  const [ollamaUrl, setOllamaUrl] = useState<string>((agent as any)?.ollama_url || 'http://localhost:11434');
  
  // Debug: estado inicial
  console.log('🚀 Estado inicial do componente:', { 
    agent, 
    generationProviderFromAgent: (agent as any)?.generation_provider, 
    generationProviderState: generationProvider,
    model: agent?.model,
    embeddingProviderFromAgent: (agent as any)?.embedding_provider,
    embeddingProviderState: embeddingProvider,
    embeddingModelFromAgent: (agent as any)?.embedding_model,
    embeddingModelState: embeddingModel,
    ollamaUrlFromAgent: (agent as any)?.ollama_url,
    ollamaUrlState: ollamaUrl,
  });
  const [reindexing, setReindexing] = useState(false);
  const [reindexedCount, setReindexedCount] = useState<number | null>(null);
  // Integrações / Ações externas (n8n)
  const [externalActions, setExternalActions] = useState<Array<{ id: string; name: string; url: string; method: string; enabled: boolean }>>([]);
  const [selectedActionIds, setSelectedActionIds] = useState<Set<string>>(new Set());
  const [loadingActions, setLoadingActions] = useState<boolean>(false);
  // Busca defensiva do agente por slug/id quando ainda não está no contexto
  const [findingAgent, setFindingAgent] = useState<boolean>(false);
  // Memória & Contexto por agente
  const [historyTokenLimit, setHistoryTokenLimit] = useState<number>((agent as any)?.history_token_limit || 12000);
  const [enableSummarization, setEnableSummarization] = useState<boolean>((agent as any)?.enable_summarization ?? false);
  const [summarizationTokenThreshold, setSummarizationTokenThreshold] = useState<number>((agent as any)?.summarization_token_threshold || 16000);
  const [summarizationMaxChars, setSummarizationMaxChars] = useState<number>((agent as any)?.summarization_max_chars || 1500);
  // Segurança & Políticas
  const [additionalInstructions, setAdditionalInstructions] = useState<string>((agent as any)?.additional_instructions || '');
  const [strictMode, setStrictMode] = useState<boolean>((agent as any)?.strict_mode ?? true);
  // Mensagem de boas-vindas (armazenada em agents.settings.welcome_message)
  const [welcomeMessage, setWelcomeMessage] = useState<string>(
    String(((agent as any)?.settings?.welcome_message || ''))
  );
  const [blockedTermsText, setBlockedTermsText] = useState<string>(Array.isArray((agent as any)?.blocked_terms) ? ((agent as any)?.blocked_terms || []).join(', ') : '');
  // Confirmação para modelos preview/experimentais
  const [previewConfirmOpen, setPreviewConfirmOpen] = useState<boolean>(false);
  const [pendingModel, setPendingModel] = useState<string | null>(null);
  const [pendingReason, setPendingReason] = useState<'preview'|'realtime'|null>(null);

  // Vínculo com Template + modo de criação rápida
  const [templateInfo, setTemplateInfo] = useState<{ id: string; title: string | null; version: number } | null>(null);
  const [quickMode, setQuickMode] = useState<boolean>(false);
  const [quickCreating, setQuickCreating] = useState<boolean>(false);

  // Compartilhamento (agent_shares)
  type SharePermission = 'view'|'edit'|'admin';
  type ShareRow = { id: string; organization_id: string; agent_id: string; target_type: 'public'|'user'|'group'; target_user_id: string|null; target_group_id: string|null; permission: SharePermission; message: string|null; created_by: string; created_at: string };
  const [agentShares, setAgentShares] = useState<ShareRow[]>([]);
  const [shareTargetType, setShareTargetType] = useState<'public'|'user'|'group'>('public');
  const [shareEmail, setShareEmail] = useState<string>('');
  const [shareGroupId, setShareGroupId] = useState<string>('');
  const [sharePermission, setSharePermission] = useState<SharePermission>('view');
  const [shareMessage, setShareMessage] = useState<string>('');
  const [loadingShare, setLoadingShare] = useState<boolean>(false);
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [effectivePerm, setEffectivePerm] = useState<string>('loading');
  // Publicar como Template
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [tplTitle, setTplTitle] = useState<string>(name || "");
  const [tplDesc, setTplDesc] = useState<string>(description || "");
  const [tplCategory, setTplCategory] = useState<string>(category || "");
  const [tplTags, setTplTags] = useState<string>(tags || "");
  // Aba ativa controlada por query string (?tab=...)
  const [activeTab, setActiveTab] = useState<string>(() => {
    const qs = new URLSearchParams(location.search);
    return qs.get('tab') || 'config';
  });
  // Estado para controle de recarga manual de modelos
  const [loadingModels, setLoadingModels] = useState<boolean>(false);
  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const t = qs.get('tab') || 'config';
    setActiveTab(t);
  }, [location.search]);

  // Força modo custom se provider de assistente não for OpenAI
  useEffect(() => {
    if (agentType === 'assistant' && assistantProvider !== 'openai') {
      setAgentType('custom');
      toast({ title: 'Assistente não suportado', description: 'Assistente Existente está disponível apenas para OpenAI. Mudamos para Agente Personalizado.', variant: 'destructive' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistantProvider]);

  // Sincroniza agentType quando o agente chegar do contexto/BD
  useEffect(() => {
    if (agent?.mode === 'assistant') setAgentType('assistant');
  }, [agent?.mode]);

  // Inicializa o toggle com base no localStorage e sincroniza quando o assistentId muda
  useEffect(() => {
    try {
      const saved = localStorage.getItem('openai_assistant_id') || '';
      setSaveLocalAssistant(!!saved && (saved === (assistantId || '')));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent?.id]);

  // Sempre que o assistantId mudar e o toggle estiver ativo, atualiza o localStorage
  useEffect(() => {
    try {
      if (saveLocalAssistant && assistantId) localStorage.setItem('openai_assistant_id', assistantId);
      if (saveLocalAssistant && !assistantId) localStorage.removeItem('openai_assistant_id');
    } catch {}
  }, [assistantId, saveLocalAssistant]);

  // Ajusta modelo padrão ao trocar provider de geração
  useEffect(() => {
    if (generationProvider === 'openai') {
      if (!model || !/^(gpt|o\d)/i.test(model)) setModel('gpt-4o');
    } else if (generationProvider === 'anthropic') {
      if (!model || !/^claude/i.test(model)) setModel('claude-3-sonnet-20240229');
    } else if (generationProvider === 'google') {
      if (!model || !/^gemini/i.test(model)) setModel('gemini-2.5-flash');
    } else if (generationProvider === 'perplexity') {
      if (!model || !/sonar/i.test(model)) setModel('sonar');
    } else if (generationProvider === 'ollama') {
      if (!model || !/[:]/.test(model)) setModel('llama3.1:8b');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generationProvider]);

  // Fallback: ao editar e o agente ainda não está no contexto, busca direto no Supabase por id/slug
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        if (isNewAgent) return;
        if (agent || !routeAgentId) return;
        setFindingAgent(true);
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(routeAgentId);
        const query = supabase
          .from('agents')
          .select('*')
          .limit(1);
        const { data, error } = isUUID
          ? await query.eq('id', routeAgentId).single()
          : await query.eq('slug', routeAgentId).single();
        if (!ignore && !error && data) {
          // atualiza a lista global para não quebrar outras referências
          try {
            const found = data as any;
            const mapped = {
              id: found.id,
              name: found.name,
              slug: found.slug,
              description: found.description,
              category: found.category,
              model: found.model,
              systemPrompt: found.system_prompt,
              status: found.status,
              createdBy: found.created_by,
              createdAt: found.created_at,
              updatedAt: found.updated_at,
              version: found.version,
              usageCount: found.usage_count,
              tags: Array.isArray(found.tags) ? found.tags : [],
              mode: (found.mode || 'custom'),
              assistant_provider: found.assistant_provider || undefined,
              assistant_id: found.assistant_id || undefined,
              generation_provider: found.generation_provider || undefined,
              retention_limit: found.retention_limit || 200,
              retention_days: found.retention_days || 0,
              allow_file_uploads: !!found.allow_file_uploads,
              file_storage_mode: found.file_storage_mode || 'openai_vector_store',
              vector_store_id: found.vector_store_id || null,
              embedding_provider: found.embedding_provider || undefined,
              embedding_model: found.embedding_model || undefined,
            } as any;
            {
              const exists = agents.find((a) => a.id === mapped.id);
              const next = exists ? agents.map((a) => (a.id === mapped.id ? mapped : a)) : [...agents, mapped];
              setAgents(next as any);
            }
          } catch {}
        }
      } finally {
        if (!ignore) setFindingAgent(false);
      }
    })();
    return () => { ignore = true; };
  }, [isNewAgent, routeAgentId, agent?.id]);

  // Sincroniza generationProvider e model quando o agente é carregado
  useEffect(() => {
    console.log('🔄 useEffect de sincronização:', { agent, isNewAgent, generationProvider: agent?.generation_provider, model: agent?.model });
    if (agent && !isNewAgent) {
      if (agent.generation_provider) {
        console.log('📡 Sincronizando generationProvider:', agent.generation_provider);
        debugSetGenerationProvider(agent.generation_provider as any);
      }
      if (agent.model) {
        console.log('📡 Sincronizando model:', agent.model);
        setModel(agent.model);
      }
    }
  }, [agent, isNewAgent]);

  // Prefill de campos ao criar novo agente a partir de solicitações
  useEffect(() => {
    if (!isNewAgent) return;
    const params = new URLSearchParams(location.search);
    const qName = params.get('name');
    const qDesc = params.get('description');
    const qCat = params.get('category');
    const qPublic = params.get('public');
    if (qName && !name) setName(qName);
    if (qDesc && !description) setDescription(qDesc);
    if (qCat && !category) setCategory(qCat);
    if (qPublic === '1') setRequestedPublic(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNewAgent, location.search]);

  // Prefill via Marketplace: carrega config de agent_templates quando for criação com ?template=ID
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        if (!isNewAgent) return;
        const params = new URLSearchParams(location.search);
        const templateId = params.get('template');
        const quick = params.get('quick') === '1';
        if (quick) setQuickMode(true);
        if (!templateId) return;

        const { data, error } = await supabase
          .from('agent_templates')
          .select('*')
          .eq('id', templateId)
          .single();
        if (error || !data) return;

        const cfg: any = (data as any).config || {};

        // Nome/descrição/categoria podem vir via query; se não vierem, use do template
        if (!name && (data as any).title) setName((data as any).title);
        if (!description && (data as any).description) setDescription((data as any).description);
        if (!category && (data as any).category) setCategory((data as any).category);

        // Tipo do agente
        const incomingMode = (cfg.mode as string) || 'custom';
        if (incomingMode === 'assistant') {
          setAgentType('assistant');
          if (cfg.assistant_provider) setAssistantProvider(cfg.assistant_provider);
          if (cfg.assistant_id) setAssistantId(cfg.assistant_id);
        } else {
          setAgentType('custom');
        }

        // Modelo e prompt do sistema
        if (cfg.model) setModel(cfg.model);
        if (cfg.system_prompt) setSystemPrompt(cfg.system_prompt);

        // Tags: aceita array ou CSV; atualiza campo de texto
        const incomingTags = Array.isArray(cfg.tags) ? cfg.tags : (typeof cfg.tags === 'string' ? cfg.tags.split(',').map((t: string) => t.trim()) : []);
        if (incomingTags.length > 0) setTags(incomingTags.join(', '));

        // Flags e armazenamento de arquivos
        if (typeof cfg.allow_file_uploads === 'boolean') setAllowUploads(cfg.allow_file_uploads);
        if (cfg.file_storage_mode) setFileStorageMode(cfg.file_storage_mode);

        // Retenção
        if (typeof cfg.retention_limit === 'number') setRetentionLimit(cfg.retention_limit);
        if (typeof cfg.retention_days === 'number') setRetentionDays(cfg.retention_days);

        // Providers e embeddings
        if (cfg.generation_provider) setGenerationProvider(cfg.generation_provider);
        if (cfg.embedding_provider) setEmbeddingProvider(cfg.embedding_provider);
        if (cfg.embedding_model) setEmbeddingModel(cfg.embedding_model);

        // Guardar informações do template para persistência no agente
        const tplVersion = typeof (data as any).version === 'number' ? (data as any).version : 1;
        setTemplateInfo({ id: (data as any).id as string, title: (data as any).title || null, version: tplVersion });

        if (!ignore) {
          toast({ title: 'Template carregado', description: `Carregado de "${(data as any).title || 'Template'}".` });
        }

        // Criação rápida automática quando quick=1
        if (quick && !ignore && !quickCreating) {
          setQuickCreating(true);
          // aguarda pequeno tempo para estados aplicarem antes de salvar
          setTimeout(() => {
            try { (document.activeElement as HTMLElement | null)?.blur?.(); } catch {}
            handleSave();
          }, 50);
        }
      } catch {}
    })();
    return () => { ignore = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNewAgent, location.search]);

  // Carrega compartilhamentos e grupos (para seleção) + permissão efetiva
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        if (!organization?.id || !agent?.id) return;
        // shares do agente
        const { data: shares, error } = await supabase
          .from('agent_shares')
          .select('*')
          .eq('organization_id', organization.id)
          .eq('agent_id', agent.id)
          .order('created_at', { ascending: false } as any);
        if (!ignore && !error) setAgentShares((shares || []) as ShareRow[]);
        // grupos
        const { data: grps } = await supabase
          .from('user_groups')
          .select('id, name')
          .eq('organization_id', organization.id)
          .order('name', { ascending: true } as any);
        if (!ignore && grps) setGroups(grps as any);
        // permissão efetiva
        try {
          // system owner tem admin direto (evita RPC se quiser)
          const { data: sysOwner } = await supabase.rpc('is_system_owner');
          if (sysOwner === true) { if (!ignore) setEffectivePerm('admin'); return; }
        } catch {}
        const { data: eff } = await supabase.rpc('agent_effective_permission', { p_org: organization.id, p_agent: agent.id });
        const effVal = (Array.isArray(eff) ? (eff as any)[0]?.agent_effective_permission : eff) as string | null;
        if (!ignore) setEffectivePerm((effVal || 'view'));
      } catch {}
    })();
    return () => { ignore = true; };
  }, [organization?.id, agent?.id]);

  // Carrega ações externas disponíveis na organização e vínculos existentes do agente
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        if (!organization?.id) return;
        setLoadingActions(true);
        const { data: acts, error } = await supabase
          .from('external_actions')
          .select('id, name, url, method, enabled')
          .eq('organization_id', organization.id)
          .order('created_at', { ascending: false } as any);
        if (!ignore && !error && Array.isArray(acts)) {
          setExternalActions(acts as any);
        }
        // Se estamos editando, carrega vínculos existentes para pré-selecionar
        if (agent?.id) {
          const { data: links } = await supabase
            .from('agent_actions')
            .select('external_action_id')
            .eq('agent_id', agent.id);
          if (!ignore && Array.isArray(links)) {
            setSelectedActionIds(new Set(links.map((r: any) => r.external_action_id)));
          }
        }
      } finally {
        if (!ignore) setLoadingActions(false);
      }
    })();
    return () => { ignore = true; };
  }, [organization?.id, agent?.id]);

  const handleCreateShare = async () => {
    try {
      if (!organization?.id || !agent?.id || !currentUser?.id) return;
      setLoadingShare(true);
      if (shareTargetType === 'public') {
        const { error } = await supabase.from('agent_shares').insert({
          organization_id: organization.id,
          agent_id: agent.id,
          target_type: 'public',
          permission: sharePermission,
          message: shareMessage || null,
          created_by: currentUser.id,
        } as any);
        if (error) throw error;
      } else if (shareTargetType === 'user') {
        if (!shareEmail) { toast({ title: 'Informe o e-mail', description: 'Digite o e-mail do usuário.', variant: 'destructive' }); return; }
        const { data: userRow } = await supabase.from('profiles').select('id,email').eq('email', shareEmail).limit(1).single();
        if (!userRow?.id) { toast({ title: 'Usuário não encontrado', description: 'O e-mail informado não pertence a um usuário desta organização.', variant: 'destructive' }); return; }
        const { error } = await supabase.from('agent_shares').insert({
          organization_id: organization.id,
          agent_id: agent.id,
          target_type: 'user',
          target_user_id: userRow.id,
          permission: sharePermission,
          message: shareMessage || null,
          created_by: currentUser.id,
        } as any);
        if (error) throw error;
      } else if (shareTargetType === 'group') {
        if (!shareGroupId) { toast({ title: 'Selecione um grupo', description: 'Escolha um grupo para compartilhar.', variant: 'destructive' }); return; }
        const { error } = await supabase.from('agent_shares').insert({
          organization_id: organization.id,
          agent_id: agent.id,
          target_type: 'group',
          target_group_id: shareGroupId,
          permission: sharePermission,
          message: shareMessage || null,
          created_by: currentUser.id,
        } as any);
        if (error) throw error;
      }
      // reset
      setShareMessage('');
      setShareEmail('');
      setShareGroupId('');
      // reload
      const { data: shares } = await supabase
        .from('agent_shares')
        .select('*')
        .eq('organization_id', organization!.id)
        .eq('agent_id', agent!.id)
        .order('created_at', { ascending: false } as any);
      setAgentShares((shares || []) as ShareRow[]);
      toast({ title: 'Compartilhamento criado', description: 'As permissões foram atualizadas.' });
    } catch (e: any) {
      toast({ title: 'Falha ao compartilhar', description: e?.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      setLoadingShare(false);
    }
  };

  // Auto-atualiza a lista enquanto houver arquivos em processamento
  useEffect(() => {
    if (!allowUploads) return;
    if (fileStorageMode !== 'openai_vector_store') return;
    if (!vectorStoreId) return;
    const hasProcessing = vsFiles.some((f: any) => ['processing', 'in_progress'].includes((f?.status || '').toString())) || vsUploading;
    if (!hasProcessing) return;
    const timer = setInterval(() => { refreshVectorStoreFiles().catch(() => {}); }, 5000);
    return () => clearInterval(timer);
  }, [allowUploads, fileStorageMode, vectorStoreId, vsFiles, vsUploading]);

  // Carrega a lista automaticamente quando houver um Vector Store definido
  useEffect(() => {
    if (!allowUploads) return;
    if (fileStorageMode !== 'openai_vector_store') return;
    if (!vectorStoreId) return;
    refreshVectorStoreFiles().catch(() => {});
  }, [allowUploads, fileStorageMode, vectorStoreId]);

  // =============================
  // Vector Store (OpenAI) helpers
  // =============================
  const ensureAndPersistVectorStore = async (): Promise<string> => {
    try {
      if (!agent?.id) throw new Error('Agente não encontrado');
      const vsId = await ensureVectorStoreForAgent(organization?.id || null, agent.id, vectorStoreId || undefined);
      if (!vsId) throw new Error('Falha ao criar/conectar Vector Store');
      if (vsId !== vectorStoreId) {
        setVectorStoreId(vsId);
        // Persistir no agente
        try {
          await supabase.from('agents').update({ vector_store_id: vsId } as any).eq('id', agent.id);
          (setAgents as any)((prev: Agent[]) => prev.map(a => a.id === agent.id ? ({ ...a, vector_store_id: vsId } as any) : a));
        } catch {}
      }
      toast({ title: 'Vector Store pronto', description: vsId });
      return vsId;
    } catch (e: any) {
      toast({ title: 'Falha no Vector Store', description: e?.message || 'Tente novamente', variant: 'destructive' });
      throw e;
    }
  };

  const refreshVectorStoreFiles = async () => {
    try {
      if (!vectorStoreId) { setVsFiles([]); return; }
      setVsLoading(true);
      const apiKey = await getLLMKey(organization?.id || null, 'openai');
      if (!apiKey) throw new Error('OpenAI API Key não configurada.');
      const res = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`, {
        headers: { Authorization: `Bearer ${apiKey}`, 'OpenAI-Beta': 'assistants=v2' },
      });
      if (!res.ok) throw new Error(`Falha ao listar arquivos (${res.status})`);
      const js = await res.json();
      const items = (js?.data || []).map((f: any) => ({
        id: f.id as string,
        filename: f.filename as string,
        created_at: f.created_at as string,
        status: (f.status as string) || (f.state as string) || 'unknown',
        error: (f.last_error?.message as string) || (f.error?.message as string) || null,
      }));
      setVsFiles(items);
    } catch (e: any) {
      setVsFiles([]);
      toast({ title: 'Falha ao listar arquivos', description: e?.message || 'Erro ao consultar Vector Store', variant: 'destructive' });
    } finally {
      setVsLoading(false);
    }
  };

  const handleUploadVSFiles = async (files: FileList | File[]) => {
    try {
      if (import.meta.env.DEV) console.debug('[AgentConfigPage] handleUploadVSFiles start', { count: (files as any)?.length ?? 0, allowUploads, fileStorageMode, vectorStoreIdInitial: vectorStoreId });
      if (!allowUploads) throw new Error('Uploads desabilitados para este agente.');
      let vsId = vectorStoreId || (agent as any)?.vector_store_id || null;
      if (!vsId) {
        vsId = await ensureAndPersistVectorStore();
      }
      if (!vsId) throw new Error('Vector Store não está pronto.');
      setVsUploading(true);
      const arr = Array.from(files || []);
      if (arr.length === 0) {
        toast({ title: 'Nenhum arquivo selecionado', description: 'Escolha um ou mais arquivos para enviar.', variant: 'destructive' });
        return;
      }
      if (import.meta.env.DEV) console.debug('[AgentConfigPage] enviando arquivos via Edge Function', { vsId, names: arr.map(f => f.name) });
      // Monta FormData para a Edge Function
      const fd = new FormData();
      if (organization?.id) fd.append('organization_id', organization.id);
      if (agent?.id) fd.append('agent_id', agent.id);
      fd.append('vector_store_id', vsId);
      for (const f of arr) fd.append('files', f);
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vs-upload`;
      const session = await supabase.auth.getSession();
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
          ...(session.data.session?.access_token ? { 'Authorization': `Bearer ${session.data.session.access_token}` } : {}),
        },
        body: fd,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) {
        const det = j?.error || `${res.status} ${res.statusText}`;
        throw new Error(det);
      }
      // Atualiza VS id caso tenha sido criado na função
      if (j?.vector_store_id && j.vector_store_id !== vsId) {
        setVectorStoreId(j.vector_store_id);
        try { await supabase.from('agents').update({ vector_store_id: j.vector_store_id } as any).eq('id', agent!.id); } catch {}
      }
      const ok = (j?.uploaded || []).length || 0;
      const fail = (j?.failed || []).length || 0;
      if (ok > 0) {
        const plural = ok > 1 ? 'arquivos' : 'arquivo';
        toast({ title: 'Arquivos enviados', description: `${ok} ${plural} enviados. Indexação iniciada no Vector Store.` });
      }
      if (fail > 0) {
        const msg = (j.failed as any[]).slice(0, 3).map(r => `${r.name}: ${r.error}`).join('; ');
        toast({ title: 'Alguns arquivos falharam', description: msg || `${fail} falharam.`, variant: 'destructive' });
      }
      await refreshVectorStoreFiles();
    } catch (e: any) {
      toast({ title: 'Falha no upload', description: e?.message || 'Erro ao enviar arquivos', variant: 'destructive' });
    } finally {
      if (import.meta.env.DEV) console.debug('[AgentConfigPage] handleUploadVSFiles end');
      setVsUploading(false);
    }
  };

  const handleRemoveVSFile = async (fileId: string) => {
    try {
      if (!vectorStoreId) return;
      const apiKey = await getLLMKey(organization?.id || null, 'openai');
      if (!apiKey) throw new Error('OpenAI API Key não configurada.');
      const res = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/files/${fileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiKey}`, 'OpenAI-Beta': 'assistants=v2' },
      });
      if (!res.ok) throw new Error(`Falha ao remover arquivo (${res.status})`);
      setVsFiles(prev => prev.filter(f => f.id !== fileId));
    } catch (e: any) {
      toast({ title: 'Falha ao remover', description: e?.message || 'Erro ao remover arquivo', variant: 'destructive' });
    }
  };

  // Salvar Prompt do Sistema + Memória & Contexto
  const handleSaveMemoryConfig = async () => {
    try {
      if (!agent?.id) return;
      const payload: any = {
        system_prompt: systemPrompt,
        history_token_limit: Number(historyTokenLimit) || null,
        enable_summarization: !!enableSummarization,
        summarization_token_threshold: Number(summarizationTokenThreshold) || null,
        summarization_max_chars: Number(summarizationMaxChars) || null,
        additional_instructions: additionalInstructions || null,
        strict_mode: !!strictMode,
        blocked_terms: (blockedTermsText || '').split(',').map(t => t.trim()).filter(Boolean),
        // persiste settings.welcome_message preservando outras chaves
        settings: { ...((agent as any)?.settings || {}), welcome_message: welcomeMessage || null },
      };
      const { error } = await supabase.from('agents').update(payload).eq('id', agent.id);
      if (error) throw error;
      // Recarrega a linha real para garantir que o settings volte do banco
      const { data: fresh } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agent.id)
        .single();
      const freshSettings = (fresh as any)?.settings || payload.settings || {};
      // Atualiza contexto local usando a linha recarregada
      (setAgents as any)((prev: Agent[]) => prev.map(a => a.id === agent.id ? ({
        ...a,
        systemPrompt: systemPrompt,
        // campos extras (não tipados no Agent):
        history_token_limit: payload.history_token_limit,
        enable_summarization: payload.enable_summarization,
        summarization_token_threshold: payload.summarization_token_threshold,
        summarization_max_chars: payload.summarization_max_chars,
        additional_instructions: payload.additional_instructions,
        strict_mode: payload.strict_mode,
        blocked_terms: payload.blocked_terms,
        assistant_provider: payload.assistant_provider,
        assistant_id: payload.assistant_id ?? (a as any).assistant_id,
        settings: freshSettings,
      }) : a));
      // Sincroniza o campo local
      setWelcomeMessage(String(freshSettings?.welcome_message || ''));
      try {
        if (assistantId) localStorage.setItem('openai_assistant_id', assistantId);
        else localStorage.removeItem('openai_assistant_id');
      } catch {}
      toast({ title: 'Configurações salvas', description: 'Prompt do sistema e memória atualizados.' });
    } catch (e: any) {
      toast({ title: 'Falha ao salvar', description: e?.message || 'Tente novamente', variant: 'destructive' });
    }
  };

  const canPublishTemplate = (currentUser?.role === 'owner' || currentUser?.role === 'admin' || hasPermission(currentUser?.role || 'member', "Editar a configuração de um agente"));

  const handlePublishTemplate = async () => {
    try {
      if (!organization?.id || !currentUser?.id) {
        toast({ title: 'Não foi possível publicar', description: 'Organização ou usuário não encontrado.', variant: 'destructive' });
        return;
      }
      setPublishing(true);
      const tagArr = (tplTags || '').split(',').map(t => t.trim()).filter(Boolean);
      const payload: any = {
        title: tplTitle || name || 'Agente',
        description: tplDesc || description || null,
        category: tplCategory || category || null,
        tags: tagArr.length ? tagArr : null,
        visibility: 'org',
        organization_id: organization.id,
        author_id: currentUser.id,
        config: {
          mode: agentType,
          model,
          system_prompt: systemPrompt,
          category: tplCategory || category || null,
          tags: tagArr,
          assistant_provider: assistantProvider,
          assistant_id: assistantId,
          generation_provider: generationProvider,
          embedding_provider: embeddingProvider,
          embedding_model: embeddingModel,
          allow_file_uploads: allowUploads,
          retention_limit: retentionLimit,
          retention_days: retentionDays,
          file_storage_mode: fileStorageMode,
          name: name,
          description: description,
        }
      };
      const { error } = await supabase.from('agent_templates').insert(payload as any);
      if (error) throw error;
      setPublishOpen(false);
      toast({ title: 'Template publicado!', description: 'Seu agente foi publicado no Marketplace (aba Empresa).' });
    } catch (e: any) {
      toast({ title: 'Falha ao publicar', description: e?.message || 'Erro ao salvar template', variant: 'destructive' });
    } finally {
      setPublishing(false);
    }
  };

  // Heurística simples para identificar modelos preview/experimentais e realtime
  const isCatalogPreview = (prov?: string | null, id?: string | null) => {
    try {
      const info = getCatalogGenModelInfo(modelCatalog, prov || '', id || '') as any;
      return !!info?.preview;
    } catch { return false; }
  };
  const isPreviewModel = (prov?: string | null, id?: string | null) => {
    const m = (id || '').toLowerCase();
    return /preview|exp/.test(m) || isCatalogPreview(prov, id);
  };
  const isRealtimeModel = (prov?: string | null, id?: string | null) => {
    const m = (id || '').toLowerCase();
    return m.includes('realtime') || m.includes('live');
  };

  const updateSharePerm = async (shareId: string, perm: SharePermission) => {
    try {
      const { error } = await supabase.from('agent_shares').update({ permission: perm } as any).eq('id', shareId);
      if (error) throw error;
      setAgentShares(prev => prev.map(s => s.id === shareId ? { ...s, permission: perm } : s));
      toast({ title: 'Permissão atualizada' });
    } catch (e: any) {
      toast({ title: 'Falha ao atualizar', description: e?.message || 'Tente novamente', variant: 'destructive' });
    }
  };

  const revokeShare = async (shareId: string) => {
    try {
      const { error } = await supabase.from('agent_shares').delete().eq('id', shareId);
      if (error) throw error;
      setAgentShares(prev => prev.filter(s => s.id !== shareId));
      toast({ title: 'Compartilhamento revogado' });
    } catch (e: any) {
      toast({ title: 'Falha ao revogar', description: e?.message || 'Tente novamente', variant: 'destructive' });
    }
  };

  // Atalho: tornar público / remover público
  const [loadingPublicShare, setLoadingPublicShare] = useState(false);
  const hasPublicShare = agentShares.some(s => s.target_type === 'public');
  const setPublicShare = async (makePublic: boolean) => {
    try {
      if (!organization?.id || !agent?.id || !currentUser?.id) return;
      setLoadingPublicShare(true);
      if (makePublic) {
        const { error } = await supabase.from('agent_shares').insert({
          organization_id: organization.id,
          agent_id: agent.id,
          target_type: 'public',
          permission: 'view',
          message: null,
          created_by: currentUser.id,
        } as any);
        if (error) throw error;
        const { data: shares } = await supabase
          .from('agent_shares')
          .select('*')
          .eq('organization_id', organization.id)
          .eq('agent_id', agent.id)
          .order('created_at', { ascending: false } as any);
        setAgentShares((shares || []) as ShareRow[]);
        toast({ title: 'Agente tornado público', description: 'Agora todos na organização podem visualizar este agente.' });
      } else {
        const { error } = await supabase
          .from('agent_shares')
          .delete()
          .eq('organization_id', organization.id)
          .eq('agent_id', agent.id)
          .eq('target_type', 'public');
        if (error) throw error;
        setAgentShares(prev => prev.filter(s => s.target_type !== 'public'));
        toast({ title: 'Compartilhamento público removido' });
      }
    } catch (e: any) {
      toast({ title: 'Falha ao atualizar compartilhamento público', description: e?.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      setLoadingPublicShare(false);
    }
  };

  // Get available models from organization's LLM providers (dinâmico via util)
  useEffect(() => {
    let ignore = false;
    (async () => {
      if (ignore) return;
      setLoadingModels(true);
      try {
        // Checa chaves de todos os provedores antes de carregar modelos
        const hasOpenAIKey = !!(await getLLMKey(organization?.id || null, 'openai'));
        const hasPerplexityKey = !!(await getLLMKey(organization?.id || null, 'perplexity'));
        const hasAnthropicKey = !!(await getLLMKey(organization?.id || null, 'anthropic'));
        const hasGoogleKey = !!(await getLLMKey(organization?.id || null, 'google'));
        
        if (!hasOpenAIKey && !hasPerplexityKey && !hasAnthropicKey && !hasGoogleKey) {
          if (import.meta.env.DEV) console.debug('[AgentConfigPage] Nenhuma chave de LLM encontrada para esta organização; pulando listagem de modelos.');
        }
        
        const providers = await getAvailableModels(organization?.id || null);
        if (ignore) return;
        const mapped: { value: string; label: string; description?: string; provider: string }[] = [];
        for (const p of providers) {
          for (const mid of p.models) {
            mapped.push({ value: mid, label: `${mid} (${p.provider})`, provider: p.provider });
          }
        }
        setAvailableModels(mapped);
        // Se ainda não houver model selecionado e houver catálogo, defina o primeiro
        if (!model && mapped.length > 0) setModel(mapped[0].value);
      } catch (e) {
        // fallback permanece abaixo
        console.error('[AgentConfigPage] Erro ao carregar modelos:', e);
      } finally {
        setLoadingModels(false);
      }
    })();
    return () => { ignore = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);
  
  // Função para recarregar modelos manualmente
  const reloadModels = async () => {
    try {
      setLoadingModels(true);
      const providers = await getAvailableModels(organization?.id || null);
      const mapped: { value: string; label: string; description?: string; provider: string }[] = [];
      for (const p of providers) {
        for (const mid of p.models) {
          mapped.push({ value: mid, label: `${mid} (${p.provider})`, provider: p.provider });
        }
      }
      setAvailableModels(mapped);
      toast({ title: 'Modelos recarregados', description: 'Lista de modelos atualizada.' });
    } catch (e: any) {
      toast({ title: 'Falha ao recarregar', description: e?.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      setLoadingModels(false);
    }
  };

  // Ao abrir a edição, se já houver um assistant_id, pré-seleciona e lista automaticamente
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        if (!agent) return;
        if (agent.mode === 'assistant' && agent.assistant_provider === 'openai' && agent.assistant_id) {
          setAssistantProvider('openai');
          setAgentType('assistant');
          setAssistantId(agent.assistant_id);
          setSelectedAssistant(agent.assistant_id);
          // lista automaticamente para preencher o dropdown
          // Evita 401 se não houver chave
          const hasOpenAIKey = !!(await getLLMKey(organization?.id || null, 'openai'));
          if (!hasOpenAIKey) {
            if (import.meta.env.DEV) console.debug('[AgentConfigPage] OpenAI key ausente; não listando Assistants.');
            return;
          }
          setLoadingAssistants(true);
          const items = await listOpenAIAssistants(organization?.id || null);
          if (!ignore) {
            setFetchedAssistants(items);
          }
        }
      } catch {}
      finally {
        setLoadingAssistants(false);
      }
    })();
    return () => { ignore = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent?.id]);

  // Carrega catálogo público de modelos para descrições dinâmicas (deve vir antes de qualquer return)
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const cat = await fetchModelCatalog();
        if (!ignore) setModelCatalog(cat);
      } catch {}
    })();
    return () => { ignore = true; };
  }, []);

  // Carrega permissão efetiva de compartilhamento para edição (apenas ao editar)
  useEffect(() => {
    const loadSharePerm = async () => {
      try {
        if (isNewAgent) { setSharePerm('admin'); return; }
        if (!organization?.id || !agent?.id) return;
        // Papel owner/admin tem passe livre
        if (currentUser?.role === 'owner' || currentUser?.role === 'admin') { setSharePerm('admin'); return; }
        // Bypass para owners globais (modo suporte)
        try {
          const { data: sysOwner } = await supabase.rpc('is_system_owner');
          if (sysOwner === true) { setSharePerm('admin'); return; }
        } catch {}
        const { data, error } = await supabase.rpc('agent_effective_permission', { p_org: organization.id, p_agent: agent.id });
        if (error) throw error;
        const val = (Array.isArray(data) ? (data[0] as any)?.agent_effective_permission : (data as any)) as string;
        const perm = (val || 'none') as 'none'|'view'|'edit'|'admin';
        setSharePerm(perm);
      } catch { setSharePerm('none'); }
    };

    loadSharePerm();
  }, [isNewAgent, organization?.id, agent?.id, currentUser?.role]);

  const testCurrentAgent = async () => {
    try {
      if (!organization?.id) throw new Error('Organização não encontrada.');
      const provider = generationProvider;
      const m = model;
      if (!provider || !m) throw new Error('Defina provider e modelo de geração.');
      // Primeiro: invoca via SDK (envia JWT/anon automaticamente)
      const { data: body, error } = await supabase.functions.invoke('test-llm', {
        body: { provider, organization_id: organization.id, model: m }
      });
      if (error || (body as any)?.error) {
        // Fallback: chamada direta com apikey e Authorization
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-llm`;
        const session = await supabase.auth.getSession();
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
            ...(session.data.session?.access_token ? { 'Authorization': `Bearer ${session.data.session.access_token}` } : {})
          },
          body: JSON.stringify({ provider, organization_id: organization.id, model: m })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.ok === false) {
          const reason = (data?.error || (error as any)?.message || '401').toString();
          throw new Error(reason);
        }
      }
      toast({ title: 'Teste OK', description: `Provider ${provider} com modelo ${m} respondeu.` });
    } catch (e: any) {
      toast({ title: 'Falha no teste do agente', description: e?.message || 'Erro ao validar provider/modelo', variant: 'destructive' });
    }
  };

  // Informações para embeddings (provider/modelo)
  const getEmbeddingInfo = (provider?: 'openai'|'ollama', modelId?: string | null): {
    provider?: { title: string; description: string };
    model?: { title: string; description: string; bestFor?: string };
  } => {
    const out: any = {};
    if (provider === 'openai') {
      out.provider = { title: 'OpenAI Embeddings', description: 'Serviço gerenciado de embeddings; alta qualidade e estabilidade.' };
      const m = (modelId || '').toLowerCase();
      if (m.includes('text-embedding-3-small')) out.model = {
        title: 'text-embedding-3-small (OpenAI)',
        description: 'Baixo custo e bom desempenho geral (dimensão menor).',
        bestFor: 'RAG com volume alto e custo controlado'
      };
      if (m.includes('text-embedding-3-large')) out.model = {
        title: 'text-embedding-3-large (OpenAI)',
        description: 'Maior qualidade/precisão semântica (dimensão maior).',
        bestFor: 'busca com relevância crítica e documentos complexos'
      };
    } else if (provider === 'ollama') {
      out.provider = { title: 'Ollama (Local Embeddings)', description: 'Geração local de embeddings; custo zero por requisição, exige infraestrutura.' };
      const m = (modelId || '').toLowerCase();
      if (m.includes('nomic-embed-text')) out.model = {
        title: 'nomic-embed-text (Local)',
        description: 'Modelo open-source amplamente usado para embeddings de texto.',
        bestFor: 'ambientes on-premise/air-gapped, controle de dados'
      };
    }
    return out;
  };

  const ModelTips = () => {
    if (generationProvider === 'google') {
      return (
        <div className="text-xs leading-relaxed max-w-xs">
          <p className="font-medium">Sugestões (Google · Gemini 2.5)</p>
          <ul className="list-disc ml-4">
            <li><code>gemini-2.5-flash</code> (rápido/econômico)</li>
            <li><code>gemini-2.5-pro</code> (melhor qualidade/raciocínio)</li>
            <li><code>gemini-2.5-flash-lite</code> (alto volume, custo mínimo)</li>
            <li><code>gemini-live-2.5-flash-preview</code> (tempo real/voz — preview)</li>
            <li><code>gemini-2.5-flash-preview-native-audio-dialog</code> (áudio nativo — preview)</li>
            <li><code>gemini-2.5-flash-exp-native-audio-thinking-dialog</code> (experimental — preview)</li>
          </ul>
          <p className="mt-2">
            <a href="https://ai.google.dev/gemini-api/docs/models?hl=pt-br" target="_blank" rel="noreferrer" className="underline">Catálogo de modelos Gemini</a>
          </p>
        </div>
      );
    }
    if (generationProvider === 'openai') {
      return (
        <div className="text-xs leading-relaxed max-w-xs">
          <p className="font-medium">Sugestões (OpenAI)</p>
          <ul className="list-disc ml-4">
            <li><code>gpt-4o</code></li>
            <li><code>gpt-4o-mini</code></li>
          </ul>
          <p className="mt-2">
            <a href="https://platform.openai.com/docs/models" target="_blank" rel="noreferrer" className="underline">Modelos OpenAI</a>
          </p>
        </div>
      );
    }
    if (generationProvider === 'anthropic') {
      return (
        <div className="text-xs leading-relaxed max-w-xs">
          <p className="font-medium">Sugestões (Anthropic)</p>
          <ul className="list-disc ml-4">
            <li><code>claude-3-sonnet-20240229</code></li>
            <li><code>claude-3-5-sonnet-20241022</code></li>
          </ul>
          <p className="mt-2">
            <a href="https://docs.anthropic.com/claude/docs/models-overview" target="_blank" rel="noreferrer" className="underline">Modelos Claude</a>
          </p>
        </div>
      );
    }
    if (generationProvider === 'perplexity') {
      return (
        <div className="text-xs leading-relaxed max-w-xs">
          <p className="font-medium">Sugestões (Perplexity)</p>
          <ul className="list-disc ml-4">
            <li><code>sonar</code> (rápido, busca online)</li>
            <li><code>sonar-pro</code> (melhor qualidade, busca online)</li>
            <li><code>sonar-reasoning</code> (raciocínio passo a passo)</li>
            <li><code>sonar-reasoning-pro</code> (raciocínio avançado)</li>
            <li><code>sonar-deep-research</code> (pesquisa profunda/multietapas)</li>
          </ul>
          <p className="mt-2">
            <a href="https://docs.perplexity.ai/guides/choosing-a-model" target="_blank" rel="noreferrer" className="underline">Modelos Perplexity</a>
          </p>
        </div>
      );
    }
    if (generationProvider === 'ollama') {
      return (
        <div className="text-xs leading-relaxed max-w-xs">
          <p className="font-medium">Sugestões (Ollama)</p>
          <ul className="list-disc ml-4">
            <li><code>llama3.1:8b</code></li>
            <li><code>qwen2.5:7b</code></li>
          </ul>
          <p className="mt-2">
            <a href="https://ollama.com/library" target="_blank" rel="noreferrer" className="underline">Biblioteca de modelos Ollama</a>
          </p>
        </div>
      );
    }
    return null;
  };

  if (!currentUser) return null;

  const canEdit = isNewAgent 
    ? hasPermission(currentUser.role, "Criar um novo agente")
    : hasPermission(currentUser.role, "Editar a configuração de um agente");

  // Enforcement adicional por compartilhamento ao editar
  const shareAllowsEdit = isNewAgent || (sharePerm === 'edit' || sharePerm === 'admin' || currentUser.role === 'owner' || currentUser.role === 'admin');

  if (!canEdit) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Bot className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Acesso Negado</h3>
          <p className="text-muted-foreground">
            Você não tem permissão para {isNewAgent ? "criar" : "editar"} agentes.
          </p>
        </div>
      </div>
    );
  }

  if (!isNewAgent) {
    if (sharePerm === 'loading') {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center text-sm text-muted-foreground">Carregando permissões…</div>
        </div>
      );
    }
    if (!shareAllowsEdit) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Acesso Negado</h3>
            <p className="text-muted-foreground">Você tem acesso ao agente, mas não possui permissão para editá-lo.</p>
          </div>
        </div>
      );
    }
  }

  if (!isNewAgent && !agent) {
    if (findingAgent) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center text-sm text-muted-foreground">Carregando agente…</div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Bot className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Agente não encontrado</h3>
          <p className="text-muted-foreground">O agente solicitado não existe.</p>
        </div>
      </div>
    );
  }

  const slugify = (s: string) =>
    (s || '')
      .normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64);

  // Gera um slug único por organização incrementando sufixos -2, -3, ... se necessário
  const ensureUniqueSlug = async (base: string, orgId: string): Promise<string> => {
    let candidate = base;
    let counter = 1;
    while (true) {
      const { data, error } = await supabase
        .from('agents')
        .select('id')
        .eq('organization_id', orgId)
        .eq('slug', candidate)
        .limit(1)
        .maybeSingle();
      if (!data && !error) return candidate;
      counter += 1;
      candidate = `${base}-${counter}`.slice(0, 64);
      if (counter > 100) return `${base}-${Date.now()}`.slice(0, 64);
    }
  };

  const handleSave = async () => {
    // Validações por tipo
    if (!name || !description || !category) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha Nome, Descrição e Categoria",
        variant: "destructive"
      });
      return;
    }
    if (agentType === 'custom') {
      if (!model || !systemPrompt) {
        toast({ title: 'Campos obrigatórios', description: 'Selecione um modelo e defina o Prompt do Sistema', variant: 'destructive' });
        return;
      }
    } else {
      if (!assistantProvider || !assistantId) {
        toast({ title: 'Campos obrigatórios', description: 'Informe o provedor e o ID do Assistente', variant: 'destructive' });
        return;
      }
      if (assistantProvider !== 'openai') {
        toast({ title: 'Assistente não suportado', description: 'O modo Assistente Existente é suportado apenas para OpenAI. Use Agente Personalizado para outros provedores.', variant: 'destructive' });
        return;
      }
    }

    // Validações de RAG Local
    if (allowUploads && fileStorageMode === 'local_rag') {
      if (!embeddingProvider) {
        toast({ title: 'Embeddings obrigatórios', description: 'Selecione o provider de embeddings para RAG Local.', variant: 'destructive' });
        return;
      }
      if (!embeddingModel) {
        toast({ title: 'Modelo de embeddings obrigatório', description: 'Informe o modelo de embeddings (ex.: text-embedding-3-small ou nomic-embed-text).', variant: 'destructive' });
        return;
      }
    }

    const computedSlug = slugify(name);

    const agentData: Agent = {
      id: agent?.id || String(Date.now()),
      name,
      slug: agent?.slug || computedSlug,
      description,
      category,
      model: model,
      systemPrompt,
      status: agent?.status || 'active',
      createdBy: currentUser.id,
      createdAt: agent?.createdAt || new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      version: (agent?.version || 0) + 1,
      usageCount: agent?.usageCount || 0,
      tags: tags.split(",").map(tag => tag.trim()).filter(Boolean),
      mode: agentType,
      assistant_provider: agentType === 'assistant' ? assistantProvider : (fileStorageMode === 'openai_vector_store' ? 'openai' : undefined),
      assistant_id: (agentType === 'assistant' || fileStorageMode === 'openai_vector_store') ? (assistantId || null) : undefined,
      retention_limit: retentionLimit,
      retention_days: retentionDays,
      allow_file_uploads: allowUploads,
      file_storage_mode: fileStorageMode,
    };
    // Persistir no Supabase
    try {
      if (!organization?.id) {
        toast({ title: 'Organização não encontrada', description: 'Associe-se a uma organização para salvar agentes.', variant: 'destructive' });
        return;
      }
      // Garante slug único por organização na criação (inclusive via template)
      const uniqueSlug = isNewAgent ? await ensureUniqueSlug(computedSlug, organization.id) : (agent?.slug || computedSlug);

      const payload: any = {
        id: isNewAgent ? undefined : agent?.id,
        organization_id: organization.id,
        name: agentData.name,
        slug: uniqueSlug,
        description: agentData.description,
        category: agentData.category,
        model: agentData.model,
        system_prompt: agentData.systemPrompt,
        status: agentData.status,
        created_by: agentData.createdBy,
        tags: agentData.tags,
        mode: agentData.mode,
        assistant_provider: agentData.assistant_provider,
        assistant_id: agentData.assistant_id,
        retention_limit: agentData.retention_limit,
        retention_days: agentData.retention_days,
        allow_file_uploads: agentData.allow_file_uploads,
        file_storage_mode: agentData.file_storage_mode,
        vector_store_id: vectorStoreId || (agent as any)?.vector_store_id || null,
        generation_provider: generationProvider,
        embedding_provider: embeddingProvider,
        embedding_model: embeddingModel || null,
        // Vínculo com template (se existir)
        template_id: templateInfo?.id || null,
        template_version: templateInfo?.version || null,
        template_title: templateInfo?.title || null,
      };
      
      // Debug: log do payload antes de salvar
      console.log('💾 Payload antes de salvar:', {
        generation_provider: generationProvider,
        model: agentData.model,
        embedding_provider: embeddingProvider,
        embedding_model: embeddingModel
      });

      if (isNewAgent) {
        const { data, error } = await supabase
          .from('agents')
          .insert(payload)
          .select('*')
          .single();
        if (error) throw error;
        const created: Agent = {
          ...agentData,
          id: data.id,
          slug: data.slug || uniqueSlug,
          createdAt: data.created_at || agentData.createdAt,
          updatedAt: data.updated_at || agentData.updatedAt,
          // providers persistidos
          generation_provider: generationProvider as any,
          embedding_provider: embeddingProvider as any,
          ...(embeddingModel ? { embedding_model: embeddingModel as any } : {}),
          ...(ollamaUrl ? { ollama_url: ollamaUrl as any } : {}),
          // preservar vector_store_id
          ...(vectorStoreId || (data as any)?.vector_store_id ? { vector_store_id: (data as any)?.vector_store_id || vectorStoreId } : {}),
        } as any;
        setAgents([...agents, created]);
        // Persistir vínculos agent_actions (seleções)
        try {
          const toInsert = Array.from(selectedActionIds).map((extId) => ({ agent_id: (data as any).id, external_action_id: extId, enabled: true }));
          if (toInsert.length > 0) {
            const { error: linkErr } = await supabase.from('agent_actions').insert(toInsert);
            if (linkErr) throw linkErr;
          }
        } catch (e) {
          console.error('[agent_actions] insert failed', e);
        }
        // Compartilhamento público automático se solicitado
        try {
          if (requestedPublic && organization?.id) {
            await supabase.from('agent_shares').insert({
              organization_id: organization.id,
              agent_id: created.id,
              target_type: 'public',
              permission: 'view',
              created_by: currentUser.id,
              message: null,
            } as any);
          }
        } catch {}
        toast({ title: 'Agente criado!', description: 'O novo agente foi criado com sucesso' });
        // Modo rápido: pula confirmação de compartilhamento
        if (quickMode) {
          navigate('/dashboard');
        } else {
          // Se o agente veio de uma solicitação marcada como público e já foi compartilhado automaticamente,
          // não faz sentido perguntar novamente. Vai direto para o Dashboard.
          if (requestedPublic) {
            navigate('/dashboard');
          } else {
            // Pergunta se deseja compartilhar agora
            const goShare = window.confirm('Deseja compartilhar este agente agora?');
            if (goShare) {
              navigate(`/agents/edit/${created.slug || created.id}?tab=sharing`);
            } else {
              navigate('/dashboard');
            }
          }
        }
      } else {
        const { data, error } = await supabase
          .from('agents')
          .update(payload)
          .eq('id', agent?.id)
          .select('*')
          .single();
        if (error) throw error;
        const updated: Agent = {
          ...agentData,
          id: data.id,
          slug: data.slug || agentData.slug,
          updatedAt: data.updated_at || agentData.updatedAt,
          // providers persistidos
          generation_provider: generationProvider as any,
          embedding_provider: embeddingProvider as any,
          ...(embeddingModel ? { embedding_model: embeddingModel as any } : {}),
          ...(ollamaUrl ? { ollama_url: ollamaUrl as any } : {}),
          // preservar vector_store_id
          ...(vectorStoreId || (data as any)?.vector_store_id || (agent as any)?.vector_store_id ? { vector_store_id: (data as any)?.vector_store_id || vectorStoreId || (agent as any)?.vector_store_id } : {}),
        } as any;
        
        // Debug: log do agente atualizado
        console.log('✅ Agente atualizado:', {
          generation_provider: updated.generation_provider,
          embedding_provider: updated.embedding_provider,
          embedding_model: updated.embedding_model,
          ollama_url: updated.ollama_url
        });
        
        setAgents(agents.map(a => a.id === agent?.id ? updated : a));
        // Sincronizar vínculos agent_actions (diff simples)
        try {
          const { data: existing } = await supabase
            .from('agent_actions')
            .select('external_action_id')
            .eq('agent_id', agent!.id);
          const existingSet = new Set((existing || []).map((r: any) => r.external_action_id));
          const wantSet = new Set(selectedActionIds);
          const toInsert: string[] = [];
          const toDelete: string[] = [];
          // itens desejados que não existem
          for (const id of wantSet) if (!existingSet.has(id)) toInsert.push(id);
          // itens existentes que não são mais desejados
          for (const id of existingSet) if (!wantSet.has(id)) toDelete.push(id);
          if (toDelete.length > 0) {
            const { error: delErr } = await supabase
              .from('agent_actions')
              .delete()
              .eq('agent_id', agent!.id)
              .in('external_action_id', toDelete as any);
            if (delErr) throw delErr;
          }
          if (toInsert.length > 0) {
            const rows = toInsert.map((extId) => ({ agent_id: agent!.id, external_action_id: extId, enabled: true }));
            const { error: insErr } = await supabase.from('agent_actions').insert(rows);
            if (insErr) throw insErr;
          }
        } catch (e) {
          console.error('[agent_actions] sync failed', e);
        }
        toast({ title: 'Agente atualizado!', description: 'As configurações foram salvas com sucesso' });
        navigate(`/agents/chat/${updated.slug || updated.id}`);
      }
    } catch (e: any) {
      const msg = String(e?.message || 'Erro');
      
      // Debug: log completo do erro para diagnóstico
      console.error('❌ Erro completo ao salvar agente:', {
        error: e,
        message: e?.message,
        code: e?.code,
        details: e?.details,
        hint: e?.hint,
        stack: e?.stack
      });
      
      if (/Invalid Refresh Token/i.test(msg)) {
        try { await supabase.auth.signOut(); } catch {}
        toast({ title: 'Sessão expirada', description: 'Faça login novamente para continuar.', variant: 'destructive' });
      } else if (/duplicate key|conflict|409|slug/i.test(msg)) {
        toast({ title: 'Conflito de nome', description: 'Já existe um agente com esse nome/slug nesta organização. Ajuste o nome ou tente novamente.', variant: 'destructive' });
      } else {
        toast({ title: 'Erro ao salvar agente', description: msg || 'Verifique os dados e tente novamente', variant: 'destructive' });
      }
    }
  };

  const availableAssistants = [] as { value: string; label: string; description: string; provider: string }[];

  // Importar campos do Assistente da OpenAI
  const importFromAssistant = async (idToImport: string) => {
    try {
      if (!idToImport?.startsWith('asst_')) return;
      const a = await getOpenAIAssistant(organization?.id || null, idToImport);
      if (a) {
        // guarda estado anterior para permitir restauração
        if (!assistantInstructionsImported) {
          setPrevAssistantInstructions(systemPrompt);
          setPrevName(name);
          setPrevDescription(description);
        }
        if (!name) setName(a.name || name);
        if (!description) setDescription(a.description || description);
        if (a.instructions) setSystemPrompt(a.instructions);
        setAssistantInstructionsImported(true);
        toast({ title: 'Assistente importado', description: 'Instruções e metadados foram preenchidos.' });
      }
    } catch (e: any) {
      toast({ title: 'Falha ao importar do Assistente', description: e?.message || 'Verifique a API Key/ID', variant: 'destructive' });
    }
  };

  // Buscar Assistants reais da OpenAI
  const handleListOpenAIAssistants = async () => {
    setLoadingAssistants(true);
    try {
      const items = await listOpenAIAssistants(organization?.id || null);
      setFetchedAssistants(items);
      toast({ title: 'Assistants carregados', description: `Encontrados ${items.length}` });
    } catch (e: any) {
      toast({ title: 'Falha ao listar Assistants', description: e?.message || 'Verifique a API Key', variant: 'destructive' });
    } finally {
      setLoadingAssistants(false);
    }
  };
  
  // Sugestões de modelos por provider
  const ollamaModels = [
    { value: 'llama3.1:8b', label: 'Llama 3.1 8B (Ollama)', provider: 'Ollama' },
    { value: 'llama3.1:70b', label: 'Llama 3.1 70B (Ollama)', provider: 'Ollama' },
    { value: 'qwen2.5:7b', label: 'Qwen2.5 7B (Ollama)', provider: 'Ollama' },
    { value: 'mistral:7b', label: 'Mistral 7B (Ollama)', provider: 'Ollama' },
    { value: 'phi3:3.8b', label: 'Phi-3 3.8B (Ollama)', provider: 'Ollama' },
  ];
  const anthropicModels = [
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus', provider: 'Anthropic' },
    { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet', provider: 'Anthropic' },
    { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku', provider: 'Anthropic' },
  ];
  const googleModels = [
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', provider: 'Google' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', provider: 'Google' },
  ];
  const perplexityDynamic = availableModels.filter(m => (m.provider || '').toLowerCase() === 'perplexity');
  // Fallback atualizado: ids atuais da API da Perplexity
  const perplexityModels = (perplexityDynamic.length > 0 ? perplexityDynamic : [
    { value: 'sonar', label: 'Sonar', provider: 'Perplexity' },
    { value: 'sonar-pro', label: 'Sonar Pro', provider: 'Perplexity' },
    { value: 'sonar-reasoning', label: 'Sonar Reasoning', provider: 'Perplexity' },
    { value: 'sonar-reasoning-pro', label: 'Sonar Reasoning Pro', provider: 'Perplexity' },
    { value: 'sonar-deep-research', label: 'Sonar Deep Research', provider: 'Perplexity' },
  ]);
  // Modelos OpenAI vindos do catálogo quando possível (filtrados pelo provider correto)
  const openaiDynamic = availableModels.filter(m => (m.provider || '').toLowerCase() === 'openai');
  const openaiModels = (openaiDynamic.length > 0 ? openaiDynamic : [
    { value: 'gpt-4o', label: 'GPT-4o', provider: 'OpenAI' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'OpenAI' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo', provider: 'OpenAI' },
  ]).map(m => ({ value: m.value, label: m.label || m.value, provider: 'OpenAI' }));

  // Informações resumidas dos modelos para ajudar escolha
  const getModelInfo = (id: string | undefined | null): { title: string; description: string; bestFor?: string } | undefined => {
    if (!id) return undefined;
    const m = id.toLowerCase();
    // OpenAI
    if (m.includes('gpt-4.1')) return {
      title: 'GPT-4.1 (OpenAI)',
      description: 'Evolução do GPT‑4 com melhorias gerais de qualidade.',
      bestFor: 'tarefas complexas e conversação de alta qualidade'
    };
    if (m.includes('o3')) return {
      title: 'o3 (OpenAI)',
      description: 'Família voltada a raciocínio e otimização, ideal para problemas difíceis.',
      bestFor: 'raciocínio, planejamento e problemas estruturados'
    };
    if (m.includes('o1')) return {
      title: 'o1 (OpenAI)',
      description: 'Foco em custo/latência dentro da linha “o”.',
      bestFor: 'assistentes de uso geral com boa eficiência'
    };
    if (m.includes('gpt-4o-mini')) return {
      title: 'GPT-4o Mini (OpenAI)',
      description: 'Modelo rápido e econômico com boa qualidade geral.',
      bestFor: 'assistentes de uso geral, alto volume, baixa latência'
    };
    if (m.includes('gpt-4o')) return {
      title: 'GPT-4o (OpenAI)',
      description: 'Modelo multimodal de alta qualidade (texto, imagem, etc.).',
      bestFor: 'respostas de maior qualidade, tarefas complexas'
    };
    if (m.includes('gpt-4-turbo')) return {
      title: 'GPT-4 Turbo (OpenAI)',
      description: 'Variante otimizada do GPT‑4 para custo/latência.',
      bestFor: 'tarefas complexas com custo moderado'
    };
    if (m.includes('gpt-3.5-turbo')) return {
      title: 'GPT-3.5 Turbo (OpenAI)',
      description: 'Modelo legado com ótimo custo / benefício.',
      bestFor: 'chat básico, automações simples'
    };
    // Anthropic
    if (m.includes('opus')) return {
      title: 'Claude 3 Opus (Anthropic)',
      description: 'Qualidade topo de linha para tarefas exigentes.',
      bestFor: 'escrita longa, análise complexa, instruções detalhadas'
    };
    if (m.includes('claude-3-5-sonnet')) return {
      title: 'Claude 3.5 Sonnet (Anthropic)',
      description: 'Alto raciocínio e qualidade contextual.',
      bestFor: 'análise, escrita longa, tarefas complexas'
    };
    if (m.includes('claude-3-sonnet')) return {
      title: 'Claude 3 Sonnet (Anthropic)',
      description: 'Equilíbrio entre qualidade e custo.',
      bestFor: 'assistentes corporativos gerais'
    };
    if (m.includes('claude-3-haiku')) return {
      title: 'Claude 3 Haiku (Anthropic)',
      description: 'Mais econômico e rápido da família Claude 3.',
      bestFor: 'alto volume, latência baixa'
    };
    // Google
    if (m.includes('gemini-1.5-pro') || m.includes('1.5-pro')) return {
      title: 'Gemini 1.5 Pro (Google)',
      description: 'Melhor qualidade/raciocínio da linha Gemini 1.5.',
      bestFor: 'tarefas complexas, contexto grande'
    };
    if (m.includes('gemini-1.5-pro')) return {
      title: 'Gemini 1.5 Pro (Google)',
      description: 'Melhor qualidade/raciocínio da linha Gemini.',
      bestFor: 'tarefas complexas, contexto grande'
    };
    if (m.includes('gemini-1.5-flash')) return {
      title: 'Gemini 1.5 Flash (Google)',
      description: 'Mais rápido e econômico da linha 1.5.',
      bestFor: 'uso geral com latência baixa'
    };
    // Perplexity
    if (m.includes('sonar-small')) return {
      title: 'Sonar Small (Perplexity)',
      description: 'Especializado em respostas com busca online.',
      bestFor: 'pesquisa com citações e links'
    };
    if (m.includes('sonar-large')) return {
      title: 'Sonar Large (Perplexity)',
      description: 'Mais capacidade para pesquisa online e contexto.',
      bestFor: 'relatórios com fontes e raciocínio mais profundo'
    };
    // Ollama (locais)
    if (m.includes('llama3.1')) return {
      title: 'Llama 3.1 (Ollama)',
      description: 'Modelo local equilibrado, bom para protótipos/offline.',
      bestFor: 'privacidade, ambientes sem internet'
    };
    if (m.includes('qwen2.5')) return {
      title: 'Qwen 2.5 (Ollama)',
      description: 'Modelo local alternativo com bom custo/desempenho.',
      bestFor: 'tarefas gerais em ambiente local'
    };
    return undefined;
  };

  const generationModels = (
    generationProvider === 'openai' ? openaiModels :
    generationProvider === 'anthropic' ? anthropicModels :
    generationProvider === 'google' ? googleModels :
    generationProvider === 'perplexity' ? perplexityModels :
    ollamaModels
  );

  const generationPresets = generationModels.map(m => m.value);

  const ProviderTips = () => {
    if (generationProvider === 'google') {
      return (
        <div className="text-xs leading-relaxed max-w-xs">
          <p className="font-medium">Gemini (Google)</p>
          <p>Modelos recomendados:</p>
          <ul className="list-disc ml-4">
            <li><code>gemini-1.5-flash</code> (rápido e econômico)</li>
            <li><code>gemini-1.5-pro</code> (melhor qualidade/raciocínio)</li>
          </ul>
          <p className="mt-1">A chave deve ser do <strong>Google AI Studio</strong> (Generative Language API).</p>
          <p className="mt-2">
            Docs: <a href="https://ai.google.dev/gemini-api/docs" target="_blank" rel="noreferrer" className="underline">Gemini API</a>
          </p>
          <p className="mt-2 font-medium">Exemplo de prompt</p>
          <pre className="whitespace-pre-wrap bg-muted p-2 rounded">
Análise tabelada de vendas mensais.
Responda de forma concisa, com tópicos e recomendação final.
          </pre>
        </div>
      );
    }
    if (generationProvider === 'openai') {
      return (
        <div className="text-xs leading-relaxed max-w-xs">
          <p className="font-medium">OpenAI</p>
          <ul className="list-disc ml-4">
            <li><code>gpt-4o</code> (qualidade geral)</li>
            <li><code>gpt-4o-mini</code> (baixo custo/latência)</li>
          </ul>
          <p className="mt-1">“GPT-5” não está disponível publicamente.</p>
          <p className="mt-2">
            Docs: <a href="https://platform.openai.com/docs/overview" target="_blank" rel="noreferrer" className="underline">OpenAI Platform</a>
          </p>
          <p className="mt-2 font-medium">Exemplo de prompt</p>
          <pre className="whitespace-pre-wrap bg-muted p-2 rounded">
Você é um assistente que explica como se eu tivesse 12 anos.
Resuma o texto a seguir em 5 bullets e 1 insight acionável.
          </pre>
        </div>
      );
    }
    if (generationProvider === 'anthropic') {
      return (
        <div className="text-xs leading-relaxed max-w-xs">
          <p className="font-medium">Anthropic</p>
          <ul className="list-disc ml-4">
            <li><code>claude-3-5-sonnet-20241022</code> (se habilitado)</li>
            <li><code>claude-3-sonnet-20240229</code> (compatível ampla)</li>
          </ul>
          <p className="mt-2">
            Docs: <a href="https://docs.anthropic.com/claude/reference/complete_post" target="_blank" rel="noreferrer" className="underline">Claude API</a>
          </p>
          <p className="mt-2 font-medium">Exemplo de prompt</p>
          <pre className="whitespace-pre-wrap bg-muted p-2 rounded">
Atue como analista. Dê justificativas curtas e uma conclusão objetiva.
          </pre>
        </div>
      );
    }
    if (generationProvider === 'perplexity') {
      return (
        <div className="text-xs leading-relaxed max-w-xs">
          <p className="font-medium">Perplexity</p>
          <ul className="list-disc ml-4">
            <li><code>sonar</code> (lightweight model optimized for speed)</li>
            <li><code>sonar-pro</code> (advanced model for in-depth queries)</li>
            <li><code>sonar-reasoning</code> (fast reasoning model)</li>
            <li><code>sonar-reasoning-pro</code> (premier reasoning model)</li>
            <li><code>sonar-deep-research</code> (for exhaustive research tasks via async API)</li>
          </ul>
          <p className="mt-2">
            Docs: <a href="https://docs.perplexity.ai/" target="_blank" rel="noreferrer" className="underline">Perplexity API</a>
          </p>
          <p className="mt-2 font-medium">Exemplo de prompt</p>
          <pre className="whitespace-pre-wrap bg-muted p-2 rounded">
Pesquise fontes confiáveis e cite URLs ao final.
          </pre>
        </div>
      );
    }
    if (generationProvider === 'ollama') {
      return (
        <div className="text-xs leading-relaxed max-w-xs">
          <p className="font-medium">Ollama (local)</p>
          <ul className="list-disc ml-4">
            <li><code>llama3.1:8b</code> (padrão)</li>
            <li><code>llama3.1:70b</code>, <code>qwen2.5:7b</code>, etc.</li>
          </ul>
          <p className="mt-1">Configure o endpoint (ex.: http://localhost:11434).</p>
          <p className="mt-2">
            Docs: <a href="https://github.com/ollama/ollama" target="_blank" rel="noreferrer" className="underline">Ollama</a>
          </p>
          <p className="mt-2 font-medium">Exemplo de prompt</p>
          <pre className="whitespace-pre-wrap bg-muted p-2 rounded">
Responda em português, em até 120 palavras, com exemplos práticos.
          </pre>
        </div>
      );
    }
    return null;
  };

  const categories = ["Análise", "Criatividade", "Suporte", "Automação", "Pesquisa"];


  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {isNewAgent ? "Criar Novo Agente" : "Configurar Agente"}
            </h1>
            <p className="text-muted-foreground">
              {isNewAgent 
                ? "Configure um novo agente de IA para sua organização"
                : `Editando: ${agent?.name}`
              }
            </p>
          </div>
        </div>
        {/* Ações do Header */}
        <div className="flex items-center gap-2">
          <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
            <DialogTrigger asChild>
              <Button
                className="bg-gradient-primary hover:bg-primary-hover shadow-primary"
                disabled={!canPublishTemplate}
                title={canPublishTemplate ? "Publicar como Template" : "Você não tem permissão para publicar"}
              >
                Publicar como Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Publicar como Template</DialogTitle>
                <DialogDescription>
                  Preencha as informações do template. Ele ficará disponível no Marketplace (aba Empresa) da sua organização.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Título</Label>
                  <Input value={tplTitle} onChange={(e) => setTplTitle(e.target.value)} placeholder="Ex.: Assistente de Redação" />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea value={tplDesc} onChange={(e) => setTplDesc(e.target.value)} placeholder="Resumo do que o agente faz" />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Input value={tplCategory} onChange={(e) => setTplCategory(e.target.value)} placeholder="Ex.: Criatividade" />
                </div>
                <div>
                  <Label>Tags (separadas por vírgula)</Label>
                  <Input value={tplTags} onChange={(e) => setTplTags(e.target.value)} placeholder="redação, conteúdo, blog" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setPublishOpen(false)}>Cancelar</Button>
                <Button onClick={handlePublishTemplate} disabled={publishing} className="bg-gradient-primary">
                  {publishing ? 'Publicando…' : 'Publicar'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Bot className="w-4 h-4" />
            Configuração
          </TabsTrigger>
          <TabsTrigger value="governance" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Governança
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <Server className="w-4 h-4" />
            Integrações/Ações
          </TabsTrigger>
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="config">
          {(
            <Card className="animate-scale-in mb-6">
              <CardHeader>
                <CardTitle>Tipo de Agente</CardTitle>
                <CardDescription>
                  Escolha como deseja criar seu agente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup value={agentType} onValueChange={(value) => setAgentType(value as 'custom' | 'assistant')} className="space-y-4">
                  <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-accent/50 cursor-pointer">
                    <RadioGroupItem value="custom" id="custom" />
                    <div className="flex items-center gap-3 flex-1">
                      <Code className="w-5 h-5 text-primary" />
                      <div>
                        <Label htmlFor="custom" className="font-medium cursor-pointer">
                          Agente Personalizado
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Crie um agente do zero selecionando modelo e definindo prompts
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-accent/50 cursor-pointer">
                    <RadioGroupItem value="assistant" id="assistant" />
                    <div className="flex items-center gap-3 flex-1">
                      <Sparkles className="w-5 h-5 text-primary" />
                      <div>
                        <Label htmlFor="assistant" className="font-medium cursor-pointer">
                          Assistente Existente
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Use assistentes pré-desenvolvidos das principais APIs (OpenAI, Anthropic, Google)
                        </p>
                      </div>
                    </div>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          )}

          <Card className="animate-scale-in">
            <CardHeader>
              <CardTitle>
                {agentType === 'custom' ? 'Configuração do Agente' : 'Configurar Assistente'}
              </CardTitle>
              <CardDescription>
                {agentType === 'custom' 
                  ? 'Configure o comportamento e características do agente'
                  : 'Selecione e configure um assistente pré-desenvolvido'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {agentType === 'assistant' && (
                <div className="space-y-2">
                  <Label>Provedor do Assistente *</Label>
                  <Select value={assistantProvider} onValueChange={(v: any) => setAssistantProvider(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                      <SelectItem value="google">Google</SelectItem>
                      <SelectItem value="custom">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {agentType === 'assistant' && assistantProvider === 'openai' && (
                <div className="space-y-2">
                  <Label>ID do Assistente *</Label>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Input value={assistantId} onChange={(e) => setAssistantId(e.target.value)} placeholder="asst_... (OpenAI)" />
                      <Button type="button" variant="outline" onClick={() => importFromAssistant(assistantId)} disabled={!assistantId?.startsWith('asst_')}>
                        Importar do Assistente
                      </Button>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch id="saveLocalAssistant" checked={saveLocalAssistant} onCheckedChange={(val) => {
                        setSaveLocalAssistant(val as boolean);
                        try {
                          if (val && assistantId) localStorage.setItem('openai_assistant_id', assistantId);
                          if (!val) localStorage.removeItem('openai_assistant_id');
                        } catch {}
                      }} />
                      <Label htmlFor="saveLocalAssistant">Salvar como padrão local (navegador)</Label>
                      <span className="text-xs text-muted-foreground">
                        {(() => { try { const v = localStorage.getItem('openai_assistant_id'); return v ? `Atual: ${v}` : 'Nenhum padrão local salvo'; } catch { return ''; } })()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {agentType === 'assistant' && assistantProvider === 'openai' && (
                <div className="space-y-2">
                  <Label htmlFor="assistant-select">Assistente *</Label>
                  <Select value={selectedAssistant} onValueChange={async (value) => {
                    setSelectedAssistant(value);
                    const assistant = availableAssistants.find(a => a.value === value);
                    if (assistant) {
                      setName(assistant.label);
                      setDescription(assistant.description);
                      setModel(assistant.value);
                      setCategory("Pré-configurado");
                      setSystemPrompt(`Você é um ${assistant.label}. ${assistant.description}.`);
                    }
                    if (value?.startsWith('asst_')) {
                      setAssistantProvider('openai');
                      setAssistantId(value);
                      await importFromAssistant(value);
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um assistente" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableAssistants.map((assistant) => (
                        <SelectItem key={assistant.value} value={assistant.value}>
                          <div className="flex flex-col">
                            <span>{assistant.label}</span>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Ativo:</span>
                              <Badge variant="outline">{generationProvider}</Badge>
                              {isPreviewModel(generationProvider, assistant.value) && (
                                <Badge variant="outline" className="text-[10px]">Preview</Badge>
                              )}
                              {isRealtimeModel(generationProvider, assistant.value) && (
                                <Badge variant="outline" className="text-[10px]">Tempo real</Badge>
                              )}
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="secondary">{assistant.value}</Badge>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    {(() => { const info = getCatalogGenModelInfo(modelCatalog, generationProvider, assistant.value) || getGenModelInfo(generationProvider, assistant.value) || getModelInfo(assistant.value); return (
                                      <div>
                                        <div className="font-medium">{info?.title || assistant.value}</div>
                                        <div className="text-xs text-muted-foreground">{info?.description || 'Modelo selecionado.'}</div>
                                        {info?.bestFor && <div className="text-xs mt-1">Melhor para: {info.bestFor}</div>}
                                      </div>
                                    ); })()}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                      {fetchedAssistants.length > 0 && (
                        <>
                          {fetchedAssistants.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              <div className="flex flex-col">
                                <span>{a.name}</span>
                                {a.description && (
                                  <span className="text-xs text-muted-foreground">{a.description}</span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  {availableAssistants.length === 0 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Nenhum assistente disponível. Configure os provedores de LLM nas configurações da organização.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={handleListOpenAIAssistants} disabled={loadingAssistants}>
                      {loadingAssistants ? 'Carregando...' : 'Listar Assistants da OpenAI'}
                    </Button>
                    <Button type="button" variant="outline" onClick={async () => { if (selectedAssistant) { setAssistantId(selectedAssistant); setAssistantProvider('openai'); await importFromAssistant(selectedAssistant); } }} disabled={!selectedAssistant}>
                      Usar Selecionado como ID
                    </Button>
                  </div>
                </div>
              )}
              {agentType === 'assistant' && assistantProvider !== 'openai' && (
                <div className="p-3 rounded border bg-muted/30 text-sm">
                  O modo "Assistente Existente" é suportado apenas para OpenAI (Assistants v2). Para Anthropic/Google/Outro, utilize o modo "Agente Personalizado" com o provider de geração desejado.
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Agente *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Assistente de Análise"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Categoria *</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição *</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva o propósito e capacidades do agente"
                  rows={3}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="retention">Limite de histórico</Label>
                  <Input
                    id="retention"
                    type="number"
                    min={50}
                    max={5000}
                    value={retentionLimit}
                    onChange={(e) => setRetentionLimit(Math.max(50, Math.min(5000, Number(e.target.value) || 200)))}
                  />
                  <p className="text-xs text-muted-foreground">Número máximo de mensagens armazenadas por este agente.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="retention_days">Retenção por tempo (dias)</Label>
                  <Input
                    id="retention_days"
                    type="number"
                    min={0}
                    max={3650}
                    value={retentionDays}
                    onChange={(e) => setRetentionDays(Math.max(0, Math.min(3650, Number(e.target.value) || 0)))}
                  />
                  <p className="text-xs text-muted-foreground">0 desativa retenção por tempo. Se &gt; 0, mensagens com data anterior serão removidas.</p>
                </div>
              </div>

              {agentType === 'custom' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="systemPrompt">Prompt do Sistema *</Label>
                    <Textarea
                      id="systemPrompt"
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      placeholder="Defina a personalidade e comportamento do agente..."
                      rows={6}
                    />
                    <p className="text-xs text-muted-foreground">
                      Este prompt define como o agente se comportará nas conversas.
                    </p>
                  </div>
                </>
              )}

              {agentType === 'assistant' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="systemPrompt">Instruções Adicionais</Label>
                    {assistantInstructionsImported && (
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Instruções importadas</Badge>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSystemPrompt(prevAssistantInstructions);
                            setName(prevName);
                            setDescription(prevDescription);
                            setAssistantInstructionsImported(false);
                          }}
                        >
                          Restaurar
                        </Button>
                      </div>
                    )}
                  </div>
                  <Textarea
                    id="systemPrompt"
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="Adicione instruções específicas para personalizar o comportamento do assistente (opcional)..."
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Personalize o comportamento do assistente com instruções adicionais
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="análise, dados, relatórios"
                />
                <p className="text-xs text-muted-foreground">
                  Separe as tags com vírgulas
                </p>
              </div>

              <Separator />

              {/* Anexos / Arquivos */}
              <div className="space-y-2">
                <Label>Uploads de Arquivos</Label>
                <div className="flex items-center justify-between border rounded p-3">
                  <div>
                    <p className="text-sm font-medium">Permitir upload de arquivos no chat</p>
                    <p className="text-xs text-muted-foreground">Ative para exibir o botão de anexar no chat deste agente.</p>
                  </div>
                  <Switch checked={allowUploads} onCheckedChange={setAllowUploads} />
                </div>
                {allowUploads && (
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Modo de armazenamento</Label>
                      <Select value={fileStorageMode} onValueChange={(v: any) => setFileStorageMode(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="openai_vector_store">OpenAI Vector Store</SelectItem>
                          <SelectItem value="local_rag">RAG Local (Supabase)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        OpenAI Vector Store envia arquivos para a OpenAI. RAG Local mantém os arquivos na sua infraestrutura.
                      </p>
                    </div>
                  </div>
                )}
              </div>
              {/* LLM do Agente */}
              <div className="space-y-3">
                <Label>LLM do Agente</Label>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>Provider de geração</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="p-1 rounded hover:bg-accent" aria-label="Dicas de provider">
                              <Info className="w-4 h-4 text-muted-foreground" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" align="start">
                            <ProviderTips />
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Select value={generationProvider} onValueChange={(v: any) => debugSetGenerationProvider(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                        <SelectItem value="google">Google</SelectItem>
                        <SelectItem value="perplexity">Perplexity</SelectItem>
                        <SelectItem value="ollama">Ollama (local)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Define quem gera as respostas no chat.</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="model">Modelo de IA (geração)</Label>
                        {generationProvider === 'perplexity' && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[360px] text-xs">
                                <div className="font-medium mb-1">Perplexity Sonar</div>
                                <div className="space-y-1">
                                  <div><strong>Online</strong>: faz browsing em tempo real e pode exibir referências/citações.</div>
                                  <div><strong>Chat</strong>: não acessa a web; usa apenas o conhecimento do modelo e o contexto.</div>
                                  <div className="pt-1">
                                    <a className="text-primary underline" href="https://docs.perplexity.ai/getting-started/models" target="_blank" rel="noreferrer">Saiba mais na documentação</a>
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={reloadModels}
                        disabled={loadingModels}
                        className="text-xs h-7 px-2"
                      >
                        {loadingModels ? (
                          <div className="flex items-center gap-1">
                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            <span>Recarregando...</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <RotateCcw className="h-3 w-3" />
                            <span>Recarregar</span>
                          </div>
                        )}
                      </Button>
                    </div>
                    <Select value={model} onValueChange={(val) => {
                      if (isPreviewModel(generationProvider, val)) {
                        setPendingModel(val);
                        setPendingReason('preview');
                        setPreviewConfirmOpen(true);
                        return;
                      }
                      if (isRealtimeModel(generationProvider, val)) {
                        setPendingModel(val);
                        setPendingReason('realtime');
                        setPreviewConfirmOpen(true);
                        return;
                      }
                      setModel(val);
                      // Atualiza automaticamente o generationProvider com base no modelo selecionado
                      const selectedModel = availableModels.find(m => m.value === val);
                      if (selectedModel) {
                        console.log('🔄 Atualizando generationProvider baseado no modelo:', { model: val, provider: selectedModel.provider });
                        debugSetGenerationProvider(selectedModel.provider as any);
                      }
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um modelo de IA" />
                      </SelectTrigger>
                      <SelectContent>
                        {generationProvider === 'perplexity' ? (
                          <>
                            <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">Online (com browsing)</div>
                            {generationModels.filter((m) => ['sonar-reasoning', 'sonar-reasoning-pro', 'sonar-deep-research'].includes(m.value)).map((m) => (
                              <SelectItem key={m.value} value={m.value}>
                                <div className="flex flex-col">
                                  <span className="flex items-center gap-2">
                                    {m.label}
                                  </span>
                                  <span className="text-xs text-muted-foreground">{m.provider} • com referências da web</span>
                                </div>
                              </SelectItem>
                            ))}
                            <div className="px-2 pt-2 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Chat (sem browsing)</div>
                            {generationModels.filter((m) => ['sonar', 'sonar-pro'].includes(m.value)).map((m) => (
                              <SelectItem key={m.value} value={m.value}>
                                <div className="flex flex-col">
                                  <span className="flex items-center gap-2">
                                    {m.label}
                                  </span>
                                  <span className="text-xs text-muted-foreground">{m.provider} • sem busca na web</span>
                                </div>
                              </SelectItem>
                            ))}
                          </>
                        ) : (
                          <>
                            {generationModels.map((m) => (
                              <SelectItem key={m.value} value={m.value}>
                                <div className="flex flex-col">
                                  <span className="flex items-center gap-2">
                                    {m.label}
                                    {isPreviewModel(generationProvider, m.value) && (
                                      <Badge variant="outline" className="text-[10px]">Preview</Badge>
                                    )}
                                  </span>
                                  <span className="text-xs text-muted-foreground">{m.provider}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    {(() => { 
                      const info = getCatalogGenModelInfo(modelCatalog, generationProvider, model) 
                        || getGenModelInfo(generationProvider, model) 
                        || getModelInfo(model); 
                      // Cálculo inline dos badges para evitar escopo
                      const p = (generationProvider || '').toLowerCase();
                      const mval = (model || '').toLowerCase();
                      const best = (info?.bestFor || '').toLowerCase();
                      const badges = Array.from(new Set([
                        ...(p === 'ollama' ? ['Local'] : []),
                        ...(mval.includes('realtime') ? ['Tempo real'] : []),
                        ...(mval.includes('audio') ? ['Áudio'] : []),
                        ...((mval.includes('mini') || mval.includes('nano') || mval.includes('flash') || /custo/i.test(best)) ? ['Custo baixo'] : []),
                        ...((mval.includes('mini') || mval.includes('flash') || mval.includes('realtime') || /latência/i.test(best)) ? ['Latência baixa'] : []),
                      ]));
                      return (
                      <div className="mt-2 p-3 border rounded bg-muted/30">
                        <div className="text-xs font-medium mb-1">Sobre o modelo</div>
                        <div className="text-xs text-muted-foreground">
                          <div className="font-medium">{info?.title || model}</div>
                          <div>{info?.description || 'Modelo selecionado.'}</div>
                          {badges.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {badges.map((b) => (
                                <Badge key={b} variant="outline" className="text-[10px] py-0.5 inline-flex items-center">
                                  {b === 'Latência baixa' ? <Gauge className="h-3.5 w-3.5 mr-1" /> :
                                   b === 'Custo baixo' ? <DollarSign className="h-3.5 w-3.5 mr-1" /> :
                                   b === 'Tempo real' ? <Zap className="h-3.5 w-3.5 mr-1" /> :
                                   b === 'Áudio' ? <Headphones className="h-3.5 w-3.5 mr-1" /> :
                                   b === 'Local' ? <Server className="h-3.5 w-3.5 mr-1" /> : null}
                                  {b}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {info?.bestFor && <div className="mt-1">Melhor para: {info.bestFor}</div>}
                          {(isPreviewModel(generationProvider, model)) && (
                            <div className="mt-2 rounded border p-2 bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300">
                              Atenção: este modelo está em Preview/Experimental e pode sofrer mudanças ou ter limites/custos diferenciados.
                            </div>
                          )}
                        </div>
                      </div>
                      ); 
                    })()}
                    {generationModels.length === 0 && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Nenhum modelo de IA configurado. Configure os provedores de LLM nas configurações da organização.
                      </p>
                    )}
                    {generationPresets.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2 items-center">
                        <span className="text-xs text-muted-foreground">Presets:</span>
                        {generationPresets.slice(0,6).map((p) => (
                          <Button key={p} type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setModel(p)}>
                            {p}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={testCurrentAgent}>
                    Testar este agente
                  </Button>
                </div>

                {allowUploads && fileStorageMode === 'local_rag' && (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Provider de embeddings (RAG Local)</Label>
                        <Select value={embeddingProvider} onValueChange={(v: any) => {
                          setEmbeddingProvider(v);
                          if (!embeddingModel) {
                            if (v === 'openai') {
                              setEmbeddingModel('text-embedding-3-small');
                            } else if (v === 'ollama') {
                              setEmbeddingModel('nomic-embed-text');
                            }
                          }
                        }}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="openai">OpenAI</SelectItem>
                            <SelectItem value="ollama">Ollama</SelectItem>
                          </SelectContent>
                        </Select>
                        {(() => { const info = ((): any => ({
                          provider: getEmbeddingModelInfo(embeddingProvider, embeddingModel) ? { title: (getEmbeddingModelInfo(embeddingProvider, embeddingModel) as any).title.split('(')[1]?.includes('OpenAI') ? 'OpenAI Embeddings' : 'Ollama (Local Embeddings)', description: (getEmbeddingModelInfo(embeddingProvider, embeddingModel) as any)?.description } : undefined,
                          model: getEmbeddingModelInfo(embeddingProvider, embeddingModel)
                        }))() || getEmbeddingInfo(embeddingProvider as any, embeddingModel);
                        return (
                          <div className="mt-2 text-xs flex items-start gap-2">
                            <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{info.provider?.title || 'Provider de embeddings'}</div>
                              <div className="text-muted-foreground">{info.provider?.description || 'Quem gera os vetores para busca de trechos (RAG Local).'}</div>
                            </div>
                          </div>
                        ); })()}
                      </div>
                      <div className="space-y-2">
                        <Label>Modelo de embeddings</Label>
                        <Select value={embeddingModel} onValueChange={setEmbeddingModel}>
                          <SelectTrigger>
                            <SelectValue placeholder={embeddingProvider === 'ollama' ? 'nomic-embed-text' : 'text-embedding-3-small'} />
                          </SelectTrigger>
                          <SelectContent>
                            {embeddingProvider === 'openai' && (
                              <>
                                <SelectItem value="text-embedding-3-small">text-embedding-3-small (OpenAI)</SelectItem>
                                <SelectItem value="text-embedding-3-large">text-embedding-3-large (OpenAI)</SelectItem>
                              </>
                            )}
                            {embeddingProvider === 'ollama' && (
                              <>
                                <SelectItem value="nomic-embed-text">nomic-embed-text (Ollama)</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="rounded border p-2 text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-300">
                      Ao alterar o provider/modelo de embeddings, reindexe os documentos deste agente para garantir resultados consistentes.
                    </div>

                    {(agent && ((agent as any).embedding_provider !== embeddingProvider || ((agent as any).embedding_model || '') !== (embeddingModel || ''))) && (
                      <div className="flex items-center justify-between gap-3 p-3 border rounded bg-amber-50 dark:bg-amber-950/20">
                        <div className="text-sm text-amber-800 dark:text-amber-200">
                          Detectamos mudança no provider/modelo de embeddings. É recomendado reindexar os documentos deste agente.
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={reindexing}
                          onClick={async () => {
                            if (!organization?.id || !agent?.id) return;
                            try {
                              setReindexedCount(null);
                              setReindexing(true);
                              const { data: docs, error } = await supabase
                                .from('rag_documents')
                                .select('id, filename, storage_path')
                                .eq('agent_id', agent.id);
                              if (error) throw error;
                              const list = (docs || []).filter((d: any) => !!d.storage_path);
                              let ok = 0;
                              for (const d of list as any[]) {
                                const { data: session } = await supabase.auth.getSession();
                                const accessToken = session.session?.access_token;
                                const functionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest-doc`;
                                const res = await fetch(functionsUrl, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
                                  body: JSON.stringify({ agent_id: agent.id, organization_id: organization.id, storage_path: d.storage_path })
                                });
                                if (res.ok) ok++;
                              }
                              setReindexedCount(ok);
                              toast({ title: 'Reindexação concluída', description: `${ok} documento(s) reindexado(s).` });
                            } catch (e: any) {
                              toast({ title: 'Falha na reindexação', description: e?.message || 'Erro ao reindexar documentos', variant: 'destructive' });
                            } finally {
                              setReindexing(false);
                            }
                          }}
                        >
                          {reindexing ? 'Reindexando...' : 'Reindexar documentos'}
                        </Button>
                      </div>
                    )}
                  </>
                )}

                {allowUploads && fileStorageMode === 'openai_vector_store' && (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Vector Store (OpenAI)</Label>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" onClick={ensureAndPersistVectorStore} disabled={vsLoading}>
                            {vectorStoreId ? 'Reconectar/Validar' : 'Criar/Conectar'}
                          </Button>
                          {vectorStoreId && (
                            <span className="text-xs text-muted-foreground break-all">ID: {vectorStoreId}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">Crie ou conecte o Vector Store para este agente e envie arquivos abaixo.</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Enviar arquivos</Label>
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.doc,.docx,.txt,.md,.yaml,.yml,.json"
                          disabled={vsUploading}
                          onChange={(e) => {
                            const files = e.target.files; if (import.meta.env.DEV) console.debug('[AgentConfigPage] onChange input files', { count: files?.length, names: files ? Array.from(files).map(f => f.name) : [] });
                            if (files && files.length) handleUploadVSFiles(files);
                            e.currentTarget.value = '';
                          }}
                        />
                        {vsUploading && (
                          <p className="text-xs text-muted-foreground">Enviando…</p>
                        )}
                        <p className="text-xs text-muted-foreground">Tamanho máximo por arquivo pode ser limitado pela OpenAI.</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <Label>Arquivos no Vector Store</Label>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={refreshVectorStoreFiles} disabled={vsLoading}>Atualizar</Button>
                        </div>
                      </div>
                      {vsLoading ? (
                        <p className="text-sm text-muted-foreground">Carregando…</p>
                      ) : vsFiles.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum arquivo listado. Envie arquivos para este Vector Store.</p>
                      ) : (
                        <div className="max-h-56 overflow-auto border rounded">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-muted/50 text-muted-foreground">
                                <th className="text-left px-2 py-1">Arquivo</th>
                                <th className="text-left px-2 py-1">Status</th>
                                <th className="text-left px-2 py-1">Criado em</th>
                                <th className="text-left px-2 py-1">Ações</th>
                              </tr>
                            </thead>
                            <tbody>
                              {vsFiles.map((f) => (
                                <tr key={f.id} className="border-t">
                                  <td className="px-2 py-1 truncate max-w-[320px]" title={f.filename || f.id}>{f.filename || f.id}</td>
                                  <td className="px-2 py-1">
                                    {(() => {
                                      const st = (f as any).status || 'unknown';
                                      const err = (f as any).error as string | null;
                                      if (st === 'in_progress' || st === 'processing') return <span className="text-amber-600">Processando…</span>;
                                      if (st === 'completed' || st === 'ready') return <span className="text-emerald-700">Pronto</span>;
                                      if (st === 'failed') {
                                        return (
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <span className="text-red-600 underline decoration-dotted cursor-help">Falhou</span>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p className="max-w-xs text-xs">{err || 'Falha no processamento do arquivo.'}</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        );
                                      }
                                      return <span className="text-muted-foreground">—</span>;
                                    })()}
                                  </td>
                                  <td className="px-2 py-1">{f.created_at ? new Date(f.created_at).toLocaleString('pt-BR') : '-'}</td>
                                  <td className="px-2 py-1">
                                    <Button size="sm" variant="destructive" onClick={() => handleRemoveVSFile(f.id)} disabled={vsLoading}>Remover</Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )}
</div>

              <div className="flex justify-end">
                <Button onClick={handleSave} className="bg-gradient-primary shadow-primary">
                  <Save className="w-4 h-4 mr-2" />
                  {isNewAgent ? "Criar Agente" : "Salvar Alterações"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrações / Ações externas */}
        <TabsContent value="integrations">
          <Card className="animate-scale-in">
            <CardHeader>
              <CardTitle>Ações externas disponíveis</CardTitle>
              <CardDescription>
                Selecione as ações do n8n que este agente poderá utilizar como tools.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingActions && (
                <div className="text-sm text-muted-foreground">Carregando ações…</div>
              )}
              {!loadingActions && externalActions.length === 0 && (
                <div className="text-sm text-muted-foreground">Nenhuma ação cadastrada. Cadastre em Settings &gt; Integrações &gt; n8n (Ações Externas).</div>
              )}
              {!loadingActions && externalActions.length > 0 && (
                <div className="space-y-2">
                  {externalActions.map((a) => {
                    const checked = selectedActionIds.has(a.id);
                    return (
                      <div key={a.id} className="flex items-center justify-between border rounded-md p-3">
                        <div className="min-w-0 pr-3">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(val) => {
                                setSelectedActionIds((prev) => {
                                  const next = new Set(prev);
                                  if (val) next.add(a.id); else next.delete(a.id);
                                  return next;
                                });
                              }}
                            />
                            <span className="font-medium truncate">{a.name}</span>
                            {a.enabled ? <Badge className="ml-1">Ativa</Badge> : <Badge variant="destructive" className="ml-1">Inativa</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{a.method} • {a.url}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="text-xs text-muted-foreground">As seleções são salvas quando você clicar em “Salvar” na aba Configuração.</div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Governance Tab */}
        <TabsContent value="governance">
          <div className="space-y-6">
            {/* Agent Information */}
            {/* Modelo & Prompt / Memória & Contexto */}
            <Card className="animate-scale-in" style={{ animationDelay: '0.03s' }}>
              <CardHeader>
                <CardTitle>Modelo & Prompt</CardTitle>
                <CardDescription>Defina as instruções do sistema (System Prompt) e parâmetros de memória</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label>Mensagem de boas-vindas</Label>
                  <Input
                    placeholder="Ex.: Sou seu agente de consulta de CNPJ. Escreva o CNPJ e clique em enviar."
                    value={welcomeMessage}
                    onChange={(e) => setWelcomeMessage(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Exibida no chat quando o histórico estiver vazio. Você pode personalizar por agente.</p>
                </div>

                <div className="grid gap-2">
                  <Label>Instruções do Sistema (System Prompt)</Label>
                  <Textarea
                    rows={6}
                    placeholder="Ex.: Você é um assistente corporativo..."
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                  />
                </div>

                <div className="grid md:grid-cols-4 gap-3">
                  <div className="grid gap-2">
                    <Label>Limite de tokens do histórico</Label>
                    <Input type="number" value={historyTokenLimit} onChange={(e) => setHistoryTokenLimit(Number(e.target.value || 0))} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Ativar sumarização</Label>
                    <div className="flex items-center gap-2 h-10">
                      <Switch checked={enableSummarization} onCheckedChange={setEnableSummarization} />
                      <span className="text-sm text-muted-foreground">Condensar histórico longo</span>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Limiar para sumarização (tokens)</Label>
                    <Input type="number" value={summarizationTokenThreshold} onChange={(e) => setSummarizationTokenThreshold(Number(e.target.value || 0))} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Máx. caracteres do sumário</Label>
                    <Input type="number" value={summarizationMaxChars} onChange={(e) => setSummarizationMaxChars(Number(e.target.value || 0))} />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="button" onClick={handleSaveMemoryConfig}>
                    <Save className="w-4 h-4 mr-2" /> Salvar Configurações
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Segurança & Políticas */}
            <Card className="animate-scale-in" style={{ animationDelay: '0.04s' }}>
              <CardHeader>
                <CardTitle>Segurança & Políticas</CardTitle>
                <CardDescription>Controle de vazamento de prompt e termos sensíveis</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label>Instruções Adicionais (concatenadas ao System Prompt)</Label>
                  <Textarea
                    rows={4}
                    placeholder="Regras internas da organização que NUNCA devem ser reveladas..."
                    value={additionalInstructions}
                    onChange={(e) => setAdditionalInstructions(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Esse texto é concatenado ao System Prompt como “Regras da organização”.</p>
                </div>

                <div className="grid md:grid-cols-3 gap-3">
                  <div className="grid gap-2">
                    <Label>Strict Mode</Label>
                    <div className="flex items-center gap-2 h-10">
                      <Switch checked={strictMode} onCheckedChange={setStrictMode} />
                      <span className="text-sm text-muted-foreground">Recusa pedidos de vazamento e sanitiza respostas</span>
                    </div>
                  </div>
                  <div className="grid gap-2 md:col-span-2">
                    <Label>Termos bloqueados (regex separados por vírgula)</Label>
                    <Input
                      type="text"
                      placeholder="system prompt,internal rules,segredo123"
                      value={blockedTermsText}
                      onChange={(e) => setBlockedTermsText(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Ex.: <code>system prompt</code>, <code>internal rules</code>, <code>segredo\d+</code></p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="button" onClick={handleSaveMemoryConfig}>
                    <Save className="w-4 h-4 mr-2" /> Salvar Políticas
                  </Button>
                </div>
              </CardContent>
            </Card>

            {!isNewAgent && agent && (
              <Card className="animate-scale-in">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Informações do Agente</CardTitle>
                      <CardDescription>
                        Histórico e metadados do agente
                      </CardDescription>
                    </div>
                    {hasPermission(currentUser.role, 'Deletar um agente') && (
                      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={deletingAgent}
                            className="relative z-10 pointer-events-auto"
                            onClick={() => {
                              if (!agent?.id) {
                                toast({ title: 'Agente inválido', description: 'ID do agente não encontrado.', variant: 'destructive' });
                                return;
                              }
                              console.debug('[Governança] Remover Agente - abrir modal para', agent.id);
                            }}
                          >
                            Remover Agente
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover este agente?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. Todas as configurações e histórico associados serão removidos.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={deletingAgent}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              disabled={deletingAgent}
                              onClick={async () => {
                                if (!agent?.id) return;
                                setDeletingAgent(true);
                                try {
                                  const { error } = await supabase.from('agents').delete().eq('id', agent.id);
                                  if (error) throw error;
                                  // remove do estado global imediatamente
                                  try { setAgents(agents.filter(a => a.id !== agent.id)); } catch {}
                                  toast({ title: 'Agente removido', description: 'O agente foi excluído com sucesso.' });
                                  navigate('/dashboard');
                                } catch (e: any) {
                                  toast({ title: 'Falha ao remover agente', description: e?.message || 'Tente novamente', variant: 'destructive' });
                                } finally {
                                  setDeletingAgent(false);
                                  setShowDeleteDialog(false);
                                }
                              }}
                            >
                              {deletingAgent ? 'Removendo...' : 'Confirmar remoção'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <Label className="text-sm font-medium">Criado por</Label>
                      <p className="text-sm text-muted-foreground">
                        {agent.createdBy} • {agent.createdAt}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Última atualização</Label>
                      <p className="text-sm text-muted-foreground">{agent.updatedAt}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Versão atual</Label>
                      <Badge variant="outline">v{agent.version}</Badge>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Total de Interações
                      </Label>
                      <p className="text-2xl font-bold">{agent.usageCount}</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Status
                      </Label>
                      <Badge className={
                        agent.status === 'active' ? 'bg-success text-success-foreground' :
                        agent.status === 'inactive' ? 'bg-muted text-muted-foreground' :
                        'bg-warning text-warning-foreground'
                      }>
                        {agent.status === 'active' ? 'Ativo' : 
                         agent.status === 'inactive' ? 'Inativo' : 'Pendente'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {!isNewAgent && agent && (
              <Card className="animate-scale-in" style={{ animationDelay: '0.05s' }}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Compartilhamento</CardTitle>
                      <CardDescription>Defina quem pode acessar este agente</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Permissão efetiva:</span>
                      <Badge variant="outline">{effectivePerm === 'loading' ? '...' : effectivePerm}</Badge>
                      {!isNewAgent && (
                        hasPublicShare ? (
                          <Button type="button" variant="outline" size="sm" disabled={loadingPublicShare} onClick={() => setPublicShare(false)}>
                            Remover público
                          </Button>
                        ) : (
                          <Button type="button" size="sm" className="bg-gradient-primary" disabled={loadingPublicShare} onClick={() => setPublicShare(true)}>
                            Tornar público
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {hasPublicShare && (
                    <div className="rounded border p-3 text-xs flex items-start gap-2 bg-blue-50 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200">
                      <Info className="h-4 w-4 mt-0.5" />
                      <div>
                        <div className="font-medium">Agente público</div>
                        <div>
                          Este agente está compartilhado como <strong>público</strong>. Ele ficará visível para todos da sua organização no Marketplace/Templates.
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="grid md:grid-cols-4 gap-3">
                    <div className="grid gap-2">
                      <Label>Compartilhar com</Label>
                      <Select value={shareTargetType} onValueChange={(v: any) => setShareTargetType(v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o alvo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="public">Público (toda a organização)</SelectItem>
                          <SelectItem value="user">Usuário específico (por e-mail)</SelectItem>
                          <SelectItem value="group">Grupo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {shareTargetType === 'user' && (
                      <div className="grid gap-2">
                        <Label>E-mail do usuário</Label>
                        <Input type="email" placeholder="usuario@empresa.com" value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} />
                      </div>
                    )}
                    {shareTargetType === 'group' && (
                      <div className="grid gap-2">
                        <Label>Grupo</Label>
                        <Select value={shareGroupId} onValueChange={setShareGroupId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um grupo" />
                          </SelectTrigger>
                          <SelectContent>
                            {groups.map(g => (
                              <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="grid gap-2">
                      <Label>Permissão</Label>
                      <Select value={sharePermission} onValueChange={(v: any) => setSharePermission(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="view">Visualizar</SelectItem>
                          <SelectItem value="edit">Editar</SelectItem>
                          <SelectItem value="admin">Administrar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2 md:col-span-1"></div>
                    <div className="grid gap-2 md:col-span-3">
                      <Label>Mensagem (opcional)</Label>
                      <Textarea rows={3} placeholder="Adicione um recado para quem receber o acesso" value={shareMessage} onChange={(e) => setShareMessage(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button type="button" onClick={handleCreateShare} disabled={loadingShare}>
                      <Share2 className="w-4 h-4 mr-2" />
                      {loadingShare ? 'Adicionando...' : 'Adicionar compartilhamento'}
                    </Button>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="text-sm text-muted-foreground">{agentShares.length} compartilhamento(s) ativo(s)</div>
                    {agentShares.map((s) => (
                      <div key={s.id} className="border rounded-lg p-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline">{s.target_type === 'public' ? 'Público' : s.target_type === 'user' ? 'Usuário' : 'Grupo'}</Badge>
                          {s.target_user_id && <span className="text-xs text-muted-foreground">user:{s.target_user_id}</span>}
                          {s.target_group_id && <span className="text-xs text-muted-foreground">group:{s.target_group_id}</span>}
                          {s.message && <span className="text-xs text-muted-foreground">• {s.message}</span>}
                          <span className="text-xs text-muted-foreground">• {new Date(s.created_at).toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select value={s.permission} onValueChange={(v: any) => updateSharePerm(s.id, v)}>
                            <SelectTrigger className="h-8 w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="view">Visualizar</SelectItem>
                              <SelectItem value="edit">Editar</SelectItem>
                              <SelectItem value="admin">Administrar</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button type="button" variant="outline" size="icon" onClick={() => revokeShare(s.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {agentShares.length === 0 && (
                      <p className="text-sm text-muted-foreground">Nenhum compartilhamento criado para este agente.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Version History */}
            <Card className="animate-scale-in" style={{ animationDelay: '0.1s' }}>
              <CardHeader>
                <CardTitle>Histórico de Versões</CardTitle>
                <CardDescription>
                  Acompanhe as mudanças e evoluções do agente
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isNewAgent ? (
                  <div className="text-center py-8">
                    <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      O histórico será criado após salvar o agente
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 border rounded-lg">
                      <Badge>v{agent?.version}</Badge>
                      <div className="flex-1">
                        <p className="font-medium">Versão atual</p>
                        <p className="text-sm text-muted-foreground">
                          Atualizado em {agent?.updatedAt}
                        </p>
                      </div>
                    </div>
                    
                    {/* Mock previous versions */}
                    {agent && agent.version > 1 && (
                      <div className="flex items-center gap-4 p-4 border rounded-lg opacity-60">
                        <Badge variant="outline">v{agent.version - 1}</Badge>
                        <div className="flex-1">
                          <p className="font-medium">Versão anterior</p>
                          <p className="text-sm text-muted-foreground">
                            Atualizado em {agent.createdAt}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AgentConfigPage;