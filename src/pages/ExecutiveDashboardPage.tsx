import React, { useEffect, useMemo, useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, TrendingDown, MessageSquare, Bot,
  DollarSign, Target, Clock, Calendar
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabaseClient';

const performanceMetrics = [
  { metric: 'ROI', value: '245%', change: '+12%', trend: 'up' },
  { metric: 'Custo por Interação', value: 'R$ 2,35', change: '-8%', trend: 'down' },
  { metric: 'Tempo de Resposta', value: '1.2s', change: '-15%', trend: 'down' },
  { metric: 'Taxa de Resolução', value: '89%', change: '+5%', trend: 'up' }
];

type UsageRow = {
  agent_id: string;
  model: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  cost_estimated?: boolean;
  created_at?: string;
};

import { useNavigate } from 'react-router-dom';

// Componente Admin para recalcular custos via RPC
const AdminRecalcCosts: React.FC<{ orgId: string | null; onDone?: () => void; onApplyProviderFilter?: (prov: string) => void }> = ({ orgId, onDone, onApplyProviderFilter }) => {
  const [prov, setProv] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const handleRun = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc('recalc_costs', {
        p_org: orgId,
        p_provider: prov === 'all' ? null : prov,
      });
      if (error) throw error;
      if (prov !== 'all') onApplyProviderFilter && onApplyProviderFilter(prov);
    } catch (e) {
      console.error('Falha ao recalcular custos:', e);
    } finally {
      setLoading(false);
      onDone && onDone();
    }
  };

  // Drill por Categoria: agrega por agente dentro da categoria selecionada
  const [drillCategory, setDrillCategory] = useState<string | null>(null);
  const [drillCategoryRows, setDrillCategoryRows] = useState<Array<{ agent_id: string; agent_name: string; tokens: number; cost_usd: number; interactions: number }>>([]);
  const [drillCategoryLoading, setDrillCategoryLoading] = useState(false);
  const openDrillForCategory = (category: string) => {
    try {
      setDrillCategory(category);
      setDrillCategoryLoading(true);
      const rowsMap: Record<string, { tokens: number; cost_usd: number; interactions: number }> = {};
      for (const r of filteredUsage as any[]) {
        const ag = agents.find(a => a.id === r.agent_id);
        const cat = (ag as any)?.category || 'Outros';
        if (cat !== category) continue;
        if (!rowsMap[r.agent_id]) rowsMap[r.agent_id] = { tokens: 0, cost_usd: 0, interactions: 0 };
        rowsMap[r.agent_id].tokens += Number(r.total_tokens || 0);
        rowsMap[r.agent_id].cost_usd += Number(r.cost_usd || 0);
        rowsMap[r.agent_id].interactions += 1;
      }
      const rows = Object.entries(rowsMap).map(([agent_id, v]) => ({
        agent_id,
        agent_name: agents.find(a => a.id === agent_id)?.name || agent_id,
        tokens: v.tokens,
        cost_usd: v.cost_usd,
        interactions: v.interactions,
      }));
      rows.sort((a,b) => categoryMetric === 'tokens' ? (b.tokens - a.tokens) : (b.cost_usd - a.cost_usd));
      setDrillCategoryRows(rows);
    } finally {
      setDrillCategoryLoading(false);
    }
  };

  const onExportCategoryCsv = () => {
    const rows = usageByCategory.map((row) => ({
      category: row.name,
      value: categoryMetric === 'tokens' ? Math.round(Number(row.value || 0)) : Number(row.value || 0).toFixed(4),
      metric: categoryMetric
    }));
    const filename = `uso_por_categoria_${categoryMetric}_${Date.now()}.csv`;
    downloadCsv(filename, rows as any);
  };

  return (
    <div className="flex gap-2 items-center">
      <label className="text-xs text-muted-foreground">Provider</label>
      <select className="border rounded px-2 py-1 text-sm" value={prov} onChange={(e) => setProv(e.target.value)}>
        <option value="all">Todos</option>
        <option value="openai">OpenAI</option>
        <option value="anthropic">Anthropic</option>
        <option value="google">Google</option>
        <option value="perplexity">Perplexity</option>
      </select>
      <Button size="sm" onClick={handleRun} disabled={loading || !orgId}>
        {loading ? 'Recalculando…' : 'Recalcular custos'}
      </Button>
    </div>
  );
};

