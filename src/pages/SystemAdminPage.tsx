import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, Plus, Edit, Trash2, Users, Calendar, 
  DollarSign, FileText, Mail, Phone, MapPin, Shield, ChevronDown, ChevronRight, Info 
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { usePermissions } from '@/hooks/use-permissions';
import { useApp } from '@/contexts/AppContext';

interface Organization {
  id: string;
  name: string;
  domain: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  status: 'active' | 'suspended' | 'trial';
  planType: 'basic' | 'professional' | 'enterprise';
  userLimit: number;
  currentUsers: number;
  contractStart: Date;
  contractEnd: Date;
  monthlyFee: number;
  features: string[];
  createdAt: Date;
  branding?: {
    logo?: string;
    colors?: {
      primary?: string;
      secondary?: string;
      accent?: string;
    };
  };
  deletedAt?: Date | null;
};

const initialOrganizations: Organization[] = [];

const planTypes = [
  { value: 'basic', label: 'Básico', userLimit: 25, monthlyFee: 2500 },
  { value: 'professional', label: 'Profissional', userLimit: 100, monthlyFee: 7500 },
  { value: 'enterprise', label: 'Enterprise', userLimit: 500, monthlyFee: 15000 }
];

type DbPlan = { id: string; code: string; label: string; user_limit: number; monthly_fee: number; active: boolean; created_at: string };

const availableFeatures = [
  { id: 'unlimited_agents', label: 'Agentes Ilimitados' },
  { id: 'api_access', label: 'Acesso à API' },
  { id: 'priority_support', label: 'Suporte Prioritário' },
  { id: 'custom_branding', label: 'Marca Personalizada' },
  { id: 'advanced_analytics', label: 'Analytics Avançado' },
  { id: 'sso_integration', label: 'Integração SSO' },
  { id: 'backup_restore', label: 'Backup e Restauração' }
];

