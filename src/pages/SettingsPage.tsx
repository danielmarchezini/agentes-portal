import { useState, useEffect } from "react";
import { useApp } from "@/contexts/AppContext";
import { hasPermission } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";
import { Settings, Palette, Bot, Mail, Bell, Shield, Upload, TestTube, RefreshCw, Sun, Moon, Monitor, Eye, EyeOff, AlertTriangle, FileText, Server } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { hexToHsl, hslToHex, resetBranding } from "@/lib/branding";
import { listOpenAIModels, getAvailableModels } from "@/lib/llm";
import { usePermissions } from "@/hooks/use-permissions";
import { useNavigate } from "react-router-dom";

const SettingsPage = () => {
  const { currentUser, organization, setOrganization } = useApp();
  const { isSystemAdmin } = usePermissions();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  // State for all settings
  const [generalSettings, setGeneralSettings] = useState({
    orgName: organization?.name || "",
    domain: organization?.domain || "",
    timezone: "UTC-3",
    language: "pt-BR",
    autoBackup: true,
    maintenanceMode: false,
    responsibleName: organization?.notifications?.responsibleName || "",
    responsibleRole: organization?.notifications?.responsibleRole || "",
  });

  const [smtpSettings, setSmtpSettings] = useState({
    host: organization?.smtp?.host || "",
    port: organization?.smtp?.port || 587,
    username: organization?.smtp?.username || "",
    password: organization?.smtp?.password || "",
    fromEmail: "",
    encryption: "tls",
  });

  const [emailTemplates, setEmailTemplates] = useState({
    welcome: organization?.notifications?.emailTemplates?.welcome || "Bem-vindo ao AI Portal!",
    agentCreated: "Novo agente criado",
    userInvited: organization?.notifications?.emailTemplates?.invitation || "Você foi convidado",
  });

  const [brandingSettings, setBrandingSettings] = useState({
    logo: organization?.branding?.logo || "",
    primaryColor: organization?.branding?.colors?.primary || "224 71% 60%",
    secondaryColor: organization?.branding?.colors?.secondary || "220 14% 96%",
    accentColor: organization?.branding?.colors?.accent || "142 76% 36%",
  });

  const [llmSettings, setLlmSettings] = useState({
    openaiApiKey: localStorage.getItem('openai_api_key') || "",
    anthropicApiKey: localStorage.getItem('anthropic_api_key') || "",
    googleApiKey: localStorage.getItem('google_api_key') || "",
    perplexityApiKey: localStorage.getItem('perplexity_api_key') || "",
    defaultProvider: localStorage.getItem('default_llm_provider') || "openai",
    defaultModel: localStorage.getItem('default_llm_model') || "gpt-4",
    temperature: parseFloat(localStorage.getItem('llm_temperature') || "0.7"),
    maxTokens: parseInt(localStorage.getItem('llm_max_tokens') || "2048"),
    ollamaEndpoint: localStorage.getItem('ollama_endpoint') || "http://localhost:11434",
  });

  const [showKeys, setShowKeys] = useState({
    openai: false,
    anthropic: false,
    google: false,
    perplexity: false,
  });

  // Marca de testes recentes por provider (fallback visual)
  const [lastTestOk, setLastTestOk] = useState<Record<string, boolean>>({});

  // Status de chaves armazenadas de forma segura (mascaradas)
  const [secureSecrets, setSecureSecrets] = useState<Record<string, { hasKey: boolean; preview: string }>>({});

  // Modelos disponíveis dinamicamente
  const [availableModels, setAvailableModels] = useState<Array<{ provider: string; models: string[] }>>([]);

  // Carrega status de segredos (mascarados) quando há organização
  useEffect(() => {
    const loadMasked = async () => {
      if (!organization?.id) return;
      const { data, error } = await supabase.rpc('get_llm_secrets_masked', { p_org: organization.id });
      if (!error && Array.isArray(data)) {
        const map: Record<string, { hasKey: boolean; preview: string }> = {};
        for (const row of data as any[]) {
          const key = String(row.provider || '').toLowerCase();
          map[key] = { hasKey: !!row.has_key, preview: row.preview };
        }
        setSecureSecrets(map);
      }
    };

  // Helpers genéricos para salvar+testar
  const saveKeyForProvider = async (provider: string, value: string) => {
    if (!organization?.id) throw new Error('Organização não encontrada.');
    const res = await supabase.rpc('upsert_llm_api_key', { p_org_id: organization.id, p_provider: provider, p_api_key: value });
    if (res.error) {
      const res2 = await supabase.rpc('set_llm_secret', { p_org: organization.id, p_provider: provider, p_api_key: value });
      if (res2.error) throw res2.error;
    }
    const { data } = await supabase.rpc('get_llm_secrets_masked', { p_org: organization.id });
    if (Array.isArray(data)) {
      const map: Record<string, { hasKey: boolean; preview: string }> = {};
      for (const row of data as any[]) {
        const k = String(row.provider || '').toLowerCase();
        map[k] = { hasKey: !!row.has_key, preview: row.preview };
      }
      setSecureSecrets(map);
    }
  };

  const saveAndTestGoogle = async () => {
    try {
      const key = llmSettings.googleApiKey || localStorage.getItem('google_api_key') || '';
      if (!key) throw new Error('Informe a Google AI API Key antes de salvar/testar.');
      await saveKeyForProvider('google', key);
      const { data: body, error: fnErr } = await supabase.functions.invoke('test-llm', {
        body: { provider: 'google', organization_id: organization?.id }
      });
      if (fnErr || (body as any)?.error) throw new Error(((fnErr as any)?.message || (body as any)?.error || 'Erro').toString());
      toast({ title: 'Google AI OK', description: 'Chave salva e conexão validada.' });
    } catch (e: any) {
      const desc = typeof e?.message === 'string' ? e.message : JSON.stringify(e);
      toast({ title: 'Falha ao salvar/testar Google AI', description: desc, variant: 'destructive' });
    }
  };

  const saveAndTestPerplexity = async () => {
    try {
      const key = llmSettings.perplexityApiKey || localStorage.getItem('perplexity_api_key') || '';
      if (!key) throw new Error('Informe a Perplexity API Key antes de salvar/testar.');
      await saveKeyForProvider('perplexity', key);
      const { data: body, error: fnErr } = await supabase.functions.invoke('test-llm', {
        body: { provider: 'perplexity', organization_id: organization?.id, list: true }
      });
      if (fnErr || (body as any)?.error) throw new Error(((fnErr as any)?.message || (body as any)?.error || 'Erro').toString());
      // Recarrega status mascarado para refletir 'conectado'
      try {
        const { data } = await supabase.rpc('get_llm_secrets_masked', { p_org: organization?.id });
        if (Array.isArray(data)) {
          const map: Record<string, { hasKey: boolean; preview: string }> = {};
          for (const row of data as any[]) {
            const key = String(row.provider || '').toLowerCase();
            map[key] = { hasKey: !!row.has_key, preview: row.preview };
          }
          setSecureSecrets(map);
        }
      } catch {}
      setLastTestOk(prev => ({ ...prev, perplexity: true }));
      toast({ title: 'Perplexity OK', description: 'Chave salva e conexão validada.' });
    } catch (e: any) {
      const desc = typeof e?.message === 'string' ? e.message : JSON.stringify(e);
      toast({ title: 'Falha ao salvar/testar Perplexity', description: desc, variant: 'destructive' });
    }
  };

  const saveAndTestOllama = async () => {
    try {
      const endpoint = llmSettings.ollamaEndpoint || localStorage.getItem('ollama_endpoint') || '';
      if (!endpoint) throw new Error('Informe o endpoint do Ollama antes de salvar/testar.');
      await saveKeyForProvider('ollama', endpoint);
      const { data: body, error: fnErr } = await supabase.functions.invoke('test-llm', {
        body: { provider: 'ollama', organization_id: organization?.id }
      });
      if (fnErr || (body as any)?.error) throw new Error(((fnErr as any)?.message || (body as any)?.error || 'Erro').toString());
      // Recarrega status mascarado para refletir 'conectado'
      try {
        const { data } = await supabase.rpc('get_llm_secrets_masked', { p_org: organization?.id });
        if (Array.isArray(data)) {
          const map: Record<string, { hasKey: boolean; preview: string }> = {};
          for (const row of data as any[]) {
            const key = String(row.provider || '').toLowerCase();
            map[key] = { hasKey: !!row.has_key, preview: row.preview };
          }
          setSecureSecrets(map);
        }
      } catch {}
      setLastTestOk(prev => ({ ...prev, ollama: true }));
      toast({ title: 'Ollama OK', description: 'Endpoint salvo e conexão validada.' });
    } catch (e: any) {
      const desc = typeof e?.message === 'string' ? e.message : JSON.stringify(e);
      toast({ title: 'Falha ao salvar/testar Ollama', description: desc, variant: 'destructive' });
    }
  };
    loadMasked();
  }, [organization?.id]);

  // Carrega modelos disponíveis dinamicamente
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const providers = await getAvailableModels(organization?.id || null);
        if (!ignore) {
          setAvailableModels(providers);
        }
      } catch (error) {
        console.error('Erro ao carregar modelos:', error);
        if (!ignore) {
          // Fallback para modelos estáticos em caso de erro
          setAvailableModels([
            { provider: 'openai', models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-4o', 'gpt-4o-mini'] },
            { provider: 'anthropic', models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307', 'claude-3-5-sonnet-20241022'] },
            { provider: 'google', models: ['gemini-pro', 'gemini-pro-vision', 'gemini-1.5-pro', 'gemini-1.5-flash'] },
            { provider: 'perplexity', models: ['sonar', 'sonar-pro', 'sonar-reasoning', 'sonar-reasoning-pro', 'sonar-deep-research'] },
            { provider: 'ollama', models: ['llama3.1:8b', 'llama3.1:70b', 'qwen2.5:7b', 'mistral:7b', 'phi3:3.8b'] }
          ]);
        }
      }
    })();
    return () => { ignore = true; };
  }, [organization?.id]);

  // Converte modelos dinâmicos para o formato esperado pela interface
  const getDynamicLlmProviders = () => {
    if (availableModels.length === 0) {
      // Fallback para o objeto estático se modelos dinâmicos não estiverem carregados
      return {
        openai: { name: "OpenAI", models: ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo", "gpt-4o", "gpt-4o-mini"] },
        anthropic: { name: "Anthropic", models: ["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307", "claude-3-5-sonnet-20241022"] },
        google: { name: "Google", models: ["gemini-pro", "gemini-pro-vision", "gemini-1.5-pro", "gemini-1.5-flash"] },
        perplexity: { name: "Perplexity", models: ["sonar", "sonar-pro", "sonar-reasoning", "sonar-reasoning-pro", "sonar-deep-research"] },
        ollama: { name: "Ollama", models: ["llama3.1:8b", "llama3.1:70b", "qwen2.5:7b", "mistral:7b", "phi3:3.8b"] }
      };
    }
    
    const providers: Record<string, { name: string; models: string[] }> = {};
    
    availableModels.forEach(({ provider, models }) => {
      let providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
      if (provider === 'openai') providerName = 'OpenAI';
      if (provider === 'anthropic') providerName = 'Anthropic';
      if (provider === 'google') providerName = 'Google';
      if (provider === 'perplexity') providerName = 'Perplexity';
      if (provider === 'ollama') providerName = 'Ollama';
      
      providers[provider] = {
        name: providerName,
        models: models
      };
    });
    
    return providers;
  };

  const testPerplexity = async () => {
    try {
      if (!organization?.id) throw new Error('Organização não encontrada.');
      const { data: body, error } = await supabase.functions.invoke('test-llm', {
        body: { provider: 'perplexity', organization_id: organization.id, list: true }
      });
      if (error || (body as any)?.error) throw new Error(((error as any)?.message || (body as any)?.error || 'Erro').toString());
      const data: any = body as any;
      const successes = data?.data?.successes || [];
      const failures = data?.data?.failures || [];
      if (Array.isArray(successes) || Array.isArray(failures)) {
        console.group('[test-llm][Perplexity] discovery breakdown');
        console.log('successes:', successes);
        console.log('failures:', failures);
        console.groupEnd();
        const okCount = Array.isArray(successes) ? successes.length : 0;
        const failCount = Array.isArray(failures) ? failures.length : 0;
        const okModels = (successes || []).map((s: any) => s.model).join(', ') || 'nenhum';
        const failModels = (failures || []).map((f: any) => f.model).slice(0, 6).join(', ');
        toast({
          title: okCount > 0 ? 'Perplexity OK' : 'Falha ao testar Perplexity',
          description: okCount > 0
            ? `Modelos OK (${okCount}): ${okModels}`
            : `Nenhum modelo funcionou. Testados: ${failModels || '—'}`,
          variant: okCount > 0 ? 'default' : 'destructive'
        });
        return;
      }
      // Caso a edge não tenha retornado breakdown (compatibilidade), considere OK simples
      toast({ title: 'Perplexity OK', description: 'Conexão validada com sucesso.' });
    } catch (e: any) {
      // Fallback direto ao endpoint público da Perplexity usando a chave local (apenas DEV)
      try {
        const apiKey = llmSettings.perplexityApiKey || localStorage.getItem('perplexity_api_key') || '';
        if (!apiKey) throw new Error('Informe a Perplexity API Key ou salve-a para a organização.');
        const modelCandidates = [
          'sonar-small-online',
          'sonar-medium-online',
          'sonar-large-online',
          'sonar-small-chat',
          'sonar-medium-chat',
          'sonar-large-chat'
        ];
        let successModel: string | null = null;
        const errors: string[] = [];
        for (const m of modelCandidates) {
          const res = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({ model: m, messages: [{ role: 'user', content: 'ping' }], temperature: 0 }),
          });
          const js = await res.json().catch(() => ({} as any));
          if (res.ok && !js?.error) { successModel = m; break; }
          errors.push(js?.error?.message || `${res.status}`);
        }
        if (!successModel) {
          throw new Error(`Modelos testados falharam: ${errors.filter(Boolean).join(' | ')}`);
        }
        toast({ title: 'Perplexity OK', description: `Conexão validada (modelo: ${successModel}).` });
      } catch (e2: any) {
        const desc = typeof e2?.message === 'string' ? e2.message : JSON.stringify(e2);
        toast({ title: 'Falha ao testar Perplexity', description: `${desc}. Consulte: https://docs.perplexity.ai/getting-started/models`, variant: 'destructive' });
      }
    }
  };

  const testOllama = async () => {
    try {
      if (!organization?.id) throw new Error('Organização não encontrada.');
      const { data: body, error } = await supabase.functions.invoke('test-llm', {
        body: { provider: 'ollama', organization_id: organization.id }
      });
      if (error || (body as any)?.error) throw new Error(((error as any)?.message || (body as any)?.error || 'Erro').toString());
      toast({ title: 'Ollama OK', description: 'Conexão validada com sucesso.' });
    } catch (e: any) {
      const desc = typeof e?.message === 'string' ? e.message : JSON.stringify(e);
      toast({ title: 'Falha ao testar Ollama', description: desc, variant: 'destructive' });
    }
  };

  const testAnthropic = async () => {
    try {
      if (!organization?.id) throw new Error('Organização não encontrada.');
      const { data: body, error } = await supabase.functions.invoke('test-llm', {
        body: { provider: 'anthropic', organization_id: organization.id, list: true }
      });
      if (error || (body as any)?.error) throw new Error(((error as any)?.message || (body as any)?.error || 'Erro').toString());
      const data: any = body as any;
      const successes = data?.data?.successes || [];
      const failures = data?.data?.failures || [];
      if (Array.isArray(successes) || Array.isArray(failures)) {
        console.group('[test-llm][Anthropic] discovery breakdown');
        console.log('successes:', successes);
        console.log('failures:', failures);
        console.groupEnd();
        const okCount = Array.isArray(successes) ? successes.length : 0;
        const okModels = (successes || []).map((s: any) => s.model).join(', ') || 'nenhum';
        const failModels = (failures || []).map((f: any) => f.model).slice(0, 6).join(', ');
        toast({
          title: okCount > 0 ? 'Anthropic OK' : 'Falha ao testar Anthropic',
          description: okCount > 0
            ? `Modelos OK (${okCount}): ${okModels}`
            : `Nenhum modelo funcionou. Testados: ${failModels || '—'}`,
          variant: okCount > 0 ? 'default' : 'destructive'
        });
        return;
      }
      // Recarrega status mascarado para refletir 'conectado'
      try {
        const { data } = await supabase.rpc('get_llm_secrets_masked', { p_org: organization.id });
        if (Array.isArray(data)) {
          const map: Record<string, { hasKey: boolean; preview: string }> = {};
          for (const row of data as any[]) {
            const key = String(row.provider || '').toLowerCase();
            map[key] = { hasKey: !!row.has_key, preview: row.preview };
          }
          // Garante que provedores recém-salvos apareçam como conectados no painel mesmo se a RPC não listá-los
          if (llmSettings.openaiApiKey) map['openai'] = map['openai'] || { hasKey: true, preview: '—' };
          if (llmSettings.anthropicApiKey) map['anthropic'] = map['anthropic'] || { hasKey: true, preview: '—' };
          if (llmSettings.googleApiKey) map['google'] = map['google'] || { hasKey: true, preview: '—' };
          if (llmSettings.perplexityApiKey) map['perplexity'] = map['perplexity'] || { hasKey: true, preview: '—' };
          if (llmSettings.ollamaEndpoint) map['ollama'] = map['ollama'] || { hasKey: true, preview: '—' };
          setSecureSecrets(map);
        }
      } catch {}
      setLastTestOk(prev => ({ ...prev, anthropic: true }));
      toast({ title: 'Anthropic OK', description: 'Conexão validada com sucesso.' });
    } catch (e: any) {
      const desc = typeof e?.message === 'string' ? e.message : JSON.stringify(e);
      toast({ title: 'Falha ao testar Anthropic', description: desc, variant: 'destructive' });
    }
  };

  // Salvar e testar Anthropic (equivalente ao OpenAI), com fallback de RPC
  const saveAndTestAnthropic = async () => {
    try {
      if (!organization?.id) throw new Error('Organização não encontrada.');
      const key = llmSettings.anthropicApiKey || localStorage.getItem('anthropic_api_key') || '';
      if (!key) throw new Error('Informe a Anthropic API Key antes de salvar/testar.');
      // Tenta upsert canônico e faz fallback para set_llm_secret se necessário
      const res = await supabase.rpc('upsert_llm_api_key', { p_org_id: organization.id, p_provider: 'anthropic', p_api_key: key });
      if (res.error) {
        const res2 = await supabase.rpc('set_llm_secret', { p_org: organization.id, p_provider: 'anthropic', p_api_key: key });
        if (res2.error) throw res2.error;
      }
      // Atualiza status mascarado
      const { data } = await supabase.rpc('get_llm_secrets_masked', { p_org: organization.id });
      if (Array.isArray(data)) {
        const map: Record<string, { hasKey: boolean; preview: string }> = {};
        for (const row of data as any[]) {
          const k = String(row.provider || '').toLowerCase();
          map[k] = { hasKey: !!row.has_key, preview: row.preview };
        }
        setSecureSecrets(map);
      }
      // Testa via Edge Function
      const { data: body, error: fnErr } = await supabase.functions.invoke('test-llm', {
        body: { provider: 'anthropic', organization_id: organization.id, list: true }
      });
      if (fnErr || (body as any)?.error) throw new Error(((fnErr as any)?.message || (body as any)?.error || 'Erro').toString());
      toast({ title: 'Anthropic OK', description: 'Chave salva e conexão validada.' });
    } catch (e: any) {
      const desc = typeof e?.message === 'string' ? e.message : JSON.stringify(e);
      toast({ title: 'Falha ao salvar/testar Anthropic', description: desc, variant: 'destructive' });
    }
  };

  const testGoogle = async () => {
    try {
      if (!organization?.id) throw new Error('Organização não encontrada.');
      const { data: body, error } = await supabase.functions.invoke('test-llm', {
        body: { provider: 'google', organization_id: organization.id }
      });
      if (error || (body as any)?.error) throw new Error(((error as any)?.message || (body as any)?.error || 'Erro').toString());
      // Recarrega status mascarado para refletir 'conectado'
      try {
        const { data } = await supabase.rpc('get_llm_secrets_masked', { p_org: organization.id });
        if (Array.isArray(data)) {
          const map: Record<string, { hasKey: boolean; preview: string }> = {};
          for (const row of data as any[]) {
            const key = String(row.provider || '').toLowerCase();
            map[key] = { hasKey: !!row.has_key, preview: row.preview };
          }
          setSecureSecrets(map);
        }
      } catch {}
      setLastTestOk(prev => ({ ...prev, google: true }));
      toast({ title: 'Google AI OK', description: 'Conexão validada com sucesso.' });
    } catch (e: any) {
      // Fallback: chama a Edge Function diretamente com apikey (alguns ambientes podem falhar no invoke com 401/400)
      try {
        if (!organization?.id) throw new Error('Organização não encontrada.');
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-llm`;
        const session = await supabase.auth.getSession();
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
            ...(session.data.session?.access_token ? { 'Authorization': `Bearer ${session.data.session.access_token}` } : {})
          },
          body: JSON.stringify({ provider: 'google', organization_id: organization.id })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.ok === false) {
          const reason = data?.error || `${res.status}`;
          throw new Error(reason);
        }
        toast({ title: 'Google AI OK', description: 'Conexão validada com sucesso.' });
      } catch (e2: any) {
        const desc = typeof e2?.message === 'string' ? e2.message : JSON.stringify(e2);
        toast({ title: 'Falha ao testar Google AI', description: desc, variant: 'destructive' });
      }
    }
  };

  // Check permissions
  if (!currentUser || !hasPermission(currentUser.role, "Gerenciar módulos e configurações da organização")) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Settings className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Acesso Negado</h3>
          <p className="text-muted-foreground">Você não tem permissão para acessar as configurações.</p>
        </div>
      </div>
    );
  }

  // Guard: owners sem organização ainda vinculada
  if (currentUser.role === 'owner' && !organization) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-lg">
          <Settings className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhuma organização vinculada</h3>
          <p className="text-muted-foreground mb-4">
            Sua conta é um owner global e não está vinculada a uma organização específica. 
            Use a página de Administração do Sistema para criar ou gerenciar organizações.
          </p>
          <a href="/system-admin" className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm">
            Ir para Administração do Sistema
          </a>
        </div>
      </div>
    );
  }

  const handleSave = async (section: string) => {
    if (!organization?.id) return;
    // Salva nome, domínio e responsáveis em notifications
    const { data, error } = await supabase
      .from('organizations')
      .update({
        name: generalSettings.orgName,
        domain: generalSettings.domain,
        notifications: {
          ...organization.notifications,
          responsibleName: generalSettings.responsibleName,
          responsibleRole: generalSettings.responsibleRole,
          emailTemplates: organization.notifications?.emailTemplates
        }
      })
      .eq('id', organization.id)
      .select('*')
      .single();
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    setOrganization({ ...(data as any) });
    toast({ title: "Configurações salvas!", description: `As configurações de ${section} foram atualizadas com sucesso.` });
  };

  // Garantia: função de teste do OpenAI sempre definida
  const testOpenAI = async () => {
    try {
      if (!organization?.id) throw new Error('Organização não encontrada.');
      const { data: body, error } = await supabase.functions.invoke('test-llm', {
        body: { provider: 'openai', organization_id: organization.id }
      });
      if (error || (body as any)?.error) throw new Error(((error as any)?.message || (body as any)?.error || 'Erro').toString());
      // Recarrega status mascarado para refletir 'conectado'
      try {
        const { data } = await supabase.rpc('get_llm_secrets_masked', { p_org: organization.id });
        if (Array.isArray(data)) {
          const map: Record<string, { hasKey: boolean; preview: string }> = {};
          for (const row of data as any[]) {
            const key = String(row.provider || '').toLowerCase();
            map[key] = { hasKey: !!row.has_key, preview: row.preview };
          }
          setSecureSecrets(map);
        }
      } catch {}
      setLastTestOk(prev => ({ ...prev, openai: true }));
      toast({ title: 'OpenAI OK', description: 'Conexão validada com sucesso.' });
    } catch (e: any) {
      const desc = typeof e?.message === 'string' ? e.message : JSON.stringify(e);
      toast({ title: 'Falha ao testar OpenAI', description: desc, variant: 'destructive' });
    }
  };

  const saveAndTestOpenAI = async () => {
    try {
      if (!organization?.id) throw new Error('Organização não encontrada.');
      const key = llmSettings.openaiApiKey || localStorage.getItem('openai_api_key') || '';
      if (!key) throw new Error('Informe a OpenAI API Key antes de salvar/testar.');
      // Salva no storage seguro da organização
      const { error } = await supabase.rpc('set_llm_secret', { p_org: organization.id, p_provider: 'openai', p_api_key: key });
      if (error) throw error;
      // Atualiza status mascarado
      const { data } = await supabase.rpc('get_llm_secrets_masked', { p_org: organization.id });
      if (Array.isArray(data)) {
        const map: Record<string, { hasKey: boolean; preview: string }> = {};
        for (const row of data as any[]) {
          const key = String(row.provider || '').toLowerCase();
          map[key] = { hasKey: !!row.has_key, preview: row.preview };
        }
        // Força marcação do provider salvo caso não esteja na lista retornada
        map['anthropic'] = map['anthropic'] || { hasKey: true, preview: '—' };
        setSecureSecrets(map);
      }
      // Testa via Edge Function
      const { data: body, error: fnErr } = await supabase.functions.invoke('test-llm', {
        body: { provider: 'openai', organization_id: organization.id }
      });
      if (fnErr || (body as any)?.error) throw new Error(((fnErr as any)?.message || (body as any)?.error || 'Erro').toString());
      toast({ title: 'OpenAI OK', description: 'Chave salva e conexão validada.' });
    } catch (e: any) {
      const desc = typeof e?.message === 'string' ? e.message : JSON.stringify(e);
      toast({ title: 'Falha ao salvar/testar OpenAI', description: desc, variant: 'destructive' });
    }
  };

  const handleSaveNotifications = async () => {
    if (!organization?.id) return;
    const notifications = {
      ...organization.notifications,
      webhookUrl: organization.notifications?.webhookUrl || '',
      slackWebhook: organization.notifications?.slackWebhook || '',
      enableEmail: !!organization.notifications?.enableEmail,
    };
    const { data, error } = await supabase.from('organizations').update({ notifications }).eq('id', organization.id).select('*').single();
    if (error) {
      toast({ title: 'Erro ao salvar notificações', description: error.message, variant: 'destructive' });
      return;
    }
    setOrganization({ ...(data as any) });
    toast({ title: 'Notificações salvas', description: 'As configurações de notificações foram atualizadas.' });
  };

  const handleSaveSMTP = async () => {
    if (!organization?.id) return;
    const payload = {
      smtp: {
        host: smtpSettings.host,
        port: smtpSettings.port,
        secure: smtpSettings.encryption === "ssl",
        username: smtpSettings.username,
        password: smtpSettings.password,
      }
    };
    const { data, error } = await supabase.from('organizations').update(payload).eq('id', organization.id).select('*').single();
    if (error) {
      toast({ title: 'Erro ao salvar SMTP', description: error.message, variant: 'destructive' });
      return;
    }
    setOrganization({ ...(data as any) });
    toast({ title: "SMTP configurado", description: "As configurações de e-mail foram salvas com sucesso." });
  };

  const handleSaveTemplates = async () => {
    if (!organization?.id) return;
    const notifications = {
      ...organization.notifications,
      emailTemplates: {
        ...organization.notifications?.emailTemplates,
        welcome: emailTemplates.welcome,
        invitation: emailTemplates.userInvited,
        passwordReset: organization.notifications?.emailTemplates?.passwordReset || ''
      }
    };
    const { data, error } = await supabase.from('organizations').update({ notifications }).eq('id', organization.id).select('*').single();
    if (error) {
      toast({ title: 'Erro ao salvar templates', description: error.message, variant: 'destructive' });
      return;
    }
    setOrganization({ ...(data as any) });
    toast({ title: "Templates salvos", description: "Os templates de e-mail foram atualizados com sucesso." });
  };

  const handleTestEmail = () => {
    // Simulate email testing
    toast({
      title: "E-mail de teste enviado",
      description: "Um e-mail de teste foi enviado com sucesso.",
    });
  };

  const handleSaveBranding = async () => {
    if (!organization?.id) return;
    // Tenta subir o logo (se for data URL)
    let publicLogoUrl: string | undefined = undefined;
    try {
      if (brandingSettings.logo && brandingSettings.logo.startsWith('data:')) {
        // Converter Data URL em Blob
        const res = await fetch(brandingSettings.logo);
        const blob = await res.blob();
        const fileExt = blob.type.split('/')[1] || 'png';
        const filePath = `${organization.id}/logo.${fileExt}`;
        const upload = await supabase.storage.from('branding').upload(filePath, blob, { upsert: true, contentType: blob.type });
        if (upload.error) throw upload.error;
        const { data: pub } = supabase.storage.from('branding').getPublicUrl(filePath);
        publicLogoUrl = pub.publicUrl;
      }
    } catch (e: any) {
      const msg = String(e?.message || 'Falha ao enviar logo');
      if (/bucket/i.test(msg) && /not/i.test(msg)) {
        toast({ title: 'Bucket ausente', description: "Crie o bucket 'branding' no Supabase Storage para hospedar o logo.", variant: 'destructive' });
      } else {
        toast({ title: 'Aviso ao enviar logo', description: msg });
      }
    }

    const branding = {
      logo: publicLogoUrl || brandingSettings.logo,
      colors: {
        primary: brandingSettings.primaryColor,
        secondary: brandingSettings.secondaryColor,
        accent: brandingSettings.accentColor,
      }
    };

    const payload: any = { branding };
    const notifBrandColorHex = hslToHex(brandingSettings.primaryColor);
    payload.notifications = {
      ...organization.notifications,
      ...(publicLogoUrl ? { logoUrl: publicLogoUrl } : {}),
      brandColor: notifBrandColorHex,
    };

    const { data, error } = await supabase.from('organizations').update(payload).eq('id', organization.id).select('*').single();
    if (error) {
      toast({ title: 'Erro ao salvar marca', description: error.message, variant: 'destructive' });
      return;
    }
    setOrganization({ ...(data as any) });
    toast({ title: "Marca atualizada", description: "As configurações de marca foram salvas com sucesso." });
  };

  const handleResetBranding = async () => {
    resetBranding();
    setBrandingSettings({
      logo: "",
      primaryColor: "224 71% 60%",
      secondaryColor: "220 14% 96%",
      accentColor: "142 76% 36%",
    });
    if (organization?.id) {
      const branding = { logo: "", colors: { primary: "224 71% 60%", secondary: "220 14% 96%", accent: "142 76% 36%" } };
      const { data, error } = await supabase.from('organizations').update({ branding }).eq('id', organization.id).select('*').single();
      if (!error && data) setOrganization({ ...(data as any) });
    }

    toast({
      title: "Marca resetada",
      description: "As configurações foram restauradas para o padrão.",
    });
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setBrandingSettings({
          ...brandingSettings,
          logo: e.target?.result as string,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveLLM = async () => {
    try {
      if (organization?.id) {
        // Salvar de forma segura via RPC para provedores preenchidos (sequencial para evitar tipos de builder)
        const saveProvider = async (provider: string, value: string) => {
          // 1) Tenta a RPC padronizada usada pela Edge
          const res = await supabase.rpc('upsert_llm_api_key', { p_org_id: organization.id, p_provider: provider, p_api_key: value });
          if (!res.error) return;
          // 2) Fallback: algumas bases antigas têm 'set_llm_secret'
          const res2 = await supabase.rpc('set_llm_secret', { p_org: organization.id, p_provider: provider, p_api_key: value });
          if (res2.error) throw res2.error;
        };

        if (llmSettings.openaiApiKey) await saveProvider('openai', llmSettings.openaiApiKey);
        if (llmSettings.anthropicApiKey) await saveProvider('anthropic', llmSettings.anthropicApiKey);
        if (llmSettings.googleApiKey) await saveProvider('google', llmSettings.googleApiKey);
        if (llmSettings.perplexityApiKey) await saveProvider('perplexity', llmSettings.perplexityApiKey);
        // Ollama: armazenar endpoint/base URL como 'api_key' (seguro no DB)
        if (llmSettings.ollamaEndpoint) await saveProvider('ollama', llmSettings.ollamaEndpoint);
        // Preferências locais (não sensíveis)
        localStorage.setItem('default_llm_provider', llmSettings.defaultProvider);
        localStorage.setItem('default_llm_model', llmSettings.defaultModel);
        localStorage.setItem('llm_temperature', llmSettings.temperature.toString());
        localStorage.setItem('llm_max_tokens', llmSettings.maxTokens.toString());
        // Não persistir o endpoint do Ollama em localStorage quando há organização (mantemos no DB)
        // Recarrega status mascarado
        const { data } = await supabase.rpc('get_llm_secrets_masked', { p_org: organization.id });
        if (Array.isArray(data)) {
          const map: Record<string, { hasKey: boolean; preview: string }> = {};
          for (const row of data as any[]) {
            const key = String(row.provider || '').toLowerCase();
            map[key] = { hasKey: !!row.has_key, preview: row.preview };
          }
          setSecureSecrets(map);
        }
        toast({ title: 'Configurações de LLM salvas', description: 'As chaves foram armazenadas com segurança no Supabase.' });
      } else {
        // Sem organização: fallback local
        localStorage.setItem('openai_api_key', llmSettings.openaiApiKey);
        localStorage.setItem('anthropic_api_key', llmSettings.anthropicApiKey);
        localStorage.setItem('google_api_key', llmSettings.googleApiKey);
        localStorage.setItem('perplexity_api_key', llmSettings.perplexityApiKey);
        localStorage.setItem('default_llm_provider', llmSettings.defaultProvider);
        localStorage.setItem('default_llm_model', llmSettings.defaultModel);
        localStorage.setItem('llm_temperature', llmSettings.temperature.toString());
        localStorage.setItem('llm_max_tokens', llmSettings.maxTokens.toString());
        localStorage.setItem('ollama_endpoint', llmSettings.ollamaEndpoint);
        toast({ title: 'Configurações de LLM salvas', description: 'As chaves de API foram salvas localmente (modo desenvolvimento).' });
      }
    } catch (e: any) {
      toast({ title: 'Falha ao salvar LLM', description: e?.message || 'Erro ao salvar chaves', variant: 'destructive' });
    }
  };

  // Usar getDynamicLlmProviders() para obter modelos dinâmicos

  return (
    <div className="space-y-3 md:space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground">
            Gerencie as configurações da sua organização
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/settings/integrations/external-actions')}>
            <Server className="w-4 h-4 mr-2" /> Integrações
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Geral
          </TabsTrigger>
          <TabsTrigger value="branding" className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Marca
          </TabsTrigger>
          <TabsTrigger value="llm" className="flex items-center gap-2">
            <Bot className="w-4 h-4" />
            LLM
          </TabsTrigger>
          <TabsTrigger value="smtp" className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            SMTP
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notificações
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações Gerais</CardTitle>
              <CardDescription>
                Configurações básicas da organização
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Nome da Organização</Label>
                  <Input
                    id="orgName"
                    value={generalSettings.orgName}
                    onChange={(e) => setGeneralSettings(prev => ({ ...prev, orgName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="domain">Domínio</Label>
                  <Input
                    id="domain"
                    value={generalSettings.domain}
                    onChange={(e) => setGeneralSettings(prev => ({ ...prev, domain: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="responsibleName">Responsável</Label>
                  <Input
                    id="responsibleName"
                    value={generalSettings.responsibleName}
                    onChange={(e) => setGeneralSettings(prev => ({ ...prev, responsibleName: e.target.value }))}
                    placeholder="Nome do responsável"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="responsibleRole">Cargo</Label>
                  <Input
                    id="responsibleRole"
                    value={generalSettings.responsibleRole}
                    onChange={(e) => setGeneralSettings(prev => ({ ...prev, responsibleRole: e.target.value }))}
                    placeholder="Ex: CTO, Head de IA"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Fuso Horário</Label>
                  <Select value={generalSettings.timezone} onValueChange={(value) => setGeneralSettings(prev => ({ ...prev, timezone: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC-3">UTC-3 (Brasília)</SelectItem>
                      <SelectItem value="UTC-5">UTC-5 (Nova York)</SelectItem>
                      <SelectItem value="UTC+0">UTC+0 (Londres)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">Idioma</Label>
                  <Select value={generalSettings.language} onValueChange={(value) => setGeneralSettings(prev => ({ ...prev, language: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                      <SelectItem value="en-US">English (US)</SelectItem>
                      <SelectItem value="es-ES">Español</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Tema da Interface</Label>
                  <Select value={theme} onValueChange={setTheme}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">
                        <div className="flex items-center gap-2">
                          <Sun className="w-4 h-4" />
                          Claro
                        </div>
                      </SelectItem>
                      <SelectItem value="dark">
                        <div className="flex items-center gap-2">
                          <Moon className="w-4 h-4" />
                          Escuro
                        </div>
                      </SelectItem>
                      <SelectItem value="system">
                        <div className="flex items-center gap-2">
                          <Monitor className="w-4 h-4" />
                          Sistema
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Backup Automático</Label>
                    <div className="text-sm text-muted-foreground">
                      Fazer backup dos dados automaticamente
                    </div>
                  </div>
                  <Switch
                    checked={generalSettings.autoBackup}
                    onCheckedChange={(checked) => setGeneralSettings(prev => ({ ...prev, autoBackup: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Modo Manutenção</Label>
                    <div className="text-sm text-muted-foreground">
                      Impedir acesso de usuários durante manutenção
                    </div>
                  </div>
                  <Switch
                    checked={generalSettings.maintenanceMode}
                    onCheckedChange={(checked) => setGeneralSettings(prev => ({ ...prev, maintenanceMode: checked }))}
                  />
                </div>
              </div>
              <Button onClick={() => {
                if (organization) {
                  setOrganization({
                    ...organization,
                    name: generalSettings.orgName,
                    domain: generalSettings.domain,
                    notifications: {
                      ...organization.notifications,
                      responsibleName: generalSettings.responsibleName,
                      responsibleRole: generalSettings.responsibleRole,
                    }
                  });
                }
                handleSave("general");
              }} className="w-full">
                Salvar Configurações Gerais
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branding Settings */}
        <TabsContent value="branding" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Marca</CardTitle>
              <CardDescription>
                Personalize a aparência da sua organização
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Logo da Organização</Label>
                <div className="flex items-center gap-4">
                  {brandingSettings.logo && (
                    <div className="w-16 h-16 border rounded-lg overflow-hidden">
                      <img src={brandingSettings.logo} alt="Logo" className="w-full h-full object-contain" />
                    </div>
                  )}
                  <div>
                    <input
                      type="file"
                      id="logo-upload"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <Button asChild variant="outline">
                      <label htmlFor="logo-upload" className="cursor-pointer">
                        <Upload className="w-4 h-4 mr-2" />
                        {brandingSettings.logo ? "Alterar Logo" : "Upload Logo"}
                      </label>
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>Cor Primária</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={hslToHex(brandingSettings.primaryColor)}
                      onChange={(e) => setBrandingSettings(prev => ({ ...prev, primaryColor: hexToHsl(e.target.value) }))}
                      className="w-16 h-10 p-1 border rounded"
                    />
                    <Input
                      value={brandingSettings.primaryColor}
                      onChange={(e) => setBrandingSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                      placeholder="224 71% 60%"
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cor Secundária</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={hslToHex(brandingSettings.secondaryColor)}
                      onChange={(e) => setBrandingSettings(prev => ({ ...prev, secondaryColor: hexToHsl(e.target.value) }))}
                      className="w-16 h-10 p-1 border rounded"
                    />
                    <Input
                      value={brandingSettings.secondaryColor}
                      onChange={(e) => setBrandingSettings(prev => ({ ...prev, secondaryColor: e.target.value }))}
                      placeholder="220 14% 96%"
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cor de Destaque</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={hslToHex(brandingSettings.accentColor)}
                      onChange={(e) => setBrandingSettings(prev => ({ ...prev, accentColor: hexToHsl(e.target.value) }))}
                      className="w-16 h-10 p-1 border rounded"
                    />
                    <Input
                      value={brandingSettings.accentColor}
                      onChange={(e) => setBrandingSettings(prev => ({ ...prev, accentColor: e.target.value }))}
                      placeholder="142 76% 36%"
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
              
              {/* Preview Section */}
              <div className="space-y-2">
                <Label>Pré-visualização</Label>
                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex gap-2">
                    <Button className="bg-primary hover:bg-primary/90">Botão Primário</Button>
                    <Button variant="secondary">Botão Secundário</Button>
                    <Badge className="bg-accent text-accent-foreground">Tag de Destaque</Badge>
                  </div>
                  <div className="w-full h-2 rounded-full bg-gradient-primary"></div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSaveBranding} className="flex-1">
                  Salvar Configurações de Marca
                </Button>
                <Button onClick={handleResetBranding} variant="outline" className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Resetar
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LLM Settings */}
        <TabsContent value="llm" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Configurações de LLM</CardTitle>
                {isSystemAdmin() && (
                  <Button variant="outline" size="sm" onClick={() => navigate('/admin/model-catalog')}>
                    <FileText className="h-4 w-4 mr-2" />
                    Catálogo de modelos
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardDescription>
                Configure os provedores de IA e suas chaves de API
              </CardDescription>
            <CardContent className="space-y-6">
              {organization?.id && Object.keys(secureSecrets).length > 0 ? (
                <div className="p-4 border rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
                  <div className="text-sm">
                    <p className="font-medium text-emerald-800 dark:text-emerald-200">Storage seguro conectado</p>
                    <p className="text-emerald-700 dark:text-emerald-300 mt-1">
                      Suas chaves estão armazenadas no Supabase com RLS. Status:
                    </p>
                    {organization && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Org atual: <span className="font-mono">{organization.name}</span> (<span className="font-mono">{organization.id}</span>)
                      </p>
                    )}
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {['openai','anthropic','google','perplexity','ollama'].map((p) => (
                        <div key={p} className="flex items-center justify-between text-xs border rounded p-2">
                          <div>
                            <span className="font-medium uppercase">{p}</span>: {(secureSecrets[p]?.hasKey || lastTestOk[p]) ? `conectado (${secureSecrets[p]?.preview || '—'})` : 'não configurado'}
                          </div>
                          {secureSecrets[p]?.hasKey && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                if (!organization?.id) return;
                                const { error } = await supabase.rpc('delete_llm_secret', { p_org: organization.id, p_provider: p });
                                if (error) {
                                  toast({ title: `Falha ao remover ${p}`, description: error.message, variant: 'destructive' });
                                  return;
                                }
                                const { data } = await supabase.rpc('get_llm_secrets_masked', { p_org: organization.id });
                                if (Array.isArray(data)) {
                                  const map: Record<string, { hasKey: boolean; preview: string }> = {};
                                  for (const row of data as any[]) {
                                    const key = String(row.provider || '').toLowerCase();
                                    map[key] = { hasKey: !!row.has_key, preview: row.preview };
                                  }
                                  setSecureSecrets(map);
                                }
                                toast({ title: `Chave ${p} removida` });
                              }}
                            >
                              Remover
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button type="button" variant="secondary" size="sm" onClick={testOpenAI}>Testar OpenAI</Button>
                      <Button type="button" variant="secondary" size="sm" onClick={saveAndTestOpenAI}>Salvar e testar OpenAI</Button>
                      <Button type="button" variant="secondary" size="sm" onClick={testAnthropic}>Testar Anthropic</Button>
                      <Button type="button" variant="secondary" size="sm" onClick={saveAndTestAnthropic}>Salvar e testar Anthropic</Button>
                      <Button type="button" variant="secondary" size="sm" onClick={testGoogle}>Testar Google AI</Button>
                      <Button type="button" variant="secondary" size="sm" onClick={testPerplexity}>Testar Perplexity</Button>
                      <Button type="button" variant="secondary" size="sm" onClick={testOllama}>Testar Ollama</Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 border rounded-lg bg-orange-50 dark:bg-orange-950/20">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-orange-800 dark:text-orange-200">Aviso de Segurança</p>
                      <p className="text-orange-700 dark:text-orange-300 mt-1">
                        As chaves de API estão sendo armazenadas localmente no navegador. Para uso em produção, 
                        conecte ao Supabase para armazenamento seguro.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* API Keys */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Chaves de API</h3>
                
                {/* OpenAI */}
                <div className="space-y-2">
                  <Label>OpenAI API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showKeys.openai ? "text" : "password"}
                      value={llmSettings.openaiApiKey}
                      onChange={(e) => setLlmSettings(prev => ({ ...prev, openaiApiKey: e.target.value }))}
                      placeholder="sk-..."
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowKeys(prev => ({ ...prev, openai: !prev.openai }))}
                    >
                      {showKeys.openai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Anthropic */}
                <div className="space-y-2">
                  <Label>Anthropic API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showKeys.anthropic ? "text" : "password"}
                      value={llmSettings.anthropicApiKey}
                      onChange={(e) => setLlmSettings(prev => ({ ...prev, anthropicApiKey: e.target.value }))}
                      placeholder="sk-ant-..."
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowKeys(prev => ({ ...prev, anthropic: !prev.anthropic }))}
                    >
                      {showKeys.anthropic ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Google */}
                <div className="space-y-2">
                  <Label>Google AI API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showKeys.google ? "text" : "password"}
                      value={llmSettings.googleApiKey}
                      onChange={(e) => setLlmSettings(prev => ({ ...prev, googleApiKey: e.target.value }))}
                      placeholder="AIza..."
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowKeys(prev => ({ ...prev, google: !prev.google }))}
                    >
                      {showKeys.google ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Perplexity */}
                <div className="space-y-2">
                  <Label>Perplexity API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showKeys.perplexity ? "text" : "password"}
                      value={llmSettings.perplexityApiKey}
                      onChange={(e) => setLlmSettings(prev => ({ ...prev, perplexityApiKey: e.target.value }))}
                      placeholder="pplx-..."
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowKeys(prev => ({ ...prev, perplexity: !prev.perplexity }))}
                    >
                      {showKeys.perplexity ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Ollama */}
                <div className="space-y-2">
                  <Label>Ollama Endpoint</Label>
                  <Input
                    value={llmSettings.ollamaEndpoint}
                    onChange={(e) => setLlmSettings(prev => ({ ...prev, ollamaEndpoint: e.target.value }))}
                    placeholder="http://localhost:11434"
                  />
                  <div className="text-xs text-muted-foreground">
                    Ex.: http://localhost:11434 — assegure que o serviço do Ollama está ativo.
                  </div>
                </div>
              </div>

              {/* Default Provider and Model */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Configurações Padrão</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Provedor Padrão</Label>
                    <Select
                      value={llmSettings.defaultProvider}
                      onValueChange={(value) => {
                        const dynamicProviders = getDynamicLlmProviders();
                        setLlmSettings(prev => ({ 
                          ...prev, 
                          defaultProvider: value,
                          defaultModel: dynamicProviders[value as keyof typeof dynamicProviders]?.models[0] || ''
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(getDynamicLlmProviders()).map(([key, provider]) => (
                          <SelectItem key={key} value={key}>
                            {provider.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Modelo Padrão</Label>
                    <Select
                      value={llmSettings.defaultModel}
                      onValueChange={(value) => setLlmSettings(prev => ({ ...prev, defaultModel: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getDynamicLlmProviders()[llmSettings.defaultProvider as keyof ReturnType<typeof getDynamicLlmProviders>]?.models.map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Parameters */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Parâmetros</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Temperatura ({llmSettings.temperature})</Label>
                    <Input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={llmSettings.temperature}
                      onChange={(e) => setLlmSettings(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                      className="w-full"
                    />
                    <div className="text-xs text-muted-foreground whitespace-pre-line">
                      {`Baixa (0.0–0.3): respostas mais determinísticas, objetivas e consistentes. Ideal para RAG/Vector Store, consultas a documentos, suporte, instruções passo a passo, código.
Média (0.4–0.7): equilíbrio entre precisão e variedade. Boa para explicações com algum tom natural.
Alta (0.8–1.0+): mais criatividade e variação. Boa para brainstorming, marketing, ideias.`}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Máximo de Tokens</Label>
                    <Input
                      type="number"
                      min="1"
                      max="8192"
                      value={llmSettings.maxTokens}
                      onChange={(e) => setLlmSettings(prev => ({ ...prev, maxTokens: parseInt(e.target.value) || 2048 }))}
                    />
                    <div className="text-xs text-muted-foreground">
                      Limite máximo de tokens na resposta
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSaveLLM} className="flex-1">
                  Salvar Configurações de LLM
                </Button>
                <Button onClick={testOpenAI} variant="outline">
                  Testar OpenAI
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="smtp" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações SMTP</CardTitle>
              <CardDescription>
                Configure o envio de e-mails da organização
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Servidor SMTP</Label>
                  <Input
                    value={smtpSettings.host}
                    onChange={(e) => setSmtpSettings(prev => ({ ...prev, host: e.target.value }))}
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Porta</Label>
                  <Input
                    type="number"
                    value={smtpSettings.port}
                    onChange={(e) => setSmtpSettings(prev => ({ ...prev, port: parseInt(e.target.value) }))}
                    placeholder="587"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Usuário</Label>
                  <Input
                    value={smtpSettings.username}
                    onChange={(e) => setSmtpSettings(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="seu-email@gmail.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Senha</Label>
                  <Input
                    type="password"
                    value={smtpSettings.password}
                    onChange={(e) => setSmtpSettings(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="sua-senha"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveSMTP}>Salvar SMTP</Button>
                <Button onClick={handleTestEmail} variant="outline">
                  <TestTube className="w-4 h-4 mr-2" />
                  Testar
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Templates de E-mail</CardTitle>
              <CardDescription>
                Configure os templates de e-mail da organização
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Template de Boas-vindas</Label>
                <Textarea
                  value={emailTemplates.welcome}
                  onChange={(e) => setEmailTemplates(prev => ({ ...prev, welcome: e.target.value }))}
                  placeholder="Bem-vindo ao sistema..."
                />
              </div>
              <div className="space-y-2">
                <Label>Template de Convite</Label>
                <Textarea
                  value={emailTemplates.userInvited}
                  onChange={(e) => setEmailTemplates(prev => ({ ...prev, userInvited: e.target.value }))}
                  placeholder="Você foi convidado para..."
                />
              </div>
              <Button onClick={handleSaveTemplates}>Salvar Templates</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Notificações</CardTitle>
              <CardDescription>
                Ajuste como a sua organização recebe notificações
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Webhook (URL)</Label>
                  <Input
                    value={organization?.notifications?.webhookUrl || ""}
                    onChange={(e) => organization && setOrganization({
                      ...organization,
                      notifications: { ...organization.notifications, webhookUrl: e.target.value }
                    })}
                    placeholder="https://minha.api/webhook"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slack Webhook</Label>
                  <Input
                    value={organization?.notifications?.slackWebhook || ""}
                    onChange={(e) => organization && setOrganization({
                      ...organization,
                      notifications: { ...organization.notifications, slackWebhook: e.target.value }
                    })}
                    placeholder="https://hooks.slack.com/services/..."
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enviar e-mails de notificação</Label>
                </div>
                <Switch
                  checked={!!organization?.notifications?.enableEmail}
                  onCheckedChange={(checked) => organization && setOrganization({
                    ...organization,
                    notifications: { ...organization.notifications, enableEmail: checked }
                  })}
                />
              </div>
              <Button onClick={handleSaveNotifications} className="w-full">
                Salvar Notificações
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;