export default function ExecutiveDashboardPage() {
  const { currentUser, organization, agents } = useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [periodDays, setPeriodDays] = useState<number>(7);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [filterAgentId, setFilterAgentId] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [kpiPrev, setKpiPrev] = useState<{ tokens: number; cost: number; conversations: number }>({ tokens: 0, cost: 0, conversations: 0 });
  const [refreshTick, setRefreshTick] = useState(0);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugRows, setDebugRows] = useState<any[]>([]);
  const [hasEstimatedCost, setHasEstimatedCost] = useState(false);
  const [drillAgentId, setDrillAgentId] = useState<string | null>(null);
  const [drillRows, setDrillRows] = useState<any[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  // Filtros adicionais e toggle de estimados
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [filterModel, setFilterModel] = useState<string>('');
  const [includeEstimated, setIncludeEstimated] = useState<boolean>(true);
  const [showMoreFilters, setShowMoreFilters] = useState<boolean>(false);
  // Métrica do gráfico por categoria
  const [categoryMetric, setCategoryMetric] = useState<'tokens'|'cost'>('tokens');
  // Filtro interativo por categoria + cores persistentes
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [categoryColors, setCategoryColors] = useState<Record<string,string>>(() => {
    try { return JSON.parse(localStorage.getItem('category_colors') || '{}') || {}; } catch { return {}; }
  });
  const colorPalette = ["#8884d8","#82ca9d","#ffc658","#ff7c7c","#8dd1e1","#a78bfa", "#34d399", "#f472b6", "#f59e0b", "#60a5fa"];
  useEffect(() => { try { localStorage.setItem('category_colors', JSON.stringify(categoryColors)); } catch {} }, [categoryColors]);
  // Tempo de resposta
  const [respAvgMs, setRespAvgMs] = useState<number | null>(null);
  const [respP50Ms, setRespP50Ms] = useState<number | null>(null);
  const [respP95Ms, setRespP95Ms] = useState<number | null>(null);
  // Taxa de resolução
  const [resolutionRate, setResolutionRate] = useState<number | null>(null);

  // Parâmetros de negócio para KPIs derivados (persistidos no localStorage)
  const [revenuePerInteraction, setRevenuePerInteraction] = useState<number>(0); // Receita por interação (USD)
  const [conversionRate, setConversionRate] = useState<number>(0); // 0..1
  const [minutesSavedPerInteraction, setMinutesSavedPerInteraction] = useState<number>(0); // minutos
  const [hourlyCost, setHourlyCost] = useState<number>(0); // custo/hora (USD)
  // const [bizParamsOpen, setBizParamsOpen] = useState<boolean>(false); // reservado para UI futura

  // Tabs
  const [currentTab, setCurrentTab] = useState<'agents'|'executive'>('agents');
  const [savingOrgDefaults, setSavingOrgDefaults] = useState(false);
  const [saveOrgDefaultsMsg, setSaveOrgDefaultsMsg] = useState<string | null>(null);

  // Wizard de estimativa (estado local)
  const [wizContext, setWizContext] = useState<'suporte'|'vendas'>('suporte');
  const [wizTicketMedio, setWizTicketMedio] = useState<number>(800);
  const [wizTaxaConv, setWizTaxaConv] = useState<number>(0.03);
  const [wizCustoChamado, setWizCustoChamado] = useState<number>(15);
  const [wizDeflection, setWizDeflection] = useState<number>(0.3);
  const [wizMinBenchmark, setWizMinBenchmark] = useState<number>(4);
  const [wizCustoHora, setWizCustoHora] = useState<number>(100);

  // carregar/salvar parâmetros no localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('execdash_biz_params');
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.revenuePerInteraction === 'number') setRevenuePerInteraction(p.revenuePerInteraction);
        if (typeof p.conversionRate === 'number') setConversionRate(p.conversionRate);
        if (typeof p.minutesSavedPerInteraction === 'number') setMinutesSavedPerInteraction(p.minutesSavedPerInteraction);
        if (typeof p.hourlyCost === 'number') setHourlyCost(p.hourlyCost);
      }
    } catch {}
  }, []);
  useEffect(() => {
    const p = { revenuePerInteraction, conversionRate, minutesSavedPerInteraction, hourlyCost };
    try { localStorage.setItem('execdash_biz_params', JSON.stringify(p)); } catch {}
  }, [revenuePerInteraction, conversionRate, minutesSavedPerInteraction, hourlyCost]);

  // Carregar parâmetros efetivos do backend (org_settings) com precedência agent > category > org
  const [effectiveParams, setEffectiveParams] = useState<{ rev?: number|null; conv?: number|null; min?: number|null; hour?: number|null }|null>(null);
  useEffect(() => {
    const loadEffectiveParams = async () => {
      try {
        if (!organization?.id) return;
        const agentId = filterAgentId === 'all' ? null : filterAgentId;
        const category = filterCategory === 'all' ? null : filterCategory;
        const { data, error } = await supabase.rpc('get_effective_org_settings', {
          p_org: organization.id,
          p_agent: agentId,
          p_category: category,
        });
        if (error) throw error;
        // data pode ser array (tabela) ou objeto único dependendo do supabase-js; normalizamos
        const row = Array.isArray(data) ? (data[0] || null) : (data as any);
        if (!row) { setEffectiveParams({ rev: null, conv: null, min: null, hour: null }); return; }
        setEffectiveParams({
          rev: typeof row.revenue_per_interaction === 'number' ? row.revenue_per_interaction : null,
          conv: typeof row.conversion_rate === 'number' ? row.conversion_rate : null,
          min: typeof row.minutes_saved_per_interaction === 'number' ? row.minutes_saved_per_interaction : null,
          hour: typeof row.hourly_cost === 'number' ? row.hourly_cost : null,
        });
        if (typeof row.revenue_per_interaction === 'number' && !Number.isNaN(row.revenue_per_interaction)) {
          setRevenuePerInteraction(Number(row.revenue_per_interaction));
        }
        if (typeof row.conversion_rate === 'number' && !Number.isNaN(row.conversion_rate)) {
          setConversionRate(Number(row.conversion_rate));
        }
        if (typeof row.minutes_saved_per_interaction === 'number' && !Number.isNaN(row.minutes_saved_per_interaction)) {
          setMinutesSavedPerInteraction(Number(row.minutes_saved_per_interaction));
        }
        if (typeof row.hourly_cost === 'number' && !Number.isNaN(row.hourly_cost)) {
          setHourlyCost(Number(row.hourly_cost));
        }
      } catch {}
    };
    loadEffectiveParams();
  }, [organization?.id, filterAgentId, filterCategory]);

  // Auto-seed opcional: se não existir configuração backend (todos nulos) e usuário é admin/owner, gravar os valores locais como padrão da organização
  useEffect(() => {
    const seedIfNeeded = async () => {
      try {
        if (!organization?.id || !currentUser?.role) return;
        if (!(currentUser.role === 'owner' || currentUser.role === 'admin')) return;
        if (!effectiveParams) return;
        const allNull = [effectiveParams.rev, effectiveParams.conv, effectiveParams.min, effectiveParams.hour]
          .every(v => v == null);
        const seededKey = `org_settings_seeded_${organization.id}`;
        const already = localStorage.getItem(seededKey) === '1';
        if (allNull && !already) {
          await supabase.rpc('upsert_org_settings', {
            p_org: organization.id,
            p_scope: 'org',
            p_category: null,
            p_agent: null,
            p_revenue: revenuePerInteraction || null,
            p_conv: conversionRate || null,
            p_minutes: minutesSavedPerInteraction || null,
            p_hourly: hourlyCost || null,
          } as any);
          try { localStorage.setItem(seededKey, '1'); } catch {}
        }
      } catch {}
    };
    seedIfNeeded();
  }, [organization?.id, currentUser?.role, effectiveParams, revenuePerInteraction, conversionRate, minutesSavedPerInteraction, hourlyCost]);

  // Carregar tempo de resposta (agent_usage_metrics.duration_ms) respeitando filtros
  useEffect(() => {
    const loadResponseTimes = async () => {
      if (!organization?.id) return;
      try {
        const calcFrom = fromDate ? new Date(fromDate).toISOString() : new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();
        const calcTo = toDate ? new Date(toDate + 'T23:59:59').toISOString() : undefined;
        let q = supabase
          .from('agent_usage_metrics')
          .select('agent_id, provider, model, duration_ms, created_at')
          .eq('organization_id', organization.id)
          .gte('created_at', calcFrom)
          .not('duration_ms', 'is', null)
          .order('created_at', { ascending: false } as any);
        if (calcTo) q = q.lte('created_at', calcTo);
        if (filterAgentId !== 'all') q = q.eq('agent_id', filterAgentId);
        const { data, error } = await q;
        if (error) throw error;
        // Aplicar filtros locais adicionais (categoria, provider, model)
        const rows = (data || []).filter((r: any) => {
          if (filterCategory !== 'all') {
            const ag = agents.find(a => a.id === r.agent_id);
            if (ag && (ag as any)?.category && (ag as any).category !== filterCategory) return false;
          }
          if (filterProvider !== 'all' && String(r.provider || '').toLowerCase() !== filterProvider.toLowerCase()) return false;
          if (filterModel && !String(r.model || '').toLowerCase().includes(filterModel.toLowerCase())) return false;
          return true;
        });
        const durations: number[] = rows.map((r: any) => Number(r.duration_ms)).filter((v: any) => Number.isFinite(v) && v >= 0);
        if (durations.length === 0) {
          setRespAvgMs(null); setRespP50Ms(null); setRespP95Ms(null);
          return;
        }
        durations.sort((a,b) => a - b);
        const avg = durations.reduce((a,b)=>a+b,0) / durations.length;
        const p = (q: number) => {
          const pos = (durations.length - 1) * q;
          const base = Math.floor(pos);
          const rest = pos - base;
          if (durations[base+1] !== undefined) return durations[base] + rest * (durations[base+1] - durations[base]);
          return durations[base];
        };
        setRespAvgMs(avg);
        setRespP50Ms(p(0.5));
        setRespP95Ms(p(0.95));
      } catch {
        setRespAvgMs(null); setRespP50Ms(null); setRespP95Ms(null);
      }
    };
    loadResponseTimes();
  }, [organization?.id, periodDays, fromDate, toDate, filterAgentId, filterCategory, filterProvider, filterModel, agents, refreshTick]);

  // Carregar taxa de resolução (conversation_outcomes)
  useEffect(() => {
    const loadResolutionRate = async () => {
      if (!organization?.id) return;
      try {
        const calcFrom = fromDate ? new Date(fromDate).toISOString() : new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();
        const calcTo = toDate ? new Date(toDate + 'T23:59:59').toISOString() : undefined;
        let q = supabase
          .from('conversation_outcomes')
          .select('agent_id, resolved, created_at')
          .eq('organization_id', organization.id)
          .gte('created_at', calcFrom)
          .order('created_at', { ascending: false } as any);
        if (calcTo) q = q.lte('created_at', calcTo);
        if (filterAgentId !== 'all') q = q.eq('agent_id', filterAgentId);
        const { data, error } = await q;
        if (error) throw error;
        const rows = (data || []).filter((r: any) => {
          if (filterCategory !== 'all') {
            const ag = agents.find(a => a.id === r.agent_id);
            if (ag && (ag as any)?.category && (ag as any).category !== filterCategory) return false;
          }
          return true;
        });
        const total = rows.length;
        const resolved = rows.filter((r: any) => !!r.resolved).length;
        setResolutionRate(total > 0 ? resolved / total : null);
      } catch {
        setResolutionRate(null);
      }
    };
    loadResolutionRate();
  }, [organization?.id, periodDays, fromDate, toDate, filterAgentId, filterCategory, agents, refreshTick]);

  const resetFilters = () => {
    setPeriodDays(7);
    setFromDate('');
    setToDate('');
    setFilterAgentId('all');
    setFilterCategory('all');
    setFilterProvider('all');
    setFilterModel('');
  };

  useEffect(() => {
    const load = async () => {
      if (!organization?.id) return;
      setLoading(true);
      try {
        const calcFrom = fromDate ? new Date(fromDate).toISOString() : new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();
        const calcTo = toDate ? new Date(toDate + 'T23:59:59').toISOString() : undefined;

        let q = supabase
          .from('agent_token_usage')
          .select('agent_id, provider, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, cost_estimated, created_at')
          .eq('organization_id', organization.id)
          .gte('created_at', calcFrom)
          .order('created_at', { ascending: false } as any);
        if (calcTo) q = q.lte('created_at', calcTo);
        if (filterAgentId !== 'all') q = q.eq('agent_id', filterAgentId);
        const { data, error } = await q;
        if (error) throw error;

        const filteredByCat = filterCategory === 'all'
          ? (data || [])
          : (data || []).filter(r => {
              const ag = agents.find(a => a.id === r.agent_id);
              return (ag?.category || '') === filterCategory;
            });
        setUsage(filteredByCat as any);
        setHasEstimatedCost(((filteredByCat || []) as any[]).some((r: any) => !!r.cost_estimated));
        console.debug('[ExecutiveDashboard] usage rows:', (filteredByCat || []).length, { calcFrom, calcTo, filterAgentId, filterCategory });

        // KPIs do período anterior (mesmo tamanho da janela)
        const fromDateCurr = new Date(calcFrom);
        const toDateCurr = calcTo ? new Date(calcTo) : new Date();
        const windowMs = toDateCurr.getTime() - fromDateCurr.getTime();
        const prevTo = new Date(fromDateCurr.getTime() - 1).toISOString();
        const prevFrom = new Date(fromDateCurr.getTime() - windowMs).toISOString();
        let qPrev = supabase
          .from('agent_token_usage')
          .select('agent_id, provider, model, total_tokens, cost_usd, cost_estimated')
          .eq('organization_id', organization.id)
          .gte('created_at', prevFrom)
          .lte('created_at', prevTo);
        const { data: prevData, error: prevError } = await qPrev;
        if (prevError) throw prevError;
        // Aplicar mesmos filtros do período atual aos dados anteriores
        const prevFiltered = (prevData || []).filter((r: any) => {
          if (filterAgentId !== 'all' && r.agent_id !== filterAgentId) return false;
          if (filterCategory !== 'all') {
            const ag = agents.find(a => a.id === r.agent_id);
            if (ag && (ag as any)?.category && (ag as any).category !== filterCategory) return false;
          }
          if (filterProvider !== 'all' && String(r.provider || '').toLowerCase() !== filterProvider.toLowerCase()) return false;
          if (filterModel && !String(r.model || '').toLowerCase().includes(filterModel.toLowerCase())) return false;
          if (!includeEstimated && r.cost_estimated) return false;
          return true;
        });
        const prevAgg = (prevFiltered || []).reduce((acc, r: any) => {
          acc.tokens += Number(r.total_tokens || 0);
          acc.cost += Number(r.cost_usd || 0);
          return acc;
        }, { tokens: 0, cost: 0 });

        // Conversas do período anterior (alinhadas aos mesmos filtros)
        const convPrev = (prevFiltered || []).length;
        setKpiPrev({ tokens: prevAgg.tokens, cost: prevAgg.cost, conversations: convPrev });
      } catch (e) {
        // fallback: deixa uso vazio
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [organization?.id, periodDays, fromDate, toDate, filterAgentId, filterCategory, agents, refreshTick]);

  // removido: efeito de séries de conversas mockadas (não utilizado na UI atual)

  // Aplica filtros locais a agent_token_usage
  const filteredUsage = useMemo(() => {
    return usage.filter((r: any) => {
      if (filterAgentId !== 'all' && r.agent_id !== filterAgentId) return false;
      if (filterCategory !== 'all') {
        const ag = agents.find(a => a.id === r.agent_id);
        if (ag && (ag as any)?.category && (ag as any).category !== filterCategory) return false;
      }
      if (filterProvider !== 'all' && String(r.provider || '').toLowerCase() !== filterProvider.toLowerCase()) return false;
      if (filterModel && !String(r.model || '').toLowerCase().includes(filterModel.toLowerCase())) return false;
      if (!includeEstimated && r.cost_estimated) return false;
      return true;
    });
  }, [usage, filterAgentId, filterCategory, filterProvider, filterModel, includeEstimated, agents]);

  const totals = useMemo(() => {
    const t = filteredUsage.reduce((acc, r) => {
      acc.tokens += r.total_tokens || 0;
      acc.cost += Number(r.cost_usd || 0);
      return acc;
    }, { tokens: 0, cost: 0 });
    return t;
  }, [filteredUsage]);

  // Uso por Categoria (real): soma de tokens por categoria dos agentes
  const usageByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of filteredUsage as any[]) {
      const ag = agents.find(a => a.id === r.agent_id);
      const cat = (ag as any)?.category || 'Outros';
      const inc = categoryMetric === 'tokens' ? Number(r.total_tokens || 0) : Number(r.cost_usd || 0);
      map[cat] = (map[cat] || 0) + inc;
    }
    const arr = Object.entries(map).map(([name, value]) => ({ name, value }));
    // ordenar desc por valor
    arr.sort((a, b) => (b.value as number) - (a.value as number));
    // atribuir cores persistentes quando novas categorias aparecem
    const nextColors = { ...categoryColors };
    arr.forEach((c, idx) => {
      if (!nextColors[c.name]) nextColors[c.name] = colorPalette[idx % colorPalette.length];
    });
    if (JSON.stringify(nextColors) !== JSON.stringify(categoryColors)) setCategoryColors(nextColors);
    return arr;
  }, [filteredUsage, agents, categoryMetric]);

  // Aplica filtro de categorias ativas (se nenhuma ativa, considera todas)
  const usageByCategoryFiltered = useMemo(() => {
    if (!activeCategories || activeCategories.length === 0) return usageByCategory;
    const setAct = new Set(activeCategories);
    return usageByCategory.filter(c => setAct.has(c.name));
  }, [usageByCategory, activeCategories]);

  const topAgentsByCost = useMemo(() => {
    const map: Record<string, { agent_id: string; cost: number; tokens: number; estimated: boolean } > = {};
    for (const r of filteredUsage) {
      const id = r.agent_id;
      if (!map[id]) map[id] = { agent_id: id, cost: 0, tokens: 0, estimated: false };
      map[id].cost += Number(r.cost_usd || 0);
      map[id].tokens += Number(r.total_tokens || 0);
      map[id].estimated = map[id].estimated || !!(r as any).cost_estimated;
    }
    const arr = Object.values(map);
    arr.sort((a,b) => b.cost - a.cost);
    return arr.slice(0, 10);
  }, [filteredUsage]);

  const tokensByAgent = useMemo(() => {
    const map: Record<string, { agent_id: string; tokens: number } > = {};
    for (const r of filteredUsage) {
      const id = r.agent_id;
      if (!map[id]) map[id] = { agent_id: id, tokens: 0 };
      map[id].tokens += Number(r.total_tokens || 0);
    }
    return Object.values(map).sort((a,b) => b.tokens - a.tokens);
  }, [filteredUsage]);

  // Crescimento de Uso (dados reais no período): interações por mês e agentes ativos por mês
  const monthlyUsageDataView = useMemo(() => {
    // usage já está limitado ao período selecionado pela query em load()
    const byMonthCounts: Record<string, number> = {};
    const byMonthAgents: Record<string, Set<string>> = {};
    for (const r of usage as any[]) {
      const dt = r.created_at ? new Date(r.created_at) : null;
      if (!dt) continue;
      const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}`;
      if (!byMonthCounts[key]) byMonthCounts[key] = 0;
      if (!byMonthAgents[key]) byMonthAgents[key] = new Set();
      byMonthCounts[key] += 1; // 1 registro ~ 1 interação
      byMonthAgents[key].add(r.agent_id);
    }
    const keys = Object.keys(byMonthCounts).sort();
    return keys.map(k => {
      const [y, m] = k.split('-');
      const d = new Date(Date.UTC(Number(y), Number(m)-1, 1));
      return {
        month: d.toLocaleString(undefined, { month: 'short' }),
        conversations: byMonthCounts[k] || 0,
        activeAgents: byMonthAgents[k]?.size || 0,
      };
    });
  }, [usage]);

  const downloadCsv = (filename: string, rows: Array<Record<string, any>>) => {
    if (!rows || rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const esc = (v: any) => {
      const s = String(v ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };
    const csv = [headers.join(',')]
      .concat(rows.map(r => headers.map(h => esc(r[h])).join(',')))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const onExportTopCostCsv = () => {
    const rows = topAgentsByCost.map(row => {
      const ag = agents.find(a => a.id === row.agent_id);
      return {
        agent_name: ag?.name || row.agent_id,
        agent_id: row.agent_id,
        cost_usd: row.cost.toFixed(4),
        tokens: row.tokens,
        cost_estimated: row.estimated ? 'yes' : 'no',
      };
    });
    downloadCsv(`top_agentes_custo_${Date.now()}.csv`, rows);
  };

  const onExportTokensCsv = () => {
    const rows = tokensByAgent.map(row => {
      const ag = agents.find(a => a.id === row.agent_id);
      return {
        agent_name: ag?.name || row.agent_id,
        agent_id: row.agent_id,
        tokens: row.tokens,
      };
    });
    downloadCsv(`tokens_por_agente_${Date.now()}.csv`, rows);
  };

  const onExportCategoryCsv = () => {
    const rows = usageByCategory.map((row) => ({
      category: row.name,
      value: categoryMetric === 'tokens' ? Math.round(Number(row.value || 0)) : Number(row.value || 0).toFixed(4),
      metric: categoryMetric
    }));
    const filename = `uso_por_categoria_${categoryMetric}_${Date.now()}.csv`;
    downloadCsv(filename, rows as any);
  };

  const openDrillForAgent = async (agentId: string) => {
    try {
      setDrillAgentId(agentId);
      setDrillLoading(true);
      const calcFrom = fromDate ? new Date(fromDate).toISOString() : new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();
      const calcTo = toDate ? new Date(toDate + 'T23:59:59').toISOString() : undefined;
      let q = supabase
        .from('agent_token_usage')
        .select('created_at, provider, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, cost_estimated')
        .eq('organization_id', organization?.id || '')
        .eq('agent_id', agentId)
        .gte('created_at', calcFrom)
        .order('created_at', { ascending: false } as any)
        .limit(30);
      if (calcTo) q = q.lte('created_at', calcTo);
      const { data, error } = await q;
      if (error) throw error;
      setDrillRows(data || []);
    } catch (e) {
      setDrillRows([{ error: String((e as any)?.message || e) }]);
    } finally {
      setDrillLoading(false);
    }
  };

  const conversationsTotal = useMemo(() => filteredUsage.length, [filteredUsage]);
  const pct = (curr: number, prev: number) => {
    if (prev <= 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 1000) / 10; // 1 casa decimal
  };

  return (
    <div className="w-full px-4 md:px-8 py-4 space-y-3 md:space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard Executivo</h1>
          <p className="text-muted-foreground">Visão consolidada de uso, custos e métricas</p>
        </div>
        <div />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mt-2">
        <Button variant={currentTab==='agents'?'secondary':'outline'} size="sm" onClick={()=>setCurrentTab('agents')}>Performance de Agentes</Button>
        <Button variant={currentTab==='executive'?'secondary':'outline'} size="sm" onClick={()=>setCurrentTab('executive')}>Performance Executiva</Button>
      </div>

      {currentTab === 'agents' && (
      <>
      {/* Filtros em Card */}
      <Card className="mt-3">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm">Filtros</CardTitle>
              {hasEstimatedCost && (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Obs.: parte dos custos exibidos são estimados com base em tabela de preços padrão dos provedores.
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Incluir estimados</label>
              <input type="checkbox" className="h-4 w-4" checked={includeEstimated} onChange={(e) => setIncludeEstimated(e.target.checked)} />
              <Button variant="ghost" size="sm" onClick={() => setShowMoreFilters(v => !v)}>
                {showMoreFilters ? 'Menos filtros' : 'Mais filtros'}
              </Button>
              <Button variant="ghost" size="sm" onClick={resetFilters}>Limpar filtros</Button>
              <Button variant="outline" onClick={() => setRefreshTick(t => t + 1)}>Atualizar</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <div className="col-span-1 md:col-span-3 lg:col-span-4 flex flex-wrap items-center gap-2">
              <Button variant={(periodDays === 7 && !fromDate && !toDate) ? 'secondary' : 'outline'} onClick={() => { setPeriodDays(7); setFromDate(''); setToDate(''); }}>
                <Calendar className="h-4 w-4 mr-2" /> 7 dias
              </Button>
              <Button variant={(periodDays === 30 && !fromDate && !toDate) ? 'secondary' : 'outline'} onClick={() => { setPeriodDays(30); setFromDate(''); setToDate(''); }}>
                <Calendar className="h-4 w-4 mr-2" /> 30 dias
              </Button>
              <Button variant={(periodDays === 90 && !fromDate && !toDate) ? 'secondary' : 'outline'} onClick={() => { setPeriodDays(90); setFromDate(''); setToDate(''); }}>
                <Calendar className="h-4 w-4 mr-2" /> 90 dias
              </Button>
            </div>
            {showMoreFilters && (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">De</label>
                  <input type="date" className="border rounded px-2 py-1 text-sm w-full" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Até</label>
                  <input type="date" className="border rounded px-2 py-1 text-sm w-full" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Agente</label>
                  <select className="border rounded px-2 py-1 text-sm w-full" value={filterAgentId} onChange={(e) => setFilterAgentId(e.target.value)}>
                    <option value="all">Todos</option>
                    {agents.map(a => (<option key={a.id} value={a.id}>{a.name}</option>))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Categoria</label>
                  <select className="border rounded px-2 py-1 text-sm w-full" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                    <option value="all">Todas</option>
                    {agents.map(a => (<option key={a.id} value={a.category}>{a.category}</option>))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Provider</label>
                  <select className="border rounded px-2 py-1 text-sm w-full" value={filterProvider} onChange={(e) => setFilterProvider(e.target.value)}>
                    <option value="all">Todos</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="google">Google</option>
                    <option value="ollama">Ollama</option>
                    <option value="perplexity">Perplexity</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Modelo</label>
                  <input className="border rounded px-2 py-1 text-sm w-full" placeholder="filtrar por modelo" value={filterModel} onChange={(e) => setFilterModel(e.target.value)} />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Admin: Recalcular custos */}
      {(currentUser?.role === 'owner' || currentUser?.role === 'admin') && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Admin • Recalcular custos</CardTitle>
            <CardDescription>Executa backfill de cost_usd no período selecionado para o provedor escolhido</CardDescription>
          </CardHeader>
          <CardContent>
            <AdminRecalcCosts
              orgId={organization?.id || null}
              onDone={() => setRefreshTick(t => t + 1)}
              onApplyProviderFilter={(p) => setFilterProvider(p)}
            />
          </CardContent>
        </Card>
      )}

      {/* KPIs Reais de Tokens/Custo/Conversas (período) com variação vs período anterior */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tokens (período)</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.tokens.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">{pct(totals.tokens, kpiPrev.tokens)}% vs período anterior</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gasto Estimado {hasEstimatedCost && <span className="text-[10px] ml-1 px-1 py-0.5 rounded bg-amber-100 text-amber-800">estimado</span>}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totals.cost.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">{pct(totals.cost, kpiPrev.cost)}% vs período anterior</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversas (período)</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversationsTotal.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">{pct(conversationsTotal, kpiPrev.conversations)}% vs período anterior</div>
          </CardContent>
        </Card>
      </div>

      {/* Top Agentes por Custo (período) */}
        <Card>
          <CardHeader>
            <CardTitle>Top Agentes por Custo</CardTitle>
            <CardDescription>Somatório de custo por agente no período selecionado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-end mb-2">
              <Button variant="outline" size="sm" onClick={onExportTopCostCsv}>Exportar CSV</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1 pr-2">Agente</th>
                    <th className="py-1 pr-2">Custo</th>
                    <th className="py-1 pr-2">Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {topAgentsByCost.map((row) => {
                    const ag = agents.find(a => a.id === row.agent_id);
                    return (
                      <tr key={row.agent_id} className="border-t hover:bg-accent/40 cursor-pointer" onClick={() => openDrillForAgent(row.agent_id)}>
                        <td className="py-2 pr-2 whitespace-nowrap">{ag?.name || row.agent_id}</td>
                        <td className="py-2 pr-2">
                          ${row.cost.toFixed(2)} {row.estimated && (<span className="ml-1 px-1 py-0.5 text-[10px] rounded bg-amber-100 text-amber-800">estimado</span>)}
                        </td>
                        <td className="py-2 pr-2">{row.tokens.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  {topAgentsByCost.length === 0 && (
                    <tr><td className="py-2 text-sm text-muted-foreground" colSpan={3}>Sem dados no período.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Drill-down */}
            {drillAgentId && (
              <div className="mt-4">
                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle>Interações recentes — {agents.find(a => a.id === drillAgentId)?.name || drillAgentId}</CardTitle>
                    <CardDescription>Últimas 30 interações no período selecionado</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {drillLoading ? (
                      <div className="text-sm text-muted-foreground">Carregando…</div>
                    ) : drillRows.length === 0 ? (
                      <div className="text-sm text-muted-foreground">Sem registros para este agente no período.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-muted-foreground">
                              <th className="py-1 pr-2">created_at</th>
                              <th className="py-1 pr-2">provider</th>
                              <th className="py-1 pr-2">model</th>
                              <th className="py-1 pr-2">prompt</th>
                              <th className="py-1 pr-2">completion</th>
                              <th className="py-1 pr-2">total</th>
                              <th className="py-1 pr-2">cost_usd</th>
                              <th className="py-1 pr-2">flags</th>
                            </tr>
                          </thead>
                          <tbody>
                            {drillRows.map((r: any, i: number) => (
                              <tr key={i} className="border-t">
                                <td className="py-1 pr-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                                <td className="py-1 pr-2">{r.provider}</td>
                                <td className="py-1 pr-2">{r.model}</td>
                                <td className="py-1 pr-2">{r.prompt_tokens}</td>
                                <td className="py-1 pr-2">{r.completion_tokens}</td>
                                <td className="py-1 pr-2">{r.total_tokens}</td>
                                <td className="py-1 pr-2">${Number(r.cost_usd).toFixed(4)}</td>
                                <td className="py-1 pr-2">{r.cost_estimated ? <span className="px-1 py-0.5 text-[10px] rounded bg-amber-100 text-amber-800">estimado</span> : ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className="mt-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => { setDrillAgentId(null); setDrillRows([]); }}>Fechar</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Uso por Categoria de Agente */}
        <Card className="h-full">
          <CardHeader className="min-h-[88px]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>Uso por Categoria de Agente</CardTitle>
                <CardDescription>
                  Distribuição percentual por categoria ({categoryMetric === 'tokens' ? 'tokens' : 'custo'})
                </CardDescription>
                {categoryMetric === 'cost' && hasEstimatedCost && (
                  <div className="mt-1 text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 inline-block">parte estimado</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant={categoryMetric === 'tokens' ? 'secondary' : 'outline'} size="sm" onClick={() => setCategoryMetric('tokens')}>Tokens</Button>
                <Button variant={categoryMetric === 'cost' ? 'secondary' : 'outline'} size="sm" onClick={() => setCategoryMetric('cost')}>Custo</Button>
                <Button variant="outline" size="sm" onClick={onExportCategoryCsv}>Exportar CSV</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={usageByCategoryFiltered}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent, value }) => (
                    `${name} ${(percent * 100).toFixed(0)}% - ` + (categoryMetric === 'tokens'
                      ? `${Number(value as any).toLocaleString()} tk`
                      : `$${Number(value as any).toFixed(2)}`)
                  )}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  onClick={(_, index) => {
                    const item = usageByCategoryFiltered[index];
                    if (item) openDrillForCategory(item.name);
                  }}
                >
                  {usageByCategoryFiltered.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={categoryColors[entry.name] || colorPalette[index % colorPalette.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${Number(value as any).toLocaleString()}`, 'Tokens']} />
              </PieChart>
            </ResponsiveContainer>
            </div>
            {/* Mini-legenda de categorias */}
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              {usageByCategory.map((entry, index) => {
                const active = activeCategories.length === 0 || activeCategories.includes(entry.name);
                return (
                  <button
                    key={`legend-${index}`}
                    className={`flex items-center gap-2 px-2 py-1 rounded border ${active ? 'opacity-100' : 'opacity-50'} hover:bg-accent`}
                    onClick={() => {
                      setActiveCategories((prev) => {
                        if (!prev || prev.length === 0) return [entry.name];
                        const set = new Set(prev);
                        if (set.has(entry.name)) {
                          set.delete(entry.name);
                        } else {
                          set.add(entry.name);
                        }
                        return Array.from(set);
                      });
                    }}
                  >
                    <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: categoryColors[entry.name] || colorPalette[index % colorPalette.length] }} />
                    <span className="text-muted-foreground">{entry.name}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Tokens por Agente (período) */}
        <Card className="h-full">
          <CardHeader className="min-h-[88px]">
            <CardTitle>Tokens por Agente</CardTitle>
            <CardDescription>Somatório de tokens por agente no período selecionado</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="flex justify-end mb-2">
              <Button variant="outline" size="sm" onClick={onExportTokensCsv}>Exportar CSV</Button>
            </div>
            <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tokensByAgent.map(a => ({ name: (agents.find(ag => ag.id === a.agent_id)?.name) || a.agent_id, tokens: a.tokens }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" hide={false} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis />
                <Tooltip formatter={(value) => [`${Number(value).toLocaleString()}`, 'Tokens']} />
                <Bar dataKey="tokens" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
            </div>
            <div className="mt-3 text-right">
              <button
                className="text-xs underline text-primary"
                onClick={() => navigate('/chat/history')}
              >
                Ver histórico completo
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Métricas Operacionais (somente na guia Executiva) */}
        {currentTab === 'executive' && (
          <Card>
            <CardHeader>
              <CardTitle>Métricas Operacionais</CardTitle>
              <CardDescription>Custo por interação, tempo de resposta, taxa de resolução</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Custo por Interação</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const cpi = conversationsTotal > 0 ? totals.cost / conversationsTotal : 0;
                      return <div className="text-xl font-semibold">${cpi.toFixed(4)}</div>;
                    })()}
                    <div className="text-xs text-muted-foreground">Custo / número de interações</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Tempo de Resposta</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {respAvgMs == null ? (
                      <>
                        <div className="text-xl font-semibold">—</div>
                        <div className="text-xs text-muted-foreground">Sem dados no período/filtros</div>
                      </>
                    ) : (
                      <div>
                        <div className="text-xl font-semibold">{Math.round(respAvgMs)} ms</div>
                        <div className="text-xs text-muted-foreground">P50: {respP50Ms ? Math.round(respP50Ms) : '—'} ms • P95: {respP95Ms ? Math.round(respP95Ms) : '—'} ms</div>
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Taxa de Resolução</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {resolutionRate == null ? (
                      <>
                        <div className="text-xl font-semibold">—</div>
                        <div className="text-xs text-muted-foreground">Sem dados no período/filtros</div>
                      </>
                    ) : (
                      <div>
                        <div className="text-xl font-semibold">{(resolutionRate * 100).toFixed(1)}%</div>
                        <div className="text-xs text-muted-foreground">Conversas marcadas como resolvidas</div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      </>
      )}

      {currentTab === 'executive' && (
      <>
      {/* KPIs Principais (derivados de parâmetros configuráveis) */}
      <div className="flex items-start justify-between">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
          {/* Receita Impactada */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Impactada</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {(() => {
                const receita = conversationsTotal * revenuePerInteraction;
                return <div className="text-2xl font-bold">${receita.toLocaleString(undefined,{maximumFractionDigits:0})}</div>;
              })()}
              <div className="text-xs text-muted-foreground">Base: receita por interação × interações</div>
            </CardContent>
          </Card>

          {/* Conversões */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversões</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {(() => {
                const conv = Math.round(conversationsTotal * conversionRate);
                return <div className="text-2xl font-bold">{conv.toLocaleString()}</div>;
              })()}
              <div className="text-xs text-muted-foreground">Base: taxa de conversão × interações</div>
            </CardContent>
          </Card>

          {/* Economia de Tempo */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Economia de Tempo</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {(() => {
                const horas = (conversationsTotal * minutesSavedPerInteraction) / 60;
                return <div className="text-2xl font-bold">{horas.toLocaleString(undefined,{maximumFractionDigits:1})}h</div>;
              })()}
              <div className="text-xs text-muted-foreground">Base: minutos economizados por interação</div>
            </CardContent>
          </Card>

          {/* ROI */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ROI</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {(() => {
                const receita = conversationsTotal * revenuePerInteraction;
                const valorTempo = ((conversationsTotal * minutesSavedPerInteraction)/60) * hourlyCost;
                const invest = totals.cost;
                const roi = invest > 0 ? ((receita + valorTempo - invest) / invest) * 100 : 0;
                return <div className="text-2xl font-bold">{roi.toFixed(1)}%</div>;
              })()}
              <div className="text-xs text-muted-foreground">(Receita + Valor do Tempo - Custo) / Custo</div>
            </CardContent>
          </Card>
        </div>

        {/* Config dos parâmetros (apenas admin/owner) */}
        {(currentUser?.role === 'owner' || currentUser?.role === 'admin') && (
          <div className="ml-4">
            <Card className="min-w-[260px]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Parâmetros</CardTitle>
                <CardDescription className="text-xs">Ajuste para calcular KPIs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-xs text-muted-foreground">Valores em USD</div>
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs">Receita / interação</label>
                  <input type="number" className="border rounded px-2 py-1 text-xs w-24" value={revenuePerInteraction} onChange={e=>setRevenuePerInteraction(Number(e.target.value||0))} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs">Taxa de conversão</label>
                  <input type="number" step="0.01" min="0" max="1" className="border rounded px-2 py-1 text-xs w-24" value={conversionRate} onChange={e=>setConversionRate(Number(e.target.value||0))} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs">Min economizados</label>
                  <input type="number" className="border rounded px-2 py-1 text-xs w-24" value={minutesSavedPerInteraction} onChange={e=>setMinutesSavedPerInteraction(Number(e.target.value||0))} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs">Custo/hora</label>
                  <input type="number" className="border rounded px-2 py-1 text-xs w-24" value={hourlyCost} onChange={e=>setHourlyCost(Number(e.target.value||0))} />
                </div>
                <div className="pt-2 flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={savingOrgDefaults || !organization?.id}
                    onClick={async () => {
                      if (!organization?.id) return;
                      setSaveOrgDefaultsMsg(null);
                      setSavingOrgDefaults(true);
                      try {
                        const { error } = await supabase.rpc('upsert_org_settings', {
                          p_org: organization.id,
                          p_scope: 'org',
                          p_category: null,
                          p_agent: null,
                          p_revenue: revenuePerInteraction || null,
                          p_conv: conversionRate || null,
                          p_minutes: minutesSavedPerInteraction || null,
                          p_hourly: hourlyCost || null,
                        } as any);
                        if (error) throw error;
                        setSaveOrgDefaultsMsg('Salvo como padrão da organização.');
                      } catch (e: any) {
                        setSaveOrgDefaultsMsg(e?.message || 'Falha ao salvar.');
                      } finally {
                        setSavingOrgDefaults(false);
                      }
                    }}
                  >
                    {savingOrgDefaults ? 'Salvando…' : 'Salvar como padrão da organização'}
                  </Button>
                  {saveOrgDefaultsMsg && (
                    <div className="text-[11px] text-muted-foreground">{saveOrgDefaultsMsg}</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Wizard de Estimativa */}
      <Card>
        <CardHeader>
          <CardTitle>Wizard de Estimativa</CardTitle>
          <CardDescription>Preencha alguns dados do seu processo e aplique os parâmetros automaticamente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Contexto</label>
              <select className="border rounded px-2 py-1 text-sm" value={wizContext} onChange={e=>setWizContext(e.target.value as any)}>
                <option value="suporte">Suporte / FAQ</option>
                <option value="vendas">Vendas / Qualificação</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Ticket médio (R$)</label>
              <input type="number" className="border rounded px-2 py-1 text-sm w-full" value={wizTicketMedio} onChange={e=>setWizTicketMedio(Number(e.target.value||0))} />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Taxa de conversão do funil (0..1)</label>
              <input type="number" step="0.01" min="0" max="1" className="border rounded px-2 py-1 text-sm w-full" value={wizTaxaConv} onChange={e=>setWizTaxaConv(Number(e.target.value||0))} />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Custo por chamado humano (R$)</label>
              <input type="number" className="border rounded px-2 py-1 text-sm w-full" value={wizCustoChamado} onChange={e=>setWizCustoChamado(Number(e.target.value||0))} />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Taxa de desvio (deflection) (0..1)</label>
              <input type="number" step="0.01" min="0" max="1" className="border rounded px-2 py-1 text-sm w-full" value={wizDeflection} onChange={e=>setWizDeflection(Number(e.target.value||0))} />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Min economizados por interação</label>
              <input type="number" className="border rounded px-2 py-1 text-sm w-full" value={wizMinBenchmark} onChange={e=>setWizMinBenchmark(Number(e.target.value||0))} />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Custo/hora (R$)</label>
              <input type="number" className="border rounded px-2 py-1 text-sm w-full" value={wizCustoHora} onChange={e=>setWizCustoHora(Number(e.target.value||0))} />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => {
              // Receita/Interação: vendas => ticket * taxa; suporte => custo_chamado * deflection
              const receita = wizContext==='vendas' ? (wizTicketMedio * wizTaxaConv) : (wizCustoChamado * wizDeflection);
              setRevenuePerInteraction(Number((receita/5).toFixed(2)) * 5); // arredonda
              setConversionRate(Number(wizTaxaConv.toFixed(3)));
              setMinutesSavedPerInteraction(Number(wizMinBenchmark.toFixed(1)));
              setHourlyCost(Number(wizCustoHora.toFixed(2)));
            }}>Aplicar parâmetros</Button>
            <div className="text-xs text-muted-foreground self-center">Dica: ajuste finamente no card "Parâmetros" ao lado dos KPIs</div>
          </div>
        </CardContent>
      </Card>

      {/* Texto orientativo */}
      <Card>
        <CardHeader>
          <CardTitle>Como estimar cada parâmetro</CardTitle>
        </CardHeader>
        <CardContent>
{/* Texto fornecido pelo usuário, formatado em parágrafos e subtítulos */}
<div className="space-y-3 text-sm text-muted-foreground">
  <div>
    <h4 className="font-semibold text-foreground">Receita por interação (USD)</h4>
    <p>O que representa: valor médio que uma interação bem-sucedida gera ou evita de custo.</p>
    <p>Como começar (rápido):</p>
    <ul className="list-disc ml-5">
      <li>Vendas: receita média por conversão × taxa de conversão histórica do funil. Ex.: ticket médio de R$ 800 e conversão de 3% ⇒ ~ R$ 24 por interação.</li>
      <li>Suporte/autoatendimento: custo evitado por chamado desviado do humano. Ex.: chamado humano custa R$ 15, com 30% de desvio ⇒ R$ 4,50 por interação.</li>
    </ul>
    <p>Como consolidar (robusto): atribuição por evento e integrações (CRM/Service Desk).</p>
  </div>
  <div>
    <h4 className="font-semibold text-foreground">Taxa de conversão (0..1)</h4>
    <p>O que representa: fração de interações que resultam no “evento de sucesso”.</p>
    <p>Como começar: use a Taxa de Resolução como proxy ou um valor conservador.</p>
    <p>Como consolidar: registre resolved/status por conversa (conversation_outcomes) e calcule a taxa real.</p>
  </div>
  <div>
    <h4 className="font-semibold text-foreground">Minutos economizados por interação</h4>
    <p>O que representa: tempo humano poupado graças ao agente.</p>
    <p>Como começar: time study rápido (10–20 casos) ou benchmarks por tipo de tarefa.</p>
    <p>Como consolidar: instrumente tempo humano no processo e diferencie por categoria.</p>
  </div>
  <div>
    <h4 className="font-semibold text-foreground">Custo/hora (USD)</h4>
    <p>O que representa: custo total da hora (salário + encargos + benefícios + overhead).</p>
    <p>Como começar: use valor médio por família de cargo; consolidar com dados de RH/Financeiro.</p>
  </div>
  <div>
    <h4 className="font-semibold text-foreground">Estratégias para operacionalizar</h4>
    <ul className="list-disc ml-5">
      <li>Níveis de configuração: organização, categoria, agente.</li>
      <li>Evolução mensal automática com dados reais.</li>
      <li>A/B e amostragens mensais para refinar “min economizados”.</li>
    </ul>
  </div>
  <div>
    <h4 className="font-semibold text-foreground">Sugestões de valores iniciais</h4>
    <p>Suporte/FAQ: conversão 0.4–0.7; min 2–5; custo/h R$ 60–120; receita/interação via custo evitado × desvio.</p>
    <p>Vendas/Qualificação: conversão 0.02–0.08; receita/interação = ticket × taxa; min 3–8; custo/h R$ 120–250.</p>
  </div>
</div>
        </CardContent>
      </Card>
      </>
      )}
    </div>
  );
}