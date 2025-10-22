import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useApp, Organization } from "@/contexts/AppContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Users, FileText, CreditCard, Upload, Download, Calendar, MapPin, Phone, Mail, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { hasPermission } from "@/lib/permissions";

// Import the mock data for fallback
const mockOrganization = {
  id: '1',
  name: 'Acme Corporation',
  domain: 'acme.com',
  cnpj: '12.345.678/0001-90',
  address: {
    street: 'Rua das Empresas',
    number: '123',
    complement: 'Sala 456',
    neighborhood: 'Centro Empresarial',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01234-567'
  },
  contacts: {
    phone: '(11) 9999-8888',
    email: 'contato@acme.com',
    responsibleName: 'João Silva',
    responsibleRole: 'CEO'
  },
  contract: {
    plan: 'Enterprise',
    startDate: '2024-01-01',
    expirationDate: '2024-12-31',
    monthlyValue: 2500.00,
    status: 'active' as const
  },
  notifications: {
    emailTemplates: {
      welcome: 'Bem-vindo à {{organizationName}}! Sua conta foi criada com sucesso.',
      invitation: 'Você foi convidado para participar da {{organizationName}}. Clique no link para aceitar.',
      passwordReset: 'Solicitação de redefinição de senha para {{organizationName}}.'
    },
    brandColor: '#0ea5e9'
  }
};

// Mapa de rótulos legíveis para funcionalidades (usado em toda a página)
const featureLabels: Record<string, string> = {
  unlimited_agents: 'Agentes Ilimitados',
  api_access: 'Acesso à API',
  priority_support: 'Suporte Prioritário',
  custom_branding: 'Marca Personalizada',
  advanced_analytics: 'Analytics Avançado',
  sso_integration: 'Integração SSO',
  backup_restore: 'Backup e Restauração',
};