export default function SystemAdminPage() {
  const [organizations, setOrganizations] = useState(initialOrganizations);
  const [invitesByOrg, setInvitesByOrg] = useState<Record<string, { id: string; email: string; role: string }[]>>({});
  const [newInviteEmail, setNewInviteEmail] = useState<Record<string, string>>({});
  const [newOrg, setNewOrg] = useState({
    name: '',
    domain: '',
    contactEmail: '',
    contactPhone: '',
    // Endereço estruturado
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    zipCode: '',
    planType: 'basic' as const,
    userLimit: 25,
    contractMonths: 12,
    contractStatus: 'trial' as 'trial'|'active'|'suspended'|'expired',
    startDate: '',
    expirationDate: '',
    features: [] as string[],
    adminEmails: ''
  });

  const { isSystemAdmin } = usePermissions();
  const { currentUser, requestLogin, supportMode, enterSupportOrg, exitSupportMode, organization, setOrganization } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [newOrgOpen, setNewOrgOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  // Gestão de Planos (DB)
  const [plans, setPlans] = useState<DbPlan[]>([]);
  const [plansOpen, setPlansOpen] = useState(false);
  const [planSaving, setPlanSaving] = useState(false);
  const [newPlan, setNewPlan] = useState({ code: '', label: '', user_limit: 0, monthly_fee: 0, active: true });
  const [editingPlan, setEditingPlan] = useState<DbPlan | null>(null);
  // Helpers: máscara/validação CEP e UF
  const maskCEP = (v: string) => {
    const digits = (v || '').replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  };
  const normalizeUF = (v: string) => (v || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
  const [cepLoadingNew, setCepLoadingNew] = useState(false);
  const [cepLoadingEdit, setCepLoadingEdit] = useState(false);

  // Helpers de cor
  const isValidHexColor = (v: string) => /^#([0-9a-fA-F]{6})$/.test((v || '').trim());
  const parseTailwindHslToCss = (v: string) => {
    // Ex.: "222.2 84% 4.9%" -> "hsl(222.2 84% 4.9%)" (CSS OK)
    const s = (v || '').trim();
    if (/^\d+(\.\d+)?\s+\d+%\s+\d+%$/.test(s)) return `hsl(${s})`;
    return null;
  };
  const rgbToHex = (r: number, g: number, b: number) =>
    '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  const hslToHex = (h: number, s: number, l: number) => {
    // h[0-360], s/l [0-100]
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
    // rgb(255, 255, 255)
    const mRgb = val.match(/^rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
    if (mRgb) {
      const [r, g, b] = [parseInt(mRgb[1]), parseInt(mRgb[2]), parseInt(mRgb[3])];
      if ([r,g,b].every(n => n>=0 && n<=255)) return rgbToHex(r,g,b).toUpperCase();
    }
    // hsl(222.2 84% 4.9%) ou hsl(222, 84%, 50%)
    const mHsl = val.match(/^hsl\s*\(\s*(\d+(?:\.\d+)?)\s*[ ,]\s*(\d+(?:\.\d+)?)%\s*[ ,]\s*(\d+(?:\.\d+)?)%\s*\)$/i)
              || val.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/); // tailwind-like
    if (mHsl) {
      const h = parseFloat(mHsl[1]);
      const s = parseFloat(mHsl[2]);
      const l = parseFloat(mHsl[3]);
      if (!isNaN(h) && !isNaN(s) && !isNaN(l)) return hslToHex(h, s, l).toUpperCase();
    }
    return null; // inválida
  };

  // Estados para CRUD
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [editData, setEditData] = useState({
    name: '',
    domain: '',
    contactEmail: '',
    contactPhone: '',
    // endereço estruturado
    street: '',
    number: '',
    city: '',
    state: '',
    zipCode: '',
    planType: 'basic',
    monthlyValue: 0,
    contractMonths: 12,
    startDate: '',
    expirationDate: '',
    contractStatus: 'trial',
    features: [] as string[],
    adminEmails: '',
    brandingLogo: '',
    brandingPrimary: '',
    brandingSecondary: '',
    brandingAccent: '',
  });
  const [detailsOrg, setDetailsOrg] = useState<Organization | null>(null);
  const [deletingOrg, setDeletingOrg] = useState<Organization | null>(null); // usado por algum fluxo legado
  const [hardDeletingOrg, setHardDeletingOrg] = useState<Organization | null>(null); // novo: hard delete
  const [domainsByOrg, setDomainsByOrg] = useState<Record<string, { id: string; domain: string }[]>>({});
  const [newDomainByOrg, setNewDomainByOrg] = useState<Record<string, string>>({});
  // System owners
  const [systemOwners, setSystemOwners] = useState<{ email: string; created_at: string }[]>([]);
  const [newOwnerEmail, setNewOwnerEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState('');
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const contactEmailRef = useRef<HTMLInputElement | null>(null);
  // status visual dos convites enviados por e-mail (em memória, por orgId->email)
  const [invitesStatusByOrg, setInvitesStatusByOrg] = useState<Record<string, Record<string, 'sent'|'failed'>>>({});
  // controle de expansão/colapso por organização
  const [expandedOrgs, setExpandedOrgs] = useState<Record<string, boolean>>({});
  // Carrega estado salvo ao montar
  useEffect(() => {
    try {
      const raw = localStorage.getItem('system_admin_expanded_orgs');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') setExpandedOrgs(parsed);
      }
    } catch {}
  }, []);
  const toggleOrg = (id: string) => setExpandedOrgs(prev => {
    const next = { ...prev, [id]: !prev[id] };
    try { localStorage.setItem('system_admin_expanded_orgs', JSON.stringify(next)); } catch {}
    return next;
  });

  // Carrega Planos do DB
  useEffect(() => {
    const loadPlans = async () => {
      try {
        const { data, error } = await supabase
          .from('plans')
          .select('id, code, label, user_limit, monthly_fee, active, created_at')
          .order('created_at', { ascending: false });
        if (error) throw error;
        setPlans(data || []);
      } catch (e) {
        // silencioso: usa fallback planTypes
      }
    };
    loadPlans();
  }, []);

  const refreshPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('id, code, label, user_limit, monthly_fee, active, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPlans(data || []);
    } catch {}
  };

  const createPlan = async () => {
    if (!newPlan.code.trim() || !newPlan.label.trim()) return;
    try {
      setPlanSaving(true);
      const payload = {
        code: newPlan.code.trim().toLowerCase(),
        label: newPlan.label.trim(),
        user_limit: Number(newPlan.user_limit) || 0,
        monthly_fee: Number(newPlan.monthly_fee) || 0,
        active: !!newPlan.active,
      };
      const { error } = await supabase.from('plans').insert(payload);
      if (error) throw error;
      setNewPlan({ code: '', label: '', user_limit: 0, monthly_fee: 0, active: true });
      await refreshPlans();
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao criar plano');
    } finally {
      setPlanSaving(false);
    }
  };

  const updatePlan = async () => {
    if (!editingPlan) return;
    try {
      setPlanSaving(true);
      const payload = {
        code: newPlan.code.trim().toLowerCase(),
        label: newPlan.label.trim(),
        user_limit: Number(newPlan.user_limit) || 0,
        monthly_fee: Number(newPlan.monthly_fee) || 0,
        active: !!newPlan.active,
      } as Partial<DbPlan>;
      const { error } = await supabase
        .from('plans')
        .update(payload)
        .eq('id', editingPlan.id);
      if (error) throw error;
      await refreshPlans();
      setEditingPlan(null);
      setNewPlan({ code: '', label: '', user_limit: 0, monthly_fee: 0, active: true });
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao atualizar plano');
    } finally {
      setPlanSaving(false);
    }
  };

  const removePlan = async (id: string) => {
    if (!confirm('Excluir este plano?')) return;
    try {
      const { error } = await supabase.from('plans').delete().eq('id', id);
      if (error) throw error;
      await refreshPlans();
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao excluir plano');
    }
  };

  const togglePlanActive = async (id: string, active: boolean) => {
    try {
      const { error } = await supabase.from('plans').update({ active: !active }).eq('id', id);
      if (error) throw error;
      await refreshPlans();
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao atualizar plano');
    }
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    organizations.forEach(o => { all[o.id] = true; });
    setExpandedOrgs(all);
    try { localStorage.setItem('system_admin_expanded_orgs', JSON.stringify(all)); } catch {}
  };

  const collapseAll = () => {
    const none: Record<string, boolean> = {};
    organizations.forEach(o => { none[o.id] = false; });
    setExpandedOrgs(none);
    try { localStorage.setItem('system_admin_expanded_orgs', JSON.stringify(none)); } catch {}
  };

  // Abre automaticamente o modal de Nova Organização via query param ?new=1
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      if (params.get('new') === '1') {
        setNewOrgOpen(true);
        // Limpa o parâmetro para evitar reabertura em navegações
        navigate('/system-admin', { replace: true });
      }
    } catch {}
  }, [location.search, navigate]);

  // Focus e scroll ao abrir o modal: nome (prioridade) ou e-mail de contato caso nome já esteja preenchido
  useEffect(() => {
    if (newOrgOpen) {
      setTimeout(() => {
        const target = (!newOrg.name ? nameInputRef.current : contactEmailRef.current) || nameInputRef.current;
        target?.focus();
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
  }, [newOrgOpen]);

  // Auto-preenchimento por CEP (ViaCEP) no modal Nova Organização
  useEffect(() => {
    if (!newOrgOpen) return;
    const cep = (newOrg.zipCode || '').trim();
    const isCepValid = /^\d{5}-\d{3}$/.test(cep);
    if (!isCepValid) return;
    const timer = setTimeout(async () => {
      try {
        const base = (import.meta as any).env?.VITE_CEP_PROVIDER_URL || 'https://viacep.com.br/ws';
        const url = `${String(base).replace(/\/$/, '')}/${cep}/json/`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`CEP lookup failed: ${res.status}`);
        const data = await res.json();
        if (data?.erro) {
          toast.error('CEP não encontrado. Verifique o valor informado.');
          return;
        }
        setNewOrg(prev => ({
          ...prev,
          street: data?.logradouro || prev.street,
          neighborhood: data?.bairro || prev.neighborhood,
          city: data?.localidade || prev.city,
          state: (data?.uf || prev.state || '').toUpperCase(),
        }));
      } catch (e: any) {
        toast.error(e?.message || 'Falha ao buscar CEP. Tente novamente.');
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [newOrgOpen, newOrg.zipCode]);

  // Auto-preenchimento por CEP (ViaCEP) no modal Editar Organização
  useEffect(() => {
    if (!editingOrg) return;
    const cep = (editData.zipCode || '').trim();
    if (!/^\d{5}-\d{3}$/.test(cep)) return;
    const timer = setTimeout(async () => {
      try {
        const base = (import.meta as any).env?.VITE_CEP_PROVIDER_URL || 'https://viacep.com.br/ws';
        const url = `${String(base).replace(/\/$/, '')}/${cep}/json/`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`CEP lookup failed: ${res.status}`);
        const data = await res.json();
        if (data?.erro) return;
        setEditData(prev => ({
          ...prev,
          street: data?.logradouro || prev.street,
          neighborhood: data?.bairro || (prev as any).neighborhood || '',
          city: data?.localidade || prev.city,
          state: (data?.uf || prev.state || '').toUpperCase(),
        }));
      } catch (e) {
        // silencioso no debounce
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [editingOrg, editData.zipCode]);

  // Busca explícita via botão no modal Editar Organização
  const handleFetchCepEdit = async () => {
    const cep = (editData.zipCode || '').trim();
    if (!/^\d{5}-\d{3}$/.test(cep)) {
      toast.error('CEP inválido. Use o formato 00000-000.');
      return;
    }
    try {
      setCepLoadingEdit(true);
      const base = (import.meta as any).env?.VITE_CEP_PROVIDER_URL || 'https://viacep.com.br/ws';
      const url = `${String(base).replace(/\/$/, '')}/${cep}/json/`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`CEP lookup failed: ${res.status}`);
      const data = await res.json();
      if (data?.erro) {
        toast.error('CEP não encontrado. Verifique o valor informado.');
        return;
      }
      setEditData(prev => ({
        ...prev,
        street: data?.logradouro || prev.street,
        neighborhood: data?.bairro || (prev as any).neighborhood || '',
        city: data?.localidade || prev.city,
        state: (data?.uf || prev.state || '').toUpperCase(),
      }));
      toast.success('CEP encontrado. Endereço preenchido.');
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao buscar CEP. Tente novamente.');
    } finally {
      setCepLoadingEdit(false);
    }
  };

  // Busca explícita via botão no modal Nova Organização
  const handleFetchCepNewOrg = async () => {
    const cep = (newOrg.zipCode || '').trim();
    if (!/^\d{5}-\d{3}$/.test(cep)) {
      toast.error('CEP inválido. Use o formato 00000-000.');
      return;
    }
    try {
      setCepLoadingNew(true);
      const base = (import.meta as any).env?.VITE_CEP_PROVIDER_URL || 'https://viacep.com.br/ws';
      const url = `${String(base).replace(/\/$/, '')}/${cep}/json/`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`CEP lookup failed: ${res.status}`);
      const data = await res.json();
      if (data?.erro) {
        toast.error('CEP não encontrado. Verifique o valor informado.');
        return;
      }
      setNewOrg(prev => ({
        ...prev,
        street: data?.logradouro || prev.street,
        neighborhood: data?.bairro || prev.neighborhood,
        city: data?.localidade || prev.city,
        state: (data?.uf || prev.state || '').toUpperCase(),
      }));
      toast.success('CEP encontrado. Endereço preenchido.');
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao buscar CEP. Tente novamente.');
    } finally {
      setCepLoadingNew(false);
    }
  };

  // System owners handlers
  const handleAddOwner = async () => {
    const email = newOwnerEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      toast.error('Informe um e-mail válido');
      return;
    }
    const { data, error } = await supabase
      .from('system_owners')
      .insert({ email })
      .select('email, created_at')
      .single();
    if (error) {
      toast.error(`Não foi possível adicionar owner: ${error.message}`);
      return;
    }
    setSystemOwners((prev) => [data as any, ...prev.filter(o => o.email !== (data as any).email)]);
    setNewOwnerEmail('');
    toast.success('Owner adicionado');
  };

  const handleRemoveOwner = async (email: string) => {
    const { error } = await supabase
      .from('system_owners')
      .delete()
      .eq('email', email);
    if (error) {
      toast.error(`Não foi possível remover owner: ${error.message}`);
      return;
    }
    setSystemOwners((prev) => prev.filter(o => o.email !== email));
    toast.success('Owner removido');
  };

  useEffect(() => {
    const loadOrganizations = async () => {
      let q = supabase
        .from('organizations')
        .select('id, name, domain, contacts, address, contract, branding, created_at, deleted_at')
        .order('created_at', { ascending: false });
      if (!showArchived) {
        // Somente ativas (soft delete ignorado)
        // Postgrest: is('deleted_at', null)
        q = q.is('deleted_at', null) as any;
      }
      const { data, error } = await q;

      if (error) {
        toast.error(`Erro ao carregar organizações: ${error.message}`);
        return;
      }

      const mapped: Organization[] = (data || []).map((o: any) => {
        const contacts = o.contacts || {};
        const address = o.address || {};
        const contract = o.contract || {};
        const branding = o.branding || {};
        const plan = (contract.plan || 'basic') as 'basic'|'professional'|'enterprise';
        const userLimit = plan === 'enterprise' ? 500 : plan === 'professional' ? 100 : 25;
        const monthlyFee = typeof contract.monthlyValue === 'number' ? contract.monthlyValue : 0;
        return {
          id: o.id,
          name: o.name,
          domain: o.domain,
          contactEmail: contacts.email || '',
          contactPhone: contacts.phone || '',
          address: [address.street, address.number, address.city, address.state].filter(Boolean).join(', '),
          status: (contract.status || 'trial') as Organization['status'],
          planType: plan,
          userLimit,
          currentUsers: 0,
          contractStart: new Date(contract.startDate || o.created_at),
          contractEnd: new Date(contract.expirationDate || o.created_at),
          monthlyFee,
          features: [],
          createdAt: new Date(o.created_at),
          branding: {
            logo: branding.logo || undefined,
            colors: {
              primary: branding.colors?.primary,
              secondary: branding.colors?.secondary,
              accent: branding.colors?.accent,
            }
          },
          deletedAt: o.deleted_at ? new Date(o.deleted_at) : null,
        };
      });
      setOrganizations(mapped);

      // Carrega convites para as organizações exibidas
      const orgIds = (data || []).map((o: any) => o.id);
      if (orgIds.length > 0) {
        const { data: invites, error: invErr } = await supabase
          .from('organization_invited_admins')
          .select('id, organization_id, email, role')
          .in('organization_id', orgIds);
        if (!invErr && invites) {
          const grouped: Record<string, { id: string; email: string; role: string }[]> = {};
          invites.forEach((i: any) => {
            if (!grouped[i.organization_id]) grouped[i.organization_id] = [];
            grouped[i.organization_id].push({ id: i.id, email: i.email, role: i.role });
          });
          setInvitesByOrg(grouped);
        }

        // Carrega domínios extras
        const { data: doms, error: domErr } = await supabase
          .from('organization_domains')
          .select('id, organization_id, domain')
          .in('organization_id', orgIds);
        if (!domErr && doms) {
          const groupedDomains: Record<string, { id: string; domain: string }[]> = {};
          doms.forEach((d: any) => {
            if (!groupedDomains[d.organization_id]) groupedDomains[d.organization_id] = [];
            groupedDomains[d.organization_id].push({ id: d.id, domain: d.domain });
          });
          setDomainsByOrg(groupedDomains);
        }

        // Contagem de usuários por organização usando a MATERIALIZED VIEW (fallback para VIEW normal)
        try {
          let countRows: any[] | null = null; let cntErr: any = null;
          try {
            const resMv = await supabase
              .from('organization_user_counts_mv')
              .select('organization_id, user_count')
              .in('organization_id', orgIds);
            countRows = resMv.data as any[]; cntErr = resMv.error;
          } catch {}
          if (cntErr || !countRows) {
            const res = await supabase
              .from('organization_user_counts')
              .select('organization_id, user_count')
              .in('organization_id', orgIds);
            countRows = res.data as any[];
          }
          if (countRows?.length) {
            const mapCounts: Record<string, number> = {};
            countRows.forEach((r: any) => { mapCounts[r.organization_id] = Number(r.user_count) || 0; });
            setOrganizations(prev => prev.map(o => ({ ...o, currentUsers: mapCounts[o.id] ?? 0 })));
          }
        } catch {}
      }
    };
    const loadOwners = async () => {
      const { data, error } = await supabase
        .from('system_owners')
        .select('email, created_at')
        .order('created_at', { ascending: false });
      if (error) {
        toast.error(`Erro ao carregar owners: ${error.message}`);
        return;
      }
      setSystemOwners(data || []);
    };
    loadOrganizations();
    loadOwners();
  }, [showArchived]);

  const beginEdit = async (org: Organization) => {
    setEditingOrg(org);
    // buscar JSON completo para preencher com precisão
    const { data, error } = await supabase
      .from('organizations')
      .select('contacts, address, contract, branding')
      .eq('id', org.id)
      .single();
    const contacts = data?.contacts || {};
    const address = data?.address || {};
    const contract = data?.contract || {};
    const branding = data?.branding || {};
    // calcula meses entre startDate e expirationDate
    let months = 12;
    try {
      if (contract.startDate && contract.expirationDate) {
        const d1 = new Date(contract.startDate);
        const d2 = new Date(contract.expirationDate);
        months = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
        if (months <= 0) months = 12;
      }
    } catch {}
    setEditData({
      name: org.name,
      domain: org.domain,
      contactEmail: contacts.email || org.contactEmail || '',
      contactPhone: contacts.phone || org.contactPhone || '',
      street: address.street || '',
      number: address.number || '',
      city: address.city || '',
      state: address.state || '',
      zipCode: address.zipCode || '',
      planType: (contract.plan || org.planType) as any,
      monthlyValue: typeof contract.monthlyValue === 'number' ? contract.monthlyValue : (org.monthlyFee || 0),
      contractMonths: months,
      startDate: (contract.startDate || '').slice(0,10),
      expirationDate: (contract.expirationDate || '').slice(0,10),
      contractStatus: (contract.status || 'trial') as any,
      features: Array.isArray(contract.features) ? (contract.features as string[]) : [],
      adminEmails: '',
      brandingLogo: branding.logo || '',
      brandingPrimary: branding.colors?.primary || '',
      brandingSecondary: branding.colors?.secondary || '',
      brandingAccent: branding.colors?.accent || '',
    });
  };

  const saveEdit = async () => {
    if (!editingOrg) return;
    // Normaliza cores para HEX válidos
    const cPrimary = normalizeColorToHex(editData.brandingPrimary);
    const cSecondary = normalizeColorToHex(editData.brandingSecondary);
    const cAccent = normalizeColorToHex(editData.brandingAccent);
    if (editData.brandingPrimary && !cPrimary) { toast.error('Cor primária inválida. Use #RRGGBB, rgb(), ou hsl().'); return; }
    if (editData.brandingSecondary && !cSecondary) { toast.error('Cor secundária inválida. Use #RRGGBB, rgb(), ou hsl().'); return; }
    if (editData.brandingAccent && !cAccent) { toast.error('Cor de acento inválida. Use #RRGGBB, rgb(), ou hsl().'); return; }

    // Calcula nova data de expiração com base em contractMonths
    // Datas: prioriza valores informados; se Fim estiver vazio, recalcula a partir de Início + meses
    let startISO = (editData.startDate || '').slice(0,10);
    let expirationISO = (editData.expirationDate || '').slice(0,10);
    if (!startISO) {
      try {
        const { data } = await supabase
          .from('organizations')
          .select('contract')
          .eq('id', editingOrg.id)
          .single();
        const currentStart = (data as any)?.contract?.startDate;
        if (currentStart) startISO = String(currentStart).slice(0,10);
      } catch {}
      if (!startISO) startISO = new Date().toISOString().slice(0,10);
    }
    if (!expirationISO) {
      const startDateObj = new Date(startISO);
      const exp = new Date(startDateObj);
      exp.setMonth(exp.getMonth() + (Number(editData.contractMonths) || 12));
      expirationISO = exp.toISOString().slice(0,10);
    }

    const payload: any = {
      name: editData.name,
      domain: editData.domain,
      contacts: { email: editData.contactEmail, phone: editData.contactPhone },
      address: (editData.street || editData.city || editData.state || editData.zipCode) ? {
        street: editData.street || null,
        number: editData.number || null,
        city: editData.city || null,
        state: editData.state || null,
        zipCode: editData.zipCode || null,
      } : null,
      contract: {
        plan: editData.planType,
        startDate: startISO,
        expirationDate: expirationISO,
        monthlyValue: Number(editData.monthlyValue) || 0,
        status: editData.contractStatus,
        features: editData.features,
      },
      branding: {
        logo: editData.brandingLogo || null,
        colors: {
          primary: cPrimary,
          secondary: cSecondary,
          accent: cAccent,
        }
      }
    };
    const { data: updated, error } = await supabase
      .from('organizations')
      .update(payload)
      .eq('id', editingOrg.id)
      .select('*')
      .single();
    if (error) {
      toast.error(`Erro ao salvar alterações: ${error.message}`);
      return;
    }
    // Se a organização editada é a atual do contexto, atualiza AppContext para refletir em /organization
    try {
      if (organization?.id === editingOrg.id && updated) {
        setOrganization({ ...(updated as any) });
      }
    } catch {}
    // Convida administradores adicionais, se informados
    try {
      const emails = (editData.adminEmails || '')
        .split(/[\n,;]+/)
        .map(e => e.trim().toLowerCase())
        .filter(e => e.length > 3 && e.includes('@'));
      if (emails.length > 0) {
        const rows = emails.map(email => ({ organization_id: editingOrg.id, email, role: 'admin' }));
        const { error: invitesErr } = await supabase
          .from('organization_invited_admins')
          .insert(rows, { defaultToNull: false });
        if (!invitesErr) {
          // Refaz leitura dos convites desta organização (evita erro 400 por columns/select combinados)
          try {
            const { data: invites } = await supabase
              .from('organization_invited_admins')
              .select('id, organization_id, email, role')
              .eq('organization_id', editingOrg.id)
              .order('created_at', { ascending: false });
            setInvitesByOrg(prev => ({
              ...prev,
              [editingOrg.id]: (invites || []).map((i: any) => ({ id: i.id, email: i.email, role: i.role }))
            }));
          } catch {}
        }
        // Envia magic link para cada admin
        try { await Promise.allSettled(emails.map((email) => requestLogin(email))); } catch {}
      }
    } catch {}

    setOrganizations(prev => prev.map(o => o.id === editingOrg.id ? {
      ...o,
      name: editData.name,
      domain: editData.domain,
      contactEmail: editData.contactEmail,
      contactPhone: editData.contactPhone,
      address: [editData.street, editData.number, editData.city, editData.state].filter(Boolean).join(', '),
      planType: editData.planType as any,
      monthlyFee: Number(editData.monthlyValue) || 0,
      branding: {
        logo: editData.brandingLogo || undefined,
        colors: {
          primary: editData.brandingPrimary || undefined,
          secondary: editData.brandingSecondary || undefined,
          accent: editData.brandingAccent || undefined,
        }
      }
    } : o));
    toast.success('Organização atualizada');
    setEditingOrg(null);
  };

  const confirmDelete = (org: Organization) => setDeletingOrg(org);
  const archiveOrg = async (org: Organization) => {
    try {
      // Usa RPC para arquivar em cascata (org + filhos). Idempotente.
      const { error } = await supabase.rpc('admin_archive_organization', { p_org_id: org.id });
      if (error) throw error;
      if (showArchived) {
        setOrganizations(prev => prev.map(o => o.id === org.id ? { ...o, deletedAt: new Date() } : o));
      } else {
        setOrganizations(prev => prev.filter(o => o.id !== org.id));
      }
      toast.success('Organização arquivada (e dependências)');
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao arquivar');
    }
  };

  const restoreOrg = async (org: Organization) => {
    try {
      const { error } = await supabase.rpc('admin_restore_organization', { p_org_id: org.id });
      if (error) throw error;
      if (showArchived) {
        setOrganizations(prev => prev.map(o => o.id === org.id ? { ...o, deletedAt: null } : o));
      } else {
        // Se não estamos mostrando arquivadas, ela já deve aparecer na lista padrão na próxima carga.
        // Atualiza otimisticamente também:
        setOrganizations(prev => prev.map(o => o.id === org.id ? { ...o, deletedAt: null } : o));
      }
      toast.success('Organização restaurada (e dependências)');
    } catch (e: any) {
      // Mensagens de conflito ficam claras na RPC (ex.: conflicting name/domain)
      toast.error(e?.message || 'Falha ao restaurar. Verifique se nome/domínio não conflitam com outra organização ativa.');
    }
  };
  const performHardDelete = async () => {
    if (!hardDeletingOrg) return;
    try {
      if (!canHardDelete) { toast.error('Ação restrita a Owners Globais ou System Admin.'); return; }
      if ((confirmDeleteText || '').trim() !== hardDeletingOrg.name) { toast.error('Digite o nome da organização exatamente para confirmar.'); return; }
      const orgId = hardDeletingOrg.id;
      // Tenta via RPC administrativa primeiro
      let rpcErr: any = null;
      try {
        const { error: e1 } = await supabase.rpc('admin_delete_organization', { p_org_id: orgId });
        if (e1) rpcErr = e1;
      } catch (e: any) { rpcErr = e; }

      if (rpcErr) {
        // Fallback: fluxo manual (ainda pode falhar por regras do default group)
        await supabase.from('profiles').update({ organization_id: null }).eq('organization_id', orgId);
        try { await supabase.from('organization_domains').delete().eq('organization_id', orgId); } catch {}
        try { await supabase.from('organization_invited_admins').delete().eq('organization_id', orgId); } catch {}
        try { await supabase.from('agent_templates').delete().eq('organization_id', orgId); } catch {}
        try { await supabase.from('agent_shares').delete().eq('organization_id', orgId); } catch {}
        try { await supabase.from('agents').delete().eq('organization_id', orgId); } catch {}
        const { error } = await supabase.from('organizations').delete().eq('id', orgId);
        if (error) throw error;
      }

      // 4) Atualiza lista local e contagens
      setOrganizations(prev => prev.filter(o => o.id !== orgId));
      try { await supabase.rpc('refresh_organization_user_counts_mv'); } catch {}
      await refreshOrgUserCounts();

      toast.success('Organização excluída');
      setHardDeletingOrg(null);
      setConfirmDeleteText('');
    } catch (e: any) {
      toast.error(`Não foi possível excluir a organização: ${e?.message || 'Erro desconhecido'}`);
    }
  };

  const goToUsers = () => navigate('/users');

  const handleAddInvite = async (orgId: string) => {
    const email = (newInviteEmail[orgId] || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      toast.error('Informe um e-mail válido para convite');
      return;
    }
    const { data, error } = await supabase
      .from('organization_invited_admins')
      .insert({ organization_id: orgId, email, role: 'admin' })
      .select('id, email, role')
      .single();
    if (error) {
      toast.error(`Não foi possível adicionar o convite: ${error.message}`);
      return;
    }
    setInvitesByOrg((prev) => ({
      ...prev,
      [orgId]: [...(prev[orgId] || []), { id: data.id, email: data.email, role: data.role }],
    }));
    setNewInviteEmail((prev) => ({ ...prev, [orgId]: '' }));
    toast.success('Convite adicionado');
  };

  const handleRemoveInvite = async (orgId: string, inviteId: string) => {
    const { error } = await supabase
      .from('organization_invited_admins')
      .delete()
      .eq('id', inviteId)
      .eq('organization_id', orgId);
    if (error) {
      toast.error(`Não foi possível remover o convite: ${error.message}`);
      return;
    }
    setInvitesByOrg((prev) => ({
      ...prev,
      [orgId]: (prev[orgId] || []).filter((i) => i.id !== inviteId),
    }));
    toast.success('Convite removido');
  };

  // Domínios extras (organization_domains)
  const handleAddDomain = async (orgId: string) => {
    const domain = (newDomainByOrg[orgId] || '').trim().toLowerCase();
    if (!domain || !domain.includes('.')) {
      toast.error('Informe um domínio válido (ex: empresa.com)');
      return;
    }
    const { data, error } = await supabase
      .from('organization_domains')
      .insert({ organization_id: orgId, domain })
      .select('id, domain')
      .single();
    if (error) {
      toast.error(`Não foi possível adicionar o domínio: ${error.message}`);
      return;
    }
    setDomainsByOrg((prev) => ({
      ...prev,
      [orgId]: [...(prev[orgId] || []), { id: data.id, domain: data.domain }],
    }));
    setNewDomainByOrg((prev) => ({ ...prev, [orgId]: '' }));
    toast.success('Domínio adicionado');
  };

  const handleRemoveDomain = async (orgId: string, domainId: string) => {
    const { error } = await supabase
      .from('organization_domains')
      .delete()
      .eq('id', domainId)
      .eq('organization_id', orgId);
    if (error) {
      toast.error(`Não foi possível remover o domínio: ${error.message}`);
      return;
    }
    setDomainsByOrg((prev) => ({
      ...prev,
      [orgId]: (prev[orgId] || []).filter((d) => d.id !== domainId),
    }));
    toast.success('Domínio removido');
  };

  const handleCreateOrganization = async () => {
    if (!newOrg.name || !newOrg.domain || !newOrg.contactEmail) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const selectedPlan = planTypes.find(plan => plan.value === newOrg.planType);
    if (!selectedPlan) return;

    // Datas para criação: usa informadas ou calcula FIM por meses a partir de INÍCIO/hoje
    const startISO = (newOrg.startDate || new Date().toISOString().slice(0,10));
    let expirationISO = (newOrg.expirationDate || '').slice(0,10);
    if (!expirationISO) {
      const start = new Date(startISO);
      const exp = new Date(start);
      exp.setMonth(exp.getMonth() + (Number(newOrg.contractMonths) || 12));
      expirationISO = exp.toISOString().slice(0,10);
    }
    const insertPayload = {
      name: newOrg.name,
      domain: newOrg.domain,
      contacts: {
        email: newOrg.contactEmail,
        phone: newOrg.contactPhone,
        responsibleName: newOrg.name,
        responsibleRole: 'Owner',
      },
      address: (newOrg.street || newOrg.city || newOrg.state || newOrg.zipCode) ? {
        street: newOrg.street || null,
        number: newOrg.number || null,
        complement: newOrg.complement || null,
        neighborhood: newOrg.neighborhood || null,
        city: newOrg.city || null,
        state: newOrg.state || null,
        zipCode: newOrg.zipCode || null,
      } : null,
      contract: {
        plan: newOrg.planType,
        startDate: startISO,
        expirationDate: expirationISO,
        monthlyValue: selectedPlan.monthlyFee,
        status: newOrg.contractStatus,
        features: newOrg.features,
      },
      notifications: { brandColor: '#0ea5e9', emailTemplates: { welcome: '', invitation: '', passwordReset: '' } },
      llm_providers: [],
      branding: { logo: '', colors: { primary: '222.2 84% 4.9%', secondary: '210 40% 98%', accent: '210 40% 96%' } },
    } as any;

    setIsCreating(true);
    const { data, error } = await supabase
      .from('organizations')
      .insert(insertPayload)
      .select('id, name, domain, contacts, address, contract, created_at')
      .single();
    if (error) {
      toast.error(`Erro ao criar organização: ${error.message}`);
      setIsCreating(false);
      return;
    }

    const { data: domData, error: domErr } = await supabase
      .from('organization_domains')
      .insert({ organization_id: data.id, domain: newOrg.domain })
      .select('id, domain')
      .single();
    if (domErr) {
      toast.error(`Organização criada, mas falha ao registrar domínio: ${domErr.message}`);
    } else if (domData) {
      setDomainsByOrg((prev) => ({
        ...prev,
        [data.id]: [...(prev[data.id] || []), { id: domData.id, domain: domData.domain }],
      }));
    }

    // Inserir convites de administradores, se houver
    const emails = (newOrg.adminEmails || '')
      .split(/[\n,;]+/)
      .map(e => e.trim().toLowerCase())
      .filter(e => e.length > 3 && e.includes('@'));
    let summary = '';
    let successCount = 0;
    let failures = 0;
    if (emails.length > 0) {
      const rows = emails.map(email => ({ organization_id: data.id, email, role: 'admin' }));
      const { data: invitesInserted, error: invitesErr } = await supabase
        .from('organization_invited_admins')
        .insert(rows, { defaultToNull: false })
        .select('id, email, role');
      if (invitesErr) {
        toast.error(`Convites de administradores não foram salvos: ${invitesErr.message}`);
      } else if (invitesInserted && invitesInserted.length) {
        setInvitesByOrg((prev) => ({
          ...prev,
          [data.id]: [...(prev[data.id] || []), ...invitesInserted.map((i: any) => ({ id: i.id, email: i.email, role: i.role }))],
        }));
      }
      // Enviar e-mails (link mágico) para cada administrador convidado
      try {
        const results = await Promise.allSettled(emails.map((email) => requestLogin(email)));
        failures = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && (r as any).value?.error)).length;
        successCount = emails.length - failures;
        // Atualiza mapa de status (sent/failed) por e-mail
        setInvitesStatusByOrg((prev) => {
          const current = { ...(prev[data.id] || {}) } as Record<string, 'sent'|'failed'>;
          results.forEach((r, idx) => {
            const em = emails[idx];
            const ok = r.status === 'fulfilled' && !(r as any).value?.error;
            current[em] = ok ? 'sent' : 'failed';
          });
          return { ...prev, [data.id]: current };
        });
        if (failures === 0) {
          toast.success('Convites enviados por e-mail aos administradores.');
        } else if (failures < emails.length) {
          toast.warning('Alguns convites foram enviados, outros falharam. Verifique os e-mails e tente novamente.');
        } else {
          toast.error('Falha ao enviar os e-mails de convite.');
        }
      } catch {
        toast.error('Erro ao enviar e-mails de convite.');
      }
      // E-mail customizado via Edge Function desativado por opção do projeto (usaremos SMTP Zoho pelo Supabase Auth)
      // Caso queira reativar no futuro, basta chamar a função abaixo e configurar provider HTTP (ex.: Resend/ZeptoMail):
      // await supabase.functions.invoke('send-invite-admin', { body: { emails, organization_id: data.id, orgName: newOrg.name, domain: newOrg.domain } });
    }

    // Recarrega do backend para garantir consistência (convites e domínios da org criada)
    try {
      const [{ data: domsFresh }, { data: invitesFresh }] = await Promise.all([
        supabase.from('organization_domains').select('id, domain').eq('organization_id', data.id),
        supabase.from('organization_invited_admins').select('id, email, role').eq('organization_id', data.id)
      ]);
      if (domsFresh) {
        setDomainsByOrg((prev) => ({ ...prev, [data.id]: domsFresh.map((d: any) => ({ id: d.id, domain: d.domain })) }));
      }
      if (invitesFresh) {
        setInvitesByOrg((prev) => ({ ...prev, [data.id]: invitesFresh.map((i: any) => ({ id: i.id, email: i.email, role: i.role })) }));
      }
    } catch {}

    // Toast resumo
    if (emails.length > 0) {
      summary = `Convites: ${successCount} enviados, ${failures} falhas.`;
      toast.message('Resumo da criação', { description: summary });
    }

    // Associar automaticamente o criador à nova organização como owner
    if (currentUser?.id) {
      const { error: profErr } = await supabase
        .from('profiles')
        .update({ organization_id: data.id, role: 'owner' })
        .eq('id', currentUser.id);
      if (profErr) {
        toast.error(`Organização criada, mas falha ao associar seu perfil: ${profErr.message}`);
      }
    }

    const contacts = data.contacts || {};
    const address = data.address || {};
    const contract = data.contract || {};
    const plan = (contract.plan || 'basic') as 'basic'|'professional'|'enterprise';
    const userLimit = plan === 'enterprise' ? 500 : plan === 'professional' ? 100 : 25;
    const monthlyFee = typeof contract.monthlyValue === 'number' ? contract.monthlyValue : 0;
    const created: Organization = {
      id: data.id,
      name: data.name,
      domain: data.domain,
      contactEmail: contacts.email || '',
      contactPhone: contacts.phone || '',
      address: [address.street, address.number, address.city, address.state].filter(Boolean).join(', '),
      status: (contract.status || 'trial') as Organization['status'],
      planType: plan,
      userLimit,
      currentUsers: 0,
      contractStart: new Date(contract.startDate || data.created_at),
      contractEnd: new Date(contract.expirationDate || data.created_at),
      monthlyFee,
      features: newOrg.features,
      createdAt: new Date(data.created_at),
    };

    setOrganizations((prev) => [created, ...prev]);
    toast.success(`Organização "${newOrg.name}" criada com sucesso`);

    setNewOrg({
      name: '',
      domain: '',
      contactEmail: '',
      contactPhone: '',
      address: '',
      planType: 'basic',
      userLimit: 25,
      contractMonths: 12,
      features: [],
      adminEmails: ''
    });
    // Fecha o diálogo após criar a organização
    setNewOrgOpen(false);
    setIsCreating(false);
  };

  const handlePlanChange = (planValue: string) => {
    const plan = planTypes.find(p => p.value === planValue);
    if (plan) {
      setNewOrg(prev => ({
        ...prev,
        planType: planValue as any,
        userLimit: plan.userLimit
      }));
    }
  };

  const toggleFeature = (featureId: string) => {
    setNewOrg(prev => ({
      ...prev,
      features: prev.features.includes(featureId)
        ? prev.features.filter(id => id !== featureId)
        : [...prev.features, featureId]
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'suspended': return 'bg-red-500';
      case 'trial': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'suspended': return 'Suspenso';
      case 'trial': return 'Trial';
      default: return 'Desconhecido';
    }
  };

  const getPlanLabel = (planType: string) => {
    return planTypes.find(p => p.value === planType)?.label || planType;
  };

  const isGlobalOwner = useMemo(() => {
    const u = (currentUser?.email || '').toLowerCase();
    return !!u && systemOwners.some(o => (o.email || '').toLowerCase() === u);
  }, [currentUser?.email, systemOwners]);
  const canHardDelete = useMemo(() => isSystemAdmin() || isGlobalOwner, [isSystemAdmin, isGlobalOwner]);

  // Atualiza contagem de usuários via RPC (refresh da MV) + releitura da view/MV
  const refreshOrgUserCounts = async () => {
    try {
      // Tenta disparar refresh da materialized view (se existir a RPC)
      try { await supabase.rpc('refresh_organization_user_counts_mv'); } catch {}
      const ids = organizations.map(o => o.id);
      if (ids.length === 0) return;
      let countRows: any[] | null = null; let cntErr: any = null;
      try {
        const resMv = await supabase
          .from('organization_user_counts_mv')
          .select('organization_id, user_count')
          .in('organization_id', ids);
        countRows = resMv.data as any[]; cntErr = resMv.error;
      } catch {}
      if (cntErr || !countRows) {
        const res = await supabase
          .from('organization_user_counts')
          .select('organization_id, user_count')
          .in('organization_id', ids);
        countRows = res.data as any[];
      }
      if (countRows?.length) {
        const mapCounts: Record<string, number> = {};
        countRows.forEach((r: any) => { mapCounts[r.organization_id] = Number(r.user_count) || 0; });
        setOrganizations(prev => prev.map(o => ({ ...o, currentUsers: mapCounts[o.id] ?? 0 })));
        toast.success('Contagens de usuários atualizadas');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao atualizar contagens');
    }
  };

  // Guard de permissão (depois de todos os hooks para não quebrar a ordem)
  if (!isSystemAdmin()) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>
              Apenas administradores do sistema podem acessar esta página.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

    );
  }

  return (
    <div className="w-full px-4 md:px-6 py-6 md:py-8 space-y-6">

      <div className="flex justify-between items-start md:items-center gap-3 md:gap-4 flex-col md:flex-row">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold">Administração do Sistema</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Gerencie organizações e configurações globais do sistema
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/admin/model-catalog')}>
            <FileText className="h-4 w-4 mr-2" />
            Catálogo de modelos
          </Button>
          <Button variant="outline" onClick={refreshOrgUserCounts} title="Atualiza a materialized view e recarrega a contagem de usuários por organização">
            <Users className="h-4 w-4 mr-2" />
            Atualizar contagem de usuários
          </Button>
          <Button variant={showArchived ? 'default' : 'outline'} onClick={() => setShowArchived(v => !v)}>
            {showArchived ? 'Ocultar Arquivadas' : 'Mostrar Arquivadas'}
          </Button>
          <Dialog
            open={plansOpen}
            onOpenChange={(open) => {
              setPlansOpen(open);
              if (!open) {
                setEditingPlan(null);
                setNewPlan({ code: '', label: '', user_limit: 0, monthly_fee: 0, active: true });
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" title="Gerenciar planos de assinatura">
                Planos
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[96vw] max-w-3xl">
              <DialogHeader>
                <DialogTitle>Planos</DialogTitle>
                <DialogDescription>Gerencie os planos disponíveis para organizações</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Código</Label>
                    <Input value={newPlan.code} onChange={(e) => setNewPlan({ ...newPlan, code: e.target.value })} placeholder="ex: basic" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Nome</Label>
                    <Input value={newPlan.label} onChange={(e) => setNewPlan({ ...newPlan, label: e.target.value })} placeholder="ex: Básico" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Limite de Usuários</Label>
                    <Input type="number" value={newPlan.user_limit} onChange={(e) => setNewPlan({ ...newPlan, user_limit: Number(e.target.value) || 0 })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Mensalidade (R$)</Label>
                    <Input type="number" step="0.01" value={newPlan.monthly_fee} onChange={(e) => setNewPlan({ ...newPlan, monthly_fee: Number(e.target.value) || 0 })} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label>Ativo</Label>
                    <Switch checked={newPlan.active} onCheckedChange={(v) => setNewPlan({ ...newPlan, active: !!v })} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  {editingPlan && (
                    <Button
                      variant="outline"
                      onClick={() => { setEditingPlan(null); setNewPlan({ code: '', label: '', user_limit: 0, monthly_fee: 0, active: true }); }}
                      disabled={planSaving}
                    >
                      Cancelar
                    </Button>
                  )}
                  <Button
                    onClick={editingPlan ? updatePlan : createPlan}
                    disabled={planSaving || !newPlan.code.trim() || !newPlan.label.trim()}
                  >
                    {planSaving ? 'Salvando…' : (editingPlan ? 'Salvar Alterações' : 'Criar Plano')}
                  </Button>
                </div>

                <div className="border rounded-md">
                  <div className="grid grid-cols-12 gap-2 p-2 text-xs text-muted-foreground">
                    <div className="col-span-3">Plano</div>
                    <div className="col-span-2 text-right">Usuários</div>
                    <div className="col-span-2 text-right">Mensalidade</div>
                    <div className="col-span-2 text-center">Ativo</div>
                    <div className="col-span-3 text-right">Ações</div>
                  </div>
                  <div className="divide-y">
                    {(plans || []).map((p) => (
                      <div key={p.id} className="grid grid-cols-12 gap-2 p-2 text-sm items-center">
                        <div className="col-span-3 font-medium">{p.label} <span className="text-xs text-muted-foreground">({p.code})</span></div>
                        <div className="col-span-2 text-right">{p.user_limit}</div>
                        <div className="col-span-2 text-right">R$ {Number(p.monthly_fee || 0).toLocaleString()}</div>
                        <div className="col-span-2 text-center">
                          <Badge variant={p.active ? 'secondary' : 'outline'}>{p.active ? 'Ativo' : 'Inativo'}</Badge>
                        </div>
                        <div className="col-span-3 flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingPlan(p);
                              setNewPlan({
                                code: p.code,
                                label: p.label,
                                user_limit: p.user_limit,
                                monthly_fee: Number(p.monthly_fee) || 0,
                                active: !!p.active,
                              });
                            }}
                          >
                            Editar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => togglePlanActive(p.id, p.active)}>
                            {p.active ? 'Desativar' : 'Ativar'}
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => removePlan(p.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={newOrgOpen} onOpenChange={setNewOrgOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Organização
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[96vw] max-w-6xl md:max-w-7xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 border-b">
              <DialogTitle>Criar Nova Organização</DialogTitle>
              <DialogDescription>
                Configure uma nova organização no sistema
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="org-name">Nome da Organização *</Label>
                  <Input
                    id="org-name"
                    ref={nameInputRef}
                    value={newOrg.name}
                    onChange={(e) => setNewOrg(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: TechCorp Solutions"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="org-domain">Domínio *</Label>
                  <Input
                    id="org-domain"
                    value={newOrg.domain}
                    onChange={(e) => setNewOrg(prev => ({ ...prev, domain: e.target.value }))}
                    placeholder="Ex: techcorp.com"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="contact-email">Email de Contato *</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    ref={contactEmailRef}
                    value={newOrg.contactEmail}
                    onChange={(e) => setNewOrg(prev => ({ ...prev, contactEmail: e.target.value }))}
                    placeholder="admin@empresa.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contact-phone">Telefone</Label>
                  <Input
                    id="contact-phone"
                    value={newOrg.contactPhone}
                    onChange={(e) => setNewOrg(prev => ({ ...prev, contactPhone: e.target.value }))}
                    placeholder="+55 11 99999-9999"
                  />
                </div>
              </div>

              {/* Endereço estruturado */}
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="zipCode">CEP</Label>
                  <div className="flex items-center gap-2">
                    <Input id="zipCode" value={newOrg.zipCode} onChange={(e) => setNewOrg(prev => ({ ...prev, zipCode: maskCEP(e.target.value) }))} placeholder="00000-000" />
                    <Button type="button" variant="outline" onClick={handleFetchCepNewOrg} disabled={cepLoadingNew || !/^\d{5}-\d{3}$/.test(newOrg.zipCode || '')}>
                      {cepLoadingNew ? 'Buscando...' : 'Buscar CEP'}
                    </Button>
                  </div>
                  {cepLoadingNew && <span className="text-xs text-muted-foreground">Consultando CEP...</span>}
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 grid gap-2">
                    <Label htmlFor="street">Rua</Label>
                    <Input id="street" value={newOrg.street} onChange={(e) => setNewOrg(prev => ({ ...prev, street: e.target.value }))} placeholder="Rua / Avenida" disabled={cepLoadingNew} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="number">Número</Label>
                    <Input id="number" value={newOrg.number} onChange={(e) => setNewOrg(prev => ({ ...prev, number: e.target.value }))} placeholder="123" disabled={cepLoadingNew} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="complement">Complemento</Label>
                    <Input id="complement" value={newOrg.complement} onChange={(e) => setNewOrg(prev => ({ ...prev, complement: e.target.value }))} placeholder="Apto, Bloco, Sala" disabled={cepLoadingNew} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="neighborhood">Bairro</Label>
                    <Input id="neighborhood" value={newOrg.neighborhood} onChange={(e) => setNewOrg(prev => ({ ...prev, neighborhood: e.target.value }))} placeholder="Bairro" disabled={cepLoadingNew} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="city">Cidade</Label>
                    <Input id="city" value={newOrg.city} onChange={(e) => setNewOrg(prev => ({ ...prev, city: e.target.value }))} placeholder="Cidade" disabled={cepLoadingNew} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="state">Estado</Label>
                    <Input id="state" value={newOrg.state} onChange={(e) => setNewOrg(prev => ({ ...prev, state: normalizeUF(e.target.value) }))} placeholder="UF" disabled={cepLoadingNew} />
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="admin-emails">E-mails de Administradores (opcional)</Label>
                <Textarea
                  id="admin-emails"
                  value={newOrg.adminEmails}
                  onChange={(e) => setNewOrg(prev => ({ ...prev, adminEmails: e.target.value }))}
                  placeholder="admin1@empresa.com, admin2@empresa.com\nVocê pode separar por vírgula, ponto e vírgula ou quebra de linha."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">Esses e-mails serão definidos como administradores quando fizerem login pela primeira vez.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="plan-type">Plano</Label>
                  <Select value={newOrg.planType} onValueChange={handlePlanChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Planos do DB ativos */}
                      {(plans || []).filter(p => p.active !== false).map(p => (
                        <SelectItem key={p.code} value={p.code}>
                          {p.label} - {p.user_limit} usuários - R$ {Number(p.monthly_fee || 0).toLocaleString()}/mês
                        </SelectItem>
                      ))}
                      {/* Fallback se não houver planos no DB */}
                      {(!plans || plans.length === 0) && planTypes.map(plan => (
                        <SelectItem key={plan.value} value={plan.value}>
                          {plan.label} - {plan.userLimit} usuários - R$ {plan.monthlyFee.toLocaleString()}/mês
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contract-months">Contrato (meses)</Label>
                  <Input
                    id="contract-months"
                    type="number"
                    value={newOrg.contractMonths}
                    onChange={(e) => setNewOrg(prev => ({ ...prev, contractMonths: parseInt(e.target.value) || 12 }))}
                    min="1"
                    max="36"
                  />
                </div>
              </div>

              {/* Datas do contrato */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="start-date">Início</Label>
                  <Input id="start-date" type="date" value={newOrg.startDate} onChange={(e) => setNewOrg(prev => ({ ...prev, startDate: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="end-date">Fim</Label>
                  <Input id="end-date" type="date" value={newOrg.expirationDate} onChange={(e) => setNewOrg(prev => ({ ...prev, expirationDate: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contract-status">Status do contrato</Label>
                  <Select value={newOrg.contractStatus} onValueChange={(v) => setNewOrg(prev => ({ ...prev, contractStatus: v as any }))}>
                    <SelectTrigger id="contract-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="suspended">Suspenso</SelectItem>
                      <SelectItem value="expired">Expirado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Funcionalidades</Label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded-lg p-3">
                  {availableFeatures.map(feature => (
                    <div key={feature.id} className="flex items-center space-x-2">
                      <Switch
                        id={feature.id}
                        checked={newOrg.features.includes(feature.id)}
                        onCheckedChange={() => toggleFeature(feature.id)}
                      />
                      <Label htmlFor={feature.id} className="text-sm">
                        {feature.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 border-t py-3 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNewOrgOpen(false)} disabled={isCreating}>Cancelar</Button>
              <Button onClick={handleCreateOrganization} disabled={isCreating}>
                {isCreating ? 'Salvando…' : 'Criar Organização'}
              </Button>
            </div>
          </DialogContent>
          </Dialog>

      {/* Excluir Organização (Hard Delete) */}
      <Dialog open={!!hardDeletingOrg} onOpenChange={(open) => { if (!open) { setHardDeletingOrg(null); setConfirmDeleteText(''); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Excluir permanentemente</DialogTitle>
            <DialogDescription>
              Esta ação é irreversível. Para confirmar, digite o nome exato da organização abaixo.
            </DialogDescription>
          </DialogHeader>
          {hardDeletingOrg && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Organização: <span className="font-medium">{hardDeletingOrg.name}</span>
              </div>
              <div className="grid gap-2">
                <Label>Confirmação</Label>
                <Input
                  value={confirmDeleteText}
                  onChange={(e) => setConfirmDeleteText(e.target.value)}
                  placeholder={`Digite: ${hardDeletingOrg.name}`}
                />
              </div>
              {!canHardDelete && (
                <p className="text-sm text-destructive">Ação restrita a Owners Globais ou System Admin.</p>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setHardDeletingOrg(null); setConfirmDeleteText(''); }}>Cancelar</Button>
                <Button
                  variant="destructive"
                  onClick={performHardDelete}
                  disabled={!canHardDelete || (confirmDeleteText || '').trim() !== hardDeletingOrg.name}
                >
                  Excluir permanentemente
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
        </div>
      </div>

      {/* Aviso sobre Owners Globais */}
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
        <CardHeader>
          <CardTitle className="text-base">Owners Globais</CardTitle>
          <CardDescription>
            E-mails cadastrados como <b>owners globais</b> não são vinculados a nenhuma organização e possuem acesso total
            ao painel. Use a seção "System Owners" abaixo para adicionar ou remover e-mails com este privilégio.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Estatísticas Gerais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Organizações</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{organizations.length}</div>
            <p className="text-xs text-muted-foreground">Organizações ativas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Totais</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {organizations.reduce((acc, org) => acc + org.currentUsers, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Usuários em todas as organizações</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Mensal</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {organizations.reduce((acc, org) => acc + org.monthlyFee, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Receita recorrente mensal</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organizações em Trial</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {organizations.filter(org => org.status === 'trial').length}
            </div>
            <p className="text-xs text-muted-foreground">Potenciais conversões</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Organizações */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={expandAll}>Expandir tudo</Button>
        <Button variant="outline" size="sm" onClick={collapseAll}>Recolher tudo</Button>
      </div>
      <div className="space-y-4">
        {organizations.map((org) => (
          <Card key={org.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">

                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{org.name}</h3>
                    <Badge className={getStatusColor(org.status)}>
                      {getStatusLabel(org.status)}
                    </Badge>
                    <Badge variant="outline">
                      {getPlanLabel(org.planType)}
                    </Badge>
                    {org.deletedAt && (
                      <Badge variant="destructive">Arquivada</Badge>
                    )}
                    {/* Preview das cores da marca */}
                    {org as any && (org as any).branding?.colors && (
                      <div className="flex items-center gap-1 ml-1">
                        {['primary','secondary','accent'].map((k) => {
                          const c = (org as any).branding?.colors?.[k];
                          if (!c) return null;
                          // c pode estar no formato "222.2 84% 4.9%" (HSL em Tailwind). Tentamos usar direto; se falhar, fica como background inline.
                          const style: React.CSSProperties = { background: c.includes('#') || c.includes('rgb') ? c : undefined };
                          return (
                            <span key={k} title={`${k}: ${c}`} className="inline-block h-3 w-3 rounded-full border" style={style}></span>
                          );
                        })}
                      </div>
                    )}
                    <Button variant="ghost" size="sm" className="ml-1" onClick={() => toggleOrg(org.id)}>
                      {expandedOrgs[org.id] ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
                      {expandedOrgs[org.id] ? 'Recolher' : 'Detalhes'}
                    </Button>
                    {!org.deletedAt ? (
                      <Button variant="outline" size="sm" onClick={() => archiveOrg(org)}>Arquivar</Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => restoreOrg(org)}>Restaurar</Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => { setHardDeletingOrg(org); setConfirmDeleteText(''); }}
                      disabled={!canHardDelete}
                      className="ml-1"
                      title={canHardDelete ? 'Excluir permanentemente esta organização' : 'Requer Owner Global ou System Admin'}
                    >
                      Excluir permanentemente
                    </Button>
                  </div>
                  
                  {expandedOrgs[org.id] && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="space-y-2">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Mail className="h-4 w-4 mr-2" />
                        {org.contactEmail}
                      </div>
                      {org.contactPhone && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Phone className="h-4 w-4 mr-2" />
                          {org.contactPhone}
                        </div>
                      )}
                      {org.address && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4 mr-2" />
                          {org.address}
                        </div>
                      )}
                      <div className="flex items-center text-sm text-muted-foreground">
                        <span className="text-muted-foreground">Domínio: </span>
                        <span className="font-medium ml-1">{org.domain}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm flex items-center gap-1">
                        <span className="text-muted-foreground">Usuários:</span>
                        <span className="font-medium">{org.currentUsers}/{org.userLimit}</span>
                        <span title="Contagem baseada na materialized view. Use o botão acima para atualizar.">
                          <Info className="h-3.5 w-3.5 text-muted-foreground" />
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Mensalidade: </span>
                        <span className="font-medium">R$ {org.monthlyFee.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Início: </span>
                        <span className="font-medium">{org.contractStart.toLocaleDateString('pt-BR')}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Fim: </span>
                        <span className="font-medium">{org.contractEnd.toLocaleDateString('pt-BR')}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Criada em: </span>
                        <span className="font-medium">{org.createdAt.toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Funcionalidades */}
                  {expandedOrgs[org.id] && (
                  <div>
                    <p className="text-sm font-medium mb-2">Funcionalidades:</p>
                    <div className="flex flex-wrap gap-1">
                      {org.features.map((featureId) => {
                        const feature = availableFeatures.find(f => f.id === featureId);
                        return feature ? (
                          <Badge key={featureId} variant="secondary" className="text-xs">
                            {feature.label}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </div>
                  )}

                  {/* Convites de administradores */}
                  {expandedOrgs[org.id] && (
                  <div className="mt-6 border-t pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Convites de Administradores</h4>
                    </div>
                    <div className="flex gap-2 mb-3">
                      <Input
                        placeholder="email@empresa.com"
                        value={newInviteEmail[org.id] || ''}
                        onChange={(e) => setNewInviteEmail((prev) => ({ ...prev, [org.id]: e.target.value }))}
                        className="max-w-md"
                      />
                      <Button variant="outline" onClick={() => handleAddInvite(org.id)}>Adicionar</Button>
                    </div>
                    <div className="space-y-2">
                      {(invitesByOrg[org.id] || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum convite pendente.</p>
                      ) : (
                        ([...(invitesByOrg[org.id] || [])]
                          .sort((a, b) => a.email.localeCompare(b.email))
                        ).map((inv) => (
                          <div key={inv.id} className="flex items-center justify-between border rounded-md p-2">
                            <div className="text-sm">
                              <span className="font-medium">{inv.email}</span>
                              <Badge variant="secondary" className="ml-2">{inv.role}</Badge>
                              {(() => {
                                const status = invitesStatusByOrg[org.id]?.[inv.email];
                                if (status === 'sent') {
                                  return <Badge variant="secondary" className="ml-2">Enviado</Badge>;
                                }
                                if (status === 'failed') {
                                  return <Badge variant="outline" className="ml-2 text-destructive border-destructive">Falhou</Badge>;
                                }
                                return null;
                              })()}
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleRemoveInvite(org.id, inv.id)}>Remover</Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  )}

                  {/* Domínios Permitidos */}
                  {expandedOrgs[org.id] && (
                  <div className="mt-6 border-t pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Domínios Permitidos</h4>
                    </div>
                    <div className="flex gap-2 mb-3">
                      <Input
                        placeholder="ex: empresa.com"
                        value={newDomainByOrg[org.id] || ''}
                        onChange={(e) => setNewDomainByOrg((prev) => ({ ...prev, [org.id]: e.target.value }))}
                        className="max-w-md"
                      />
                      <Button variant="outline" onClick={() => handleAddDomain(org.id)}>Adicionar Domínio</Button>
                    </div>
                    <div className="space-y-2">
                      {(domainsByOrg[org.id] || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum domínio extra cadastrado.</p>
                      ) : (
                        ([...(domainsByOrg[org.id] || [])]
                          .sort((a, b) => a.domain.localeCompare(b.domain))
                        ).map((d) => (
                          <div key={d.id} className="flex items-center justify-between border rounded-md p-2">
                            <div className="text-sm">
                              <span className="font-medium">{d.domain}</span>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleRemoveDomain(org.id, d.id)}>Remover</Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  )}
                </div>
                
                <div className="flex gap-2 ml-4">
                  {/* Entrar como (modo suporte): alterna a org ativa sem alterar o perfil */}
                  <Button variant="outline" size="sm" onClick={() => enterSupportOrg(org.id)}>
                    Entrar como
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => beginEdit(org)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setDetailsOrg(org)}>
                    <FileText className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={goToUsers}>
                    <Users className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => confirmDelete(org)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Editar Organização */}
      <Dialog open={!!editingOrg} onOpenChange={(open) => { if (!open) setEditingOrg(null); }}>
        <DialogContent className="w-[96vw] max-w-6xl md:max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 border-b">
            <DialogTitle>Editar Organização</DialogTitle>
            <DialogDescription>Atualize as informações básicas da organização</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Domínio</Label>
              <Input value={editData.domain} onChange={(e) => setEditData({ ...editData, domain: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Email de Contato</Label>
              <Input type="email" value={editData.contactEmail} onChange={(e) => setEditData({ ...editData, contactEmail: e.target.value })} />
            </div>
            {/* Endereço estruturado */}
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Rua</Label>
                  <Input value={editData.street} onChange={(e) => setEditData({ ...editData, street: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Número</Label>
                  <Input value={editData.number} onChange={(e) => setEditData({ ...editData, number: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label>Cidade</Label>
                  <Input value={editData.city} onChange={(e) => setEditData({ ...editData, city: e.target.value })} disabled={cepLoadingEdit} />
                </div>
                <div className="grid gap-2">
                  <Label>Estado</Label>
                  <Input value={editData.state} onChange={(e) => setEditData({ ...editData, state: e.target.value })} disabled={cepLoadingEdit} />
                </div>
                <div className="grid gap-2">
                  <Label>CEP</Label>
                  <div className="flex items-center gap-2">
                    <Input value={editData.zipCode} onChange={(e) => setEditData({ ...editData, zipCode: maskCEP(e.target.value) })} placeholder="00000-000" />
                    <Button type="button" variant="outline" onClick={handleFetchCepEdit} disabled={cepLoadingEdit || !/^\d{5}-\d{3}$/.test(editData.zipCode || '')}>
                      {cepLoadingEdit ? 'Buscando...' : 'Buscar CEP'}
                    </Button>
                  </div>
                  {cepLoadingEdit && <span className="text-xs text-muted-foreground">Consultando CEP...</span>}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Plano</Label>
                <Select
                  value={editData.planType}
                  onValueChange={(v) => {
                    const db = (plans || []).find(p => p.code === v);
                    setEditData(prev => ({
                      ...prev,
                      planType: v,
                      monthlyValue: db ? (Number(db.monthly_fee) || prev.monthlyValue) : prev.monthlyValue,
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(plans || []).filter(p => p.active !== false).map((p) => (
                      <SelectItem key={p.code} value={p.code}>
                        {p.label} - {p.user_limit} usuários - R$ {Number(p.monthly_fee || 0).toLocaleString()}/mês
                      </SelectItem>
                    ))}
                    {(!plans || plans.length === 0) && (
                      <>
                        <SelectItem value="basic">Básico</SelectItem>
                        <SelectItem value="professional">Profissional</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
                {/* Limite do plano selecionado */}
                {(() => {
                  const p = (plans || []).find(pp => pp.code === editData.planType);
                  if (!p) return null;
                  return (
                    <div className="text-xs text-muted-foreground">
                      Limite de usuários do plano: <span className="font-medium">{p.user_limit}</span>
                    </div>
                  );
                })()}
              </div>
              <div className="grid gap-2">
                <Label>Mensalidade (R$)</Label>
                <Input type="number" step="0.01" value={editData.monthlyValue} onChange={(e) => setEditData({ ...editData, monthlyValue: Number(e.target.value) })} />
              </div>
              <div className="grid gap-2">
                <Label>Status do contrato</Label>
                <Select value={editData.contractStatus} onValueChange={(v) => setEditData(prev => ({ ...prev, contractStatus: v as any }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="suspended">Suspenso</SelectItem>
                    <SelectItem value="expired">Expirado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Início</Label>
                  <Input type="date" value={editData.startDate} onChange={(e) => setEditData({ ...editData, startDate: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Fim</Label>
                  <Input type="date" value={editData.expirationDate} onChange={(e) => setEditData({ ...editData, expirationDate: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Contrato (meses)</Label>
                <Input type="number" min={1} value={editData.contractMonths} onChange={(e) => setEditData({ ...editData, contractMonths: Math.max(1, Number(e.target.value) || 1) })} />
              </div>
              <div className="grid gap-2">
                <Label>Funcionalidades</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {availableFeatures.map(f => (
                    <label key={f.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editData.features.includes(f.id)}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setEditData(prev => ({
                            ...prev,
                            features: on ? Array.from(new Set([...(prev.features||[]), f.id])) : (prev.features||[]).filter(x => x !== f.id)
                          }));
                        }}
                      />
                      <span>{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <Label>E-mails de Administradores (opcional)</Label>
                <Textarea
                  value={editData.adminEmails}
                  onChange={(e) => setEditData({ ...editData, adminEmails: e.target.value })}
                  placeholder="um@exemplo.com\nadmin@exemplo.com; outro@exemplo.com"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">Separe múltiplos e-mails por quebra de linha, vírgula ou ponto-e-vírgula. Será enviado um link mágico para cada um.</p>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Logo (URL)</Label>
              <Input value={editData.brandingLogo} onChange={(e) => setEditData({ ...editData, brandingLogo: e.target.value })} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm text-muted-foreground">Cores da Marca</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditData({
                  ...editData,
                  brandingPrimary: '#0B1220', // escuro
                  brandingSecondary: '#F8FAFC', // claro
                  brandingAccent: '#E2E8F0', // acento
                })}
              >
                Restaurar Padrão
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>Cor Primária</Label>
                <div className="flex items-center gap-2">
                  <input type="color" aria-label="Cor Primária" value={normalizeColorToHex(editData.brandingPrimary) || '#000000'} onChange={(e) => setEditData({ ...editData, brandingPrimary: e.target.value })} className="h-10 w-10 p-0 border rounded" />
                  <Input value={editData.brandingPrimary} onChange={(e) => setEditData({ ...editData, brandingPrimary: e.target.value })} placeholder="#000000" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Cor Secundária</Label>
                <div className="flex items-center gap-2">
                  <input type="color" aria-label="Cor Secundária" value={normalizeColorToHex(editData.brandingSecondary) || '#111111'} onChange={(e) => setEditData({ ...editData, brandingSecondary: e.target.value })} className="h-10 w-10 p-0 border rounded" />
                  <Input value={editData.brandingSecondary} onChange={(e) => setEditData({ ...editData, brandingSecondary: e.target.value })} placeholder="#111111" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Cor de Acento</Label>
                <div className="flex items-center gap-2">
                  <input type="color" aria-label="Cor de Acento" value={normalizeColorToHex(editData.brandingAccent) || '#222222'} onChange={(e) => setEditData({ ...editData, brandingAccent: e.target.value })} className="h-10 w-10 p-0 border rounded" />
                  <Input value={editData.brandingAccent} onChange={(e) => setEditData({ ...editData, brandingAccent: e.target.value })} placeholder="#222222" />
                </div>
              </div>
            </div>
          </div>
          <div className="sticky bottom-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 border-t py-3 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditingOrg(null)}>Cancelar</Button>
            <Button onClick={saveEdit}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detalhes da Organização */}
      <Dialog open={!!detailsOrg} onOpenChange={(open) => { if (!open) setDetailsOrg(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Organização</DialogTitle>
          </DialogHeader>
          {detailsOrg && (
            <div className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">Nome:</span> {detailsOrg.name}</div>
              <div><span className="text-muted-foreground">Domínio:</span> {detailsOrg.domain}</div>
              <div><span className="text-muted-foreground">Contato:</span> {detailsOrg.contactEmail} {detailsOrg.contactPhone && `· ${detailsOrg.contactPhone}`}</div>
              <div><span className="text-muted-foreground">Endereço:</span> {detailsOrg.address || '-'}</div>
              <div><span className="text-muted-foreground">Plano:</span> {detailsOrg.planType} · Limite {detailsOrg.userLimit}</div>
              <div><span className="text-muted-foreground">Contrato:</span> {detailsOrg.contractStart.toLocaleDateString('pt-BR')} — {detailsOrg.contractEnd.toLocaleDateString('pt-BR')}</div>
              <div><span className="text-muted-foreground">Mensalidade:</span> R$ {detailsOrg.monthlyFee.toLocaleString()}</div>
              <div><span className="text-muted-foreground">Criada em:</span> {detailsOrg.createdAt.toLocaleDateString('pt-BR')}</div>
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setDetailsOrg(null)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmar Arquivamento (Soft Delete) */}
      <Dialog open={!!deletingOrg} onOpenChange={(open) => { if (!open) setDeletingOrg(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Arquivar Organização</DialogTitle>
            <DialogDescription>
              A organização será arquivada e deixará de aparecer nas listagens padrão. Você poderá visualizá-la em "Mostrar Arquivadas" e restaurar depois.
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm">Tem certeza que deseja arquivar <span className="font-semibold">{deletingOrg?.name}</span>?</div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeletingOrg(null)}>Cancelar</Button>
            <Button variant="default" onClick={() => { if (deletingOrg) archiveOrg(deletingOrg); setDeletingOrg(null); }}>Arquivar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}