const OrganizationPage = () => {
  const { currentUser, organization, setOrganization } = useApp();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Organization>(organization || mockOrganization);
  const [cepLoading, setCepLoading] = useState(false);
  const prevOrgId = useRef<string | null>(organization?.id || null);
  const [orgLoading, setOrgLoading] = useState(false);
  // Documentos (Supabase Storage)
  const [docsLoading, setDocsLoading] = useState(false);
  const [docs, setDocs] = useState<Array<{ name: string; updated_at?: string; created_at?: string; last_accessed_at?: string; size?: number }>>([]);
  const [uploading, setUploading] = useState(false);
  const [filesToUpload, setFilesToUpload] = useState<FileList | null>(null);

  const BUCKET = 'org-documents';
  const documentsPrefix = organization?.id ? `orgs/${organization.id}/documents` : '';

  const loadDocuments = async () => {
    if (!organization?.id) return;
    try {
      setDocsLoading(true);
      const { data, error } = await supabase.storage.from(BUCKET).list(documentsPrefix, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error) throw error;
      setDocs((data || []).map((d: any) => ({
        name: d.name,
        updated_at: d.updated_at,
        created_at: d.created_at,
        last_accessed_at: d.last_accessed_at,
        size: d.metadata?.size,
      })));
    } catch (e: any) {
      setDocs([]);
      console.error('loadDocuments error', e?.message || e);
    } finally {
      setDocsLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!filesToUpload || !organization?.id) return;
    try {
      setUploading(true);
      for (const file of Array.from(filesToUpload)) {
        const path = `${documentsPrefix}/${file.name}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type || 'application/octet-stream' });
        if (error) throw error;
      }
      setFilesToUpload(null);
      await loadDocuments();
    } catch (e: any) {
      console.error('upload error', e?.message || e);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (name: string) => {
    if (!organization?.id) return;
    const path = `${documentsPrefix}/${name}`;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
    if (error) {
      console.error('download url error', error.message);
      return;
    }
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  };

  const handleDelete = async (name: string) => {
    if (!organization?.id) return;
    if (!confirm(`Excluir o documento "${name}"?`)) return;
    const path = `${documentsPrefix}/${name}`;
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) {
      console.error('delete error', error.message);
      return;
    }
    await loadDocuments();
  };

  // Reage a atualizações da organização no AppContext (ex.: salvas no SystemAdminPage)
  useEffect(() => {
    const syncOrg = async () => {
      if (!organization?.id || organization.id === prevOrgId.current) return;
      prevOrgId.current = organization.id;
      setOrgLoading(true);
      try {
        const { data, error } = await supabase
          .from('organizations')
          .select('id, name, domain, contacts, address, contract, branding')
          .eq('id', organization.id)
          .single();
        if (error) throw error;
        const full: Organization = {
          ...(organization as any),
          name: data?.name || organization.name,
          domain: data?.domain || organization.domain,
          address: data?.address || (organization as any).address || {},
          contacts: data?.contacts || (organization as any).contacts || {},
          contract: data?.contract || (organization as any).contract || { plan: '', startDate: '', expirationDate: '', monthlyValue: 0, status: '' as any },
          branding: data?.branding || (organization as any).branding || {},
        } as Organization;
        setFormData(full);
        toast({ title: 'Dados da organização atualizados', description: 'As informações foram sincronizadas.' });
      } catch (e: any) {
        toast({ title: 'Falha ao carregar organização', description: e?.message || 'Tente novamente.', variant: 'destructive' });
        // fallback: ainda assim atualiza com o objeto do contexto
        setFormData(organization as Organization);
      } finally {
        setOrgLoading(false);
      }
    };
    syncOrg();
  }, [organization?.id]);

  // Carrega documentos quando a org mudar
  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  // Auto-preenchimento por CEP (ViaCEP)
  useEffect(() => {
    if (!isEditing) return;
    const cep = (formData.address?.zipCode || '').trim();
    const isCepValid = /^\d{5}-\d{3}$/.test(cep);
    if (!isCepValid) return;

    const timer = setTimeout(async () => {
      try {
        const base = import.meta.env.VITE_CEP_PROVIDER_URL || 'https://viacep.com.br/ws';
        const url = `${base.replace(/\/$/, '')}/${cep}/json/`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`CEP lookup failed: ${res.status}`);
        const data = await res.json();
        if (data?.erro) {
          toast({ title: 'CEP não encontrado', description: 'Verifique o CEP informado.', variant: 'destructive' });
          return;
        }
        // Mapeia campos do ViaCEP
        const next = {
          street: data?.logradouro || formData.address?.street || '',
          neighborhood: data?.bairro || formData.address?.neighborhood || '',
          city: data?.localidade || formData.address?.city || '',
          state: (data?.uf || formData.address?.state || '').toUpperCase(),
        };

        setFormData(prev => ({
          ...prev,
          address: {
            ...prev.address,
            street: next.street,
            neighborhood: next.neighborhood,
            city: next.city,
            state: next.state,
          }
        }));
      } catch (e: any) {
        // Falha silenciosa, sem bloquear o usuário
        toast({ title: 'Falha ao buscar CEP', description: e?.message || 'Serviço indisponível no momento.', variant: 'destructive' });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [isEditing, formData.address?.zipCode]);

  // Busca explícita via botão
  const handleFetchCep = async () => {
    const cep = (formData.address?.zipCode || '').trim();
    if (!/^\d{5}-\d{3}$/.test(cep)) {
      toast({ title: 'CEP inválido', description: 'Informe no formato 00000-000.', variant: 'destructive' });
      return;
    }
    try {
      setCepLoading(true);
      const base = import.meta.env.VITE_CEP_PROVIDER_URL || 'https://viacep.com.br/ws';
      const url = `${String(base).replace(/\/$/, '')}/${cep}/json/`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`CEP lookup failed: ${res.status}`);
      const data = await res.json();
      if (data?.erro) {
        toast({ title: 'CEP não encontrado', description: 'Verifique o CEP informado.', variant: 'destructive' });
        return;
      }
      setFormData(prev => ({
        ...prev,
        address: {
          ...prev.address,
          street: data?.logradouro || prev.address?.street || '',
          neighborhood: data?.bairro || prev.address?.neighborhood || '',
          city: data?.localidade || prev.address?.city || '',
          state: (data?.uf || prev.address?.state || '').toUpperCase(),
        }
      }));
      toast({ title: 'CEP encontrado', description: 'Endereço atualizado a partir do CEP.' });
    } catch (e: any) {
      toast({ title: 'Falha ao buscar CEP', description: e?.message || 'Serviço indisponível no momento.', variant: 'destructive' });
    } finally {
      setCepLoading(false);
    }
  };

  if (!currentUser || !hasPermission(currentUser.role, "Gerenciar módulos e configurações da organização")) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Acesso Negado</h3>
          <p className="text-muted-foreground">Você não tem permissão para gerenciar a organização.</p>
        </div>
      </div>
    );
  }

  // Utilidades: máscara e validação
  const maskCEP = (v: string) => {
    const digits = (v || "").replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  };
  const normalizeUF = (v: string) => (v || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
  const isValidCEP = (v: string) => /^\d{5}-\d{3}$/.test(v || "");
  const isValidUF = (v: string) => /^[A-Z]{2}$/.test(v || "");
  const isUuid = (v?: string | null) => !!(v && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v));
  // Helpers de cor
  const isValidHexColor = (v: string) => /^#([0-9a-fA-F]{6})$/.test((v || '').trim());
  const rgbToHex = (r: number, g: number, b: number) => '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  const hslToHex = (h: number, s: number, l: number) => {
    s /= 100; l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return rgbToHex(Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4)));
  };
  const normalizeColorToHex = (v?: string | null): string | null => {
    const val = (v || '').trim();
    if (!val) return null;
    if (isValidHexColor(val)) return val.toUpperCase();
    const mRgb = val.match(/^rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
    if (mRgb) {
      const [r, g, b] = [parseInt(mRgb[1]), parseInt(mRgb[2]), parseInt(mRgb[3])];
      if ([r,g,b].every(n => n>=0 && n<=255)) return rgbToHex(r,g,b).toUpperCase();
    }
    const mHsl = val.match(/^hsl\s*\(\s*(\d+(?:\.\d+)?)\s*[ ,]\s*(\d+(?:\.\d+)?)%\s*[ ,]\s*(\d+(?:\.\d+)?)%\s*\)$/i)
              || val.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
    if (mHsl) {
      const h = parseFloat(mHsl[1]);
      const s = parseFloat(mHsl[2]);
      const l = parseFloat(mHsl[3]);
      if (!isNaN(h) && !isNaN(s) && !isNaN(l)) return hslToHex(h, s, l).toUpperCase();
    }
    return null;
  };

  const handleSave = async () => {
    try {
      if (!organization?.id || !isUuid(organization.id)) {
        toast({ title: 'Organização inválida', description: 'ID da organização ausente ou inválido. Não foi possível salvar.', variant: 'destructive' });
        return;
      }
      // Validações simples de endereço
      const cep = formData.address?.zipCode || "";
      const uf = formData.address?.state || "";
      if (cep && !isValidCEP(cep)) {
        toast({ title: "CEP inválido", description: "Informe no formato 00000-000.", variant: "destructive" });
        return;
      }
      if (uf && !isValidUF(uf)) {
        toast({ title: "UF inválida", description: "Informe a sigla com 2 letras (ex.: SP).", variant: "destructive" });
        return;
      }

      // Normaliza e valida cores do branding (se existirem)
      const cPrimary = normalizeColorToHex(formData.branding?.colors?.primary || undefined);
      const cSecondary = normalizeColorToHex(formData.branding?.colors?.secondary || undefined);
      const cAccent = normalizeColorToHex(formData.branding?.colors?.accent || undefined);
      if (formData.branding?.colors?.primary && !cPrimary) { toast({ title: 'Cor primária inválida', description: 'Use #RRGGBB, rgb(), ou hsl().', variant: 'destructive' }); return; }
      if (formData.branding?.colors?.secondary && !cSecondary) { toast({ title: 'Cor secundária inválida', description: 'Use #RRGGBB, rgb(), ou hsl().', variant: 'destructive' }); return; }
      if (formData.branding?.colors?.accent && !cAccent) { toast({ title: 'Cor de acento inválida', description: 'Use #RRGGBB, rgb(), ou hsl().', variant: 'destructive' }); return; }

      // Persiste no Supabase
      const payload: any = {
        name: formData.name,
        domain: formData.domain,
        cnpj: (formData as any).cnpj || null,
        address: formData.address ? {
          street: formData.address.street || null,
          number: formData.address.number || null,
          complement: formData.address.complement || null,
          neighborhood: formData.address.neighborhood || null,
          city: formData.address.city || null,
          state: formData.address.state || null,
          zipCode: formData.address.zipCode || null,
        } : null,
        contacts: formData.contacts ? {
          phone: formData.contacts.phone || null,
          email: formData.contacts.email || null,
          responsibleName: formData.contacts.responsibleName || null,
          responsibleRole: formData.contacts.responsibleRole || null,
        } : null,
        contract: formData.contract ? {
          plan: formData.contract.plan,
          startDate: formData.contract.startDate,
          expirationDate: formData.contract.expirationDate,
          monthlyValue: Number(formData.contract.monthlyValue) || 0,
          status: formData.contract.status,
        } : null,
        branding: formData.branding ? {
          logo: formData.branding.logo || null,
          colors: {
            primary: cPrimary,
            secondary: cSecondary,
            accent: cAccent,
          }
        } : null,
      };

      if (!organization?.id) {
        toast({ title: "Organização não encontrada", description: "ID da organização ausente.", variant: "destructive" });
        return;
      }

      const { error } = await supabase
        .from("organizations")
        .update(payload)
        .eq("id", organization.id);
      if (error) {
        toast({ title: "Falha ao salvar", description: error.message, variant: "destructive" });
        return;
      }

      setOrganization(formData);
      setIsEditing(false);
      toast({
        title: "Organização atualizada!",
        description: "As informações da organização foram salvas com sucesso.",
      });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e?.message || "Tente novamente", variant: "destructive" });
    }
  };

  const getContractStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success text-success-foreground';
      case 'suspended': return 'bg-warning text-warning-foreground';
      case 'expired': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getContractStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'suspended': return 'Suspenso';
      case 'expired': return 'Expirado';
      default: return status;
    }
  };

  // Calcula duração do contrato em meses a partir de startDate e expirationDate
  const getContractMonths = () => {
    try {
      const s = organization.contract.startDate;
      const e = organization.contract.expirationDate;
      if (!s || !e) return '-';
      const d1 = new Date(s);
      const d2 = new Date(e);
      const months = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
      return months > 0 ? months : '-';
    } catch {
      return '-';
    }
  };

  if (!organization) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Organização não encontrada</h3>
          <p className="text-muted-foreground">Nenhuma organização foi configurada.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Organização</h1>
          <p className="text-muted-foreground">
            Gerencie as informações da sua organização, contrato e documentos
          </p>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} className="bg-gradient-primary">
                Salvar Alterações
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)} className="bg-gradient-primary">
              Editar Informações
            </Button>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status do Contrato</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge className={getContractStatusColor(organization.contract.status)}>
              {getContractStatusLabel(organization.contract.status)}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Plano Atual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{organization.contract.plan}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencimento</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {new Date(organization.contract.expirationDate).toLocaleDateString('pt-BR')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              R$ {organization.contract.monthlyValue.toLocaleString('pt-BR')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Duração (meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getContractMonths()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Início</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {organization.contract.startDate ? new Date(organization.contract.startDate).toLocaleDateString('pt-BR') : '-'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general">Geral</TabsTrigger>
          <TabsTrigger value="address">Endereço</TabsTrigger>
          <TabsTrigger value="contacts">Contatos</TabsTrigger>
          <TabsTrigger value="contract">Contrato</TabsTrigger>
          <TabsTrigger value="documents">Documentos</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Informações Gerais
              </CardTitle>
              <CardDescription>
                Dados básicos da organização
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="name">Nome da Empresa</Label>
                  <Input
                    id="name"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    value={formData.cnpj || ''}
                    onChange={(e) => setFormData({...formData, cnpj: e.target.value})}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="domain">Domínio</Label>
                  <Input
                    id="domain"
                    value={formData.domain || ''}
                    onChange={(e) => setFormData({...formData, domain: e.target.value})}
                    disabled={!isEditing}
                  />
                </div>
              </div>

              {/* Branding: cores */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label>Branding (cores)</Label>
                    <div className="flex items-center gap-1">
                      {(['primary','secondary','accent'] as const).map((k) => {
                        const c = formData.branding?.colors?.[k];
                        const hex = normalizeColorToHex(c || undefined);
                        if (!hex) return null;
                        return <span key={k} className="inline-block h-3 w-3 rounded-full border" title={`${k}: ${hex}`} style={{ background: hex }} />
                      })}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData({
                      ...formData,
                      branding: {
                        ...formData.branding,
                        colors: {
                          primary: '#0B1220',
                          secondary: '#F8FAFC',
                          accent: '#E2E8F0',
                        }
                      }
                    })}
                    disabled={!isEditing}
                  >
                    Restaurar Padrão
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="brand-primary">Cor Primária</Label>
                    <div className="flex items-center gap-2">
                      <input
                        id="brand-primary"
                        type="color"
                        aria-label="Cor Primária"
                        value={normalizeColorToHex(formData.branding?.colors?.primary || undefined) || '#000000'}
                        onChange={(e) => setFormData({
                          ...formData,
                          branding: { ...formData.branding, colors: { ...formData.branding?.colors, primary: e.target.value } }
                        })}
                        disabled={!isEditing}
                        className="h-10 w-10 p-0 border rounded"
                      />
                      <Input
                        value={formData.branding?.colors?.primary || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          branding: { ...formData.branding, colors: { ...formData.branding?.colors, primary: e.target.value } }
                        })}
                        disabled={!isEditing}
                        placeholder="#000000"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="brand-secondary">Cor Secundária</Label>
                    <div className="flex items-center gap-2">
                      <input
                        id="brand-secondary"
                        type="color"
                        aria-label="Cor Secundária"
                        value={normalizeColorToHex(formData.branding?.colors?.secondary || undefined) || '#111111'}
                        onChange={(e) => setFormData({
                          ...formData,
                          branding: { ...formData.branding, colors: { ...formData.branding?.colors, secondary: e.target.value } }
                        })}
                        disabled={!isEditing}
                        className="h-10 w-10 p-0 border rounded"
                      />
                      <Input
                        value={formData.branding?.colors?.secondary || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          branding: { ...formData.branding, colors: { ...formData.branding?.colors, secondary: e.target.value } }
                        })}
                        disabled={!isEditing}
                        placeholder="#111111"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="brand-accent">Cor de Acento</Label>
                    <div className="flex items-center gap-2">
                      <input
                        id="brand-accent"
                        type="color"
                        aria-label="Cor de Acento"
                        value={normalizeColorToHex(formData.branding?.colors?.accent || undefined) || '#222222'}
                        onChange={(e) => setFormData({
                          ...formData,
                          branding: { ...formData.branding, colors: { ...formData.branding?.colors, accent: e.target.value } }
                        })}
                        disabled={!isEditing}
                        className="h-10 w-10 p-0 border rounded"
                      />
                      <Input
                        value={formData.branding?.colors?.accent || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          branding: { ...formData.branding, colors: { ...formData.branding?.colors, accent: e.target.value } }
                        })}
                        disabled={!isEditing}
                        placeholder="#222222"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="address">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Endereço
              </CardTitle>
              <CardDescription>
                Endereço da sede da empresa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* CEP primeiro */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-1">
                  <Label htmlFor="zipCode">CEP</Label>
                  <div className="flex gap-2">
                    <Input
                      id="zipCode"
                      value={formData.address?.zipCode || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        address: { ...formData.address, zipCode: maskCEP(e.target.value) }
                      })}
                      disabled={!isEditing}
                    />
                    <Button type="button" variant="outline" onClick={handleFetchCep} disabled={!isEditing || cepLoading || !/^\d{5}-\d{3}$/.test(formData.address?.zipCode || '')}>
                      {cepLoading ? 'Buscando...' : 'Buscar CEP'}
                    </Button>
                  </div>
                </div>
                <div className="md:col-span-2" />
              </div>

              {/* Rua e Número */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <Label htmlFor="street">Rua</Label>
                  <Input
                    id="street"
                    value={formData.address?.street || ''}
                    onChange={(e) => setFormData({
                      ...formData, 
                      address: {...formData.address, street: e.target.value}
                    })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="number">Número</Label>
                  <Input
                    id="number"
                    value={formData.address?.number || ''}
                    onChange={(e) => setFormData({
                      ...formData, 
                      address: {...formData.address, number: e.target.value}
                    })}
                    disabled={!isEditing}
                  />
                </div>
              </div>

              {/* Complemento e Bairro */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="complement">Complemento</Label>
                  <Input
                    id="complement"
                    value={formData.address?.complement || ''}
                    onChange={(e) => setFormData({
                      ...formData, 
                      address: {...formData.address, complement: e.target.value}
                    })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="neighborhood">Bairro</Label>
                  <Input
                    id="neighborhood"
                    value={formData.address?.neighborhood || ''}
                    onChange={(e) => setFormData({
                      ...formData, 
                      address: {...formData.address, neighborhood: e.target.value}
                    })}
                    disabled={!isEditing}
                  />
                </div>
              </div>

              {/* Cidade e Estado */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={formData.address?.city || ''}
                    onChange={(e) => setFormData({
                      ...formData, 
                      address: {...formData.address, city: e.target.value}
                    })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="state">Estado</Label>
                  <Input
                    id="state"
                    value={formData.address?.state || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      address: { ...formData.address, state: normalizeUF(e.target.value) }
                    })}
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Contatos
              </CardTitle>
              <CardDescription>
                Informações de contato da organização
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.contacts?.phone || ''}
                    onChange={(e) => setFormData({
                      ...formData, 
                      contacts: {...formData.contacts, phone: e.target.value}
                    })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.contacts?.email || ''}
                    onChange={(e) => setFormData({
                      ...formData, 
                      contacts: {...formData.contacts, email: e.target.value}
                    })}
                    disabled={!isEditing}
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="responsibleName">Nome do Responsável</Label>
                  <Input
                    id="responsibleName"
                    value={formData.contacts?.responsibleName || ''}
                    onChange={(e) => setFormData({
                      ...formData, 
                      contacts: {...formData.contacts, responsibleName: e.target.value}
                    })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="responsibleRole">Cargo do Responsável</Label>
                  <Input
                    id="responsibleRole"
                    value={formData.contacts?.responsibleRole || ''}
                    onChange={(e) => setFormData({
                      ...formData, 
                      contacts: {...formData.contacts, responsibleRole: e.target.value}
                    })}
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contract">
          {/* Funcionalidades do Contrato */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Funcionalidades Ativas</CardTitle>
              <CardDescription>Recursos inclusos no plano atual</CardDescription>
            </CardHeader>
            <CardContent>
              {Array.isArray((organization as any)?.contract?.features) && (organization as any).contract.features.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {((organization as any).contract.features as string[]).map((f) => (
                    <Badge key={f} variant="secondary">{featureLabels[f] || f}</Badge>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Nenhuma funcionalidade específica registrada.</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Informações do Contrato
              </CardTitle>
              <CardDescription>
                Dados do contrato e plano atual
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="plan">Plano</Label>
                  <Select
                    value={formData.contract?.plan || ''}
                    onValueChange={(value) => setFormData({
                      ...formData, 
                      contract: {...formData.contract, plan: value}
                    })}
                    disabled={!isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Basic">Básico</SelectItem>
                      <SelectItem value="Professional">Profissional</SelectItem>
                      <SelectItem value="Enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="monthlyValue">Valor Mensal (R$)</Label>
                  <Input
                    id="monthlyValue"
                    type="number"
                    value={formData.contract?.monthlyValue || ''}
                    onChange={(e) => setFormData({
                      ...formData, 
                      contract: {...formData.contract, monthlyValue: parseFloat(e.target.value)}
                    })}
                    disabled={!isEditing}
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="startDate">Data de Início</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.contract?.startDate || ''}
                    onChange={(e) => setFormData({
                      ...formData, 
                      contract: {...formData.contract, startDate: e.target.value}
                    })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="expirationDate">Data de Vencimento</Label>
                  <Input
                    id="expirationDate"
                    type="date"
                    value={formData.contract?.expirationDate || ''}
                    onChange={(e) => setFormData({
                      ...formData, 
                      contract: {...formData.contract, expirationDate: e.target.value}
                    })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.contract?.status || ''}
                    onValueChange={(value) => setFormData({
                      ...formData, 
                      contract: {...formData.contract, status: value as 'active' | 'suspended' | 'expired'}
                    })}
                    disabled={!isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="suspended">Suspenso</SelectItem>
                      <SelectItem value="expired">Expirado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Documentos e Arquivos
              </CardTitle>
              <CardDescription>
                Gerencie os documentos relacionados ao contrato e à empresa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-base font-semibold mb-2">Upload de Documentos</h3>
                <div className="flex items-center justify-center gap-3">
                  <input
                    type="file"
                    multiple
                    onChange={(e) => setFilesToUpload(e.target.files)}
                    className="block text-sm"
                    disabled={uploading}
                  />
                  <Button variant="default" onClick={handleUpload} disabled={uploading || !filesToUpload}>
                    {uploading ? 'Enviando...' : (<><Upload className="w-4 h-4 mr-2" />Enviar</>)}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Documentos Existentes</Label>
                {docsLoading ? (
                  <div className="text-sm text-muted-foreground">Carregando documentos...</div>
                ) : docs.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Nenhum documento enviado.</div>
                ) : (
                  <div className="space-y-2">
                    {docs.map((d) => (
                      <div key={d.name} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{d.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {d.size ? `${(d.size/1024).toFixed(1)} KB` : ''}
                              {d.updated_at ? ` • Atualizado em ${new Date(d.updated_at).toLocaleString('pt-BR')}` : ''}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleDownload(d.name)}>
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDelete(d.name)}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OrganizationPage;