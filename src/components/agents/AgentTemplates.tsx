import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Bot, Copy, Plus, Search, Filter, Building2, Globe2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabaseClient"
import { useApp } from "@/contexts/AppContext"
import { useNavigate } from "react-router-dom"
import { usePermissions } from "@/hooks/use-permissions"
import { hasPermission } from "@/lib/permissions"

interface TemplateRow {
  id: string
  title: string
  description: string | null
  category: string | null
  tags: string[] | null
  visibility: 'global' | 'org'
  organization_id: string | null
  owner_id: string | null
  author_id: string
  config: any
  version?: number
}

type TabKey = 'org' | 'global' | 'all'

export function AgentTemplates() {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateRow | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [activeTab, setActiveTab] = useState<TabKey>('org')
  const [loading, setLoading] = useState(false)
  const [importingId, setImportingId] = useState<string | null>(null)
  const [creatingId, setCreatingId] = useState<string | null>(null)
  const [orgTemplates, setOrgTemplates] = useState<TemplateRow[]>([])
  const [globalTemplates, setGlobalTemplates] = useState<TemplateRow[]>([])
  const [editTpl, setEditTpl] = useState<TemplateRow | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editSystemPrompt, setEditSystemPrompt] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [sortBy, setSortBy] = useState<'az' | 'za' | 'category' | 'origin'>('az')
  const { toast } = useToast()
  const { organization, currentUser } = useApp()
  const navigate = useNavigate()
  const { isSystemAdmin } = usePermissions()
  const isOwner = isSystemAdmin()
  const isAdmin = (currentUser?.role === 'admin')
  const isBotManager = hasPermission(currentUser?.role || 'member', "Editar a configuração de um agente")
  const canSeeGlobal = isOwner || isAdmin || isBotManager
  const canImportToOrg = !!organization?.id && (isOwner || isAdmin || isBotManager)


  const openEditTemplate = (tpl: TemplateRow) => {
    setEditTpl(tpl)
    setEditTitle(tpl.title || '')
    setEditDesc(tpl.description || '')
    setEditCategory(tpl.category || '')
    setEditTags((tpl.tags || []).join(', '))
    setEditSystemPrompt(tpl.config?.system_prompt || '')
    setEditOpen(true)
  }

  // Criação direta de agente pessoal a partir do template (sem abrir o wizard)
  const quickCreatePersonalAgent = async (template: TemplateRow) => {
    if (!organization?.id || !currentUser?.id) {
      toast({ title: 'Sessão/Organização ausente', description: 'Faça login e selecione uma organização.', variant: 'destructive' })
      return
    }
    try {
      setCreatingId(template.id)
      const cfg: any = template.config || {}
      const baseName = template.title || 'Agente'
      const suffix = Math.random().toString(36).slice(2, 6)
      const name = `${baseName}`
      const slug = `${(baseName || 'agente').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${suffix}`
      const payload: any = {
        organization_id: organization.id,
        name,
        slug,
        description: template.description || null,
        category: template.category || null,
        model: cfg.model || 'gpt-4o-mini',
        system_prompt: cfg.system_prompt || '',
        status: 'active',
        created_by: currentUser.id,
        tags: template.tags || [],
        mode: (cfg.mode as any) || 'custom',
        assistant_provider: cfg.assistant_provider || null,
        assistant_id: cfg.assistant_id || null,
        retention_limit: cfg.retention_limit ?? 200,
        retention_days: cfg.retention_days ?? 0,
        allow_file_uploads: !!cfg.allow_file_uploads,
        file_storage_mode: cfg.file_storage_mode || 'openai_vector_store',
        generation_provider: cfg.generation_provider || 'openai',
        embedding_provider: cfg.embedding_provider || 'openai',
        embedding_model: cfg.embedding_model || null,
        // vínculo com template
        template_id: template.id,
        template_version: (typeof template.version === 'number' ? template.version : 1),
        template_title: template.title || null,
      }
      const { data, error } = await supabase
        .from('agents')
        .insert(payload)
        .select('id, slug')
        .single()
      if (error) throw error
      toast({ title: 'Agente criado', description: 'Disponível no seu dashboard.' })
      const dest = `/agents/chat/${(data as any)?.slug || (data as any)?.id}`
      navigate(dest)
    } catch (e: any) {
      toast({ title: 'Falha ao criar agente', description: e?.message || 'Tente novamente', variant: 'destructive' })
    } finally {
      setCreatingId(null)
    }
  }

  // Força a aba 'Empresa' para membros (sem permissão de ver globais)
  useEffect(() => {
    if (!canSeeGlobal && activeTab !== 'org') setActiveTab('org')
  }, [canSeeGlobal])

  // Criação rápida: navega com sinalizador quick=1 para a página de criação tratar auto-criação
  const handleQuickCreate = (template: TemplateRow) => {
    const params = new URLSearchParams({ template: template.id, quick: '1' })
    navigate(`/agents/new?${params.toString()}`)
  }

  const saveTemplateEdit = async () => {
    try {
      if (!editTpl || !organization?.id) return
      setSavingEdit(true)
      const tagsArr = (editTags || '').split(',').map(t => t.trim()).filter(Boolean)
      const payload: any = {
        title: editTitle || null,
        description: editDesc || null,
        category: editCategory || null,
        tags: tagsArr.length ? tagsArr : null,
        // Atualiza somente alguns campos dentro de config mantendo o restante
        config: {
          ...(editTpl.config || {}),
          system_prompt: editSystemPrompt || null,
          category: editCategory || null,
          tags: tagsArr,
        }
      }
      const { error } = await supabase
        .from('agent_templates')
        .update(payload)
        .eq('id', editTpl.id)
        .eq('organization_id', organization.id)
      if (error) throw error
      // Atualiza estado local
      setOrgTemplates(prev => prev.map(t => t.id === editTpl.id ? {
        ...t,
        title: payload.title ?? t.title,
        description: payload.description ?? t.description,
        category: payload.category ?? t.category,
        tags: tagsArr,
        config: payload.config,
      } : t))
      setEditOpen(false)
      setEditTpl(null)
      toast({ title: 'Template atualizado', description: 'As alterações foram salvas.' })
    } catch (e: any) {
      toast({ title: 'Falha ao salvar template', description: e?.message || 'Tente novamente', variant: 'destructive' })
    } finally {
      setSavingEdit(false)
    }
  }

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoading(true)
        const [orgRes, globalRes] = await Promise.all([
          organization?.id
            ? supabase.from('agent_templates').select('*').eq('visibility', 'org').eq('organization_id', organization.id)
            : Promise.resolve({ data: [], error: null } as any),
          supabase.from('agent_templates').select('*').eq('visibility', 'global')
        ])
        if (!orgRes.error && orgRes.data) setOrgTemplates(orgRes.data as TemplateRow[])
        if (!globalRes.error && globalRes.data) setGlobalTemplates(globalRes.data as TemplateRow[])

        // Sem fallback de mocks: se vier vazio do banco, mantém vazio
      } catch (e) {
        // noop
      } finally {
        setLoading(false)
      }
    }
    fetchTemplates()
  }, [organization?.id])

  const allCategories = useMemo(() => {
    const src = activeTab === 'org' ? orgTemplates : activeTab === 'global' ? globalTemplates : [...orgTemplates, ...globalTemplates]
    const set = new Set<string>()
    src.forEach(t => { if (t.category) set.add(t.category) })
    return ['all', ...Array.from(set)]
  }, [activeTab, orgTemplates, globalTemplates])

  const filteredTemplates = useMemo(() => {
    const src = activeTab === 'org' ? orgTemplates : activeTab === 'global' ? globalTemplates : [...orgTemplates, ...globalTemplates]
    const term = searchTerm.toLowerCase()
    return src.filter(t => {
      const name = (t.title || '').toLowerCase()
      const desc = (t.description || '').toLowerCase()
      const tags = (t.tags || []).map(tag => (tag || '').toLowerCase())
      const matchesSearch = name.includes(term) || desc.includes(term) || tags.some(tag => tag.includes(term))
      const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [activeTab, orgTemplates, globalTemplates, searchTerm, selectedCategory])

  const sortedTemplates = useMemo(() => {
    const arr = [...filteredTemplates]
    const cmpStr = (a?: string | null, b?: string | null) => (a || '').localeCompare(b || '', 'pt-BR', { sensitivity: 'base' })
    if (sortBy === 'az') {
      arr.sort((a, b) => cmpStr(a.title, b.title))
    } else if (sortBy === 'za') {
      arr.sort((a, b) => cmpStr(b.title, a.title))
    } else if (sortBy === 'category') {
      arr.sort((a, b) => cmpStr(a.category, b.category) || cmpStr(a.title, b.title))
    } else if (sortBy === 'origin') {
      // Empresa antes de Global; dentro, A-Z
      const rank = (v: 'org' | 'global') => (v === 'org' ? 0 : 1)
      arr.sort((a, b) => rank(a.visibility) - rank(b.visibility) || cmpStr(a.title, b.title))
    }
    return arr
  }, [filteredTemplates, sortBy])

  const handleUseTemplate = (template: TemplateRow) => {
    const params = new URLSearchParams({
      template: template.id,
      name: template.title || '',
      description: template.description || '',
      category: template.category || ''
    })
    navigate(`/agents/new?${params.toString()}`)
  }

  const handleCopyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt)
    toast({
      title: "Prompt copiado!",
      description: "O prompt foi copiado para a área de transferência.",
    })
  }

  const importTemplateToOrg = async (template: TemplateRow) => {
    if (!organization?.id) {
      toast({ title: 'Sem organização ativa', description: 'Selecione uma organização para importar o template.', variant: 'destructive' })
      return
    }
    try {
      setImportingId(template.id)
      const payload: Partial<TemplateRow> = {
        title: template.title,
        description: template.description,
        category: template.category,
        tags: template.tags || [],
        visibility: 'org',
        organization_id: organization.id,
        owner_id: currentUser?.id || null,
        author_id: currentUser?.id || template.author_id,
        config: template.config,
      }
      const { data, error } = await supabase
        .from('agent_templates')
        .insert(payload as any)
        .select('*')
        .single()
      if (error) throw error
      // atualiza estado local
      setOrgTemplates(prev => {
        const exists = prev.some(t => t.id === (data as any).id)
        return exists ? prev : [ ...(prev || []), data as any ]
      })
      // muda para aba Empresa para o usuário ver o item importado
      setActiveTab('org')
      toast({ title: 'Template importado', description: 'O modelo foi importado para a empresa.' })
    } catch (e: any) {
      toast({ title: 'Falha ao importar', description: e?.message || 'Erro desconhecido', variant: 'destructive' })
    } finally {
      setImportingId(null)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <img src="/icons/ai-assistant.gif" alt="Agentes" className="h-8 w-8" width={32} height={32} />
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Marketplace de Agentes</h2>
            <p className="text-muted-foreground">Modelos prontos para sua organização ou globais publicados por Proprietário, Administrador ou Especialista em IA</p>
          </div>
        </div>
      </div>
      {/* Filtro de origem */}
      <div className="flex items-center gap-2">
        {canSeeGlobal && (
          <Button variant={activeTab === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setActiveTab('all')}>Todos</Button>
        )}
        <Button variant={activeTab === 'org' ? 'default' : 'outline'} size="sm" onClick={() => setActiveTab('org')}><Building2 className="h-4 w-4 mr-2" /> Empresa</Button>
        {canSeeGlobal && (
          <Button variant={activeTab === 'global' ? 'default' : 'outline'} size="sm" onClick={() => setActiveTab('global')}><Globe2 className="h-4 w-4 mr-2" /> Global</Button>
        )}
        {loading && (<Badge variant="outline" className="ml-2 text-[11px]">Carregando…</Badge>)}
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar templates..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {allCategories.slice(1).map(category => (<SelectItem key={category} value={category}>{category}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Ordenar por" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="az">A–Z (Título)</SelectItem>
              <SelectItem value="za">Z–A (Título)</SelectItem>
              <SelectItem value="category">Categoria</SelectItem>
              <SelectItem value="origin">Origem (Empresa→Global)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Dialogo de Edição (Org) */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Template da Empresa</DialogTitle>
            <DialogDescription>Altere os metadados e o prompt do template importado para sua organização.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Título do template" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Descrição do template" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Categoria</Label>
                <Input value={editCategory} onChange={(e) => setEditCategory(e.target.value)} placeholder="Categoria" />
              </div>
              <div>
                <Label>Tags (separadas por vírgula)</Label>
                <Input value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder="ex.: vendas, marketing" />
              </div>
            </div>
            <div>
              <Label>Prompt do Sistema</Label>
              <Textarea value={editSystemPrompt} onChange={(e) => setEditSystemPrompt(e.target.value)} className="min-h-32" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
              <Button onClick={saveTemplateEdit} disabled={savingEdit}>{savingEdit ? 'Salvando…' : 'Salvar'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Grid de Templates */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sortedTemplates.map((template) => (
          <Card key={template.id} className="hover-scale cursor-pointer transition-all">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <img src="/icons/ai-assistant.gif" alt="Agente" className="h-5 w-5" />
                  <CardTitle className="text-lg">{template.title}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{template.category || 'Sem categoria'}</Badge>
                  <Badge variant="outline" className="text-[11px]">{template.visibility === 'global' ? 'Global' : 'Empresa'}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1">Ver Detalhes</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <img src="/icons/ai-assistant.gif" alt="Agente" className="h-5 w-5" />
                        {template.title}
                      </DialogTitle>
                      <DialogDescription>
                        {template.description || 'Sem descrição'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Categoria</Label>
                          <p className="text-sm text-muted-foreground">{template.category || '—'}</p>
                        </div>
                        <div>
                          <Label>Modelo</Label>
                          <p className="text-sm text-muted-foreground">{template.config?.model || '—'}</p>
                        </div>
                      </div>
                      <div>
                        <Label>Tags</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(template.tags || []).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label>Prompt do Sistema</Label>
                          <Button variant="outline" size="sm" onClick={() => handleCopyPrompt(template.config?.system_prompt || '')}>
                            <Copy className="h-4 w-4 mr-2" />
                            Copiar
                          </Button>
                        </div>
                        <Textarea value={template.config?.system_prompt || ''} readOnly className="min-h-32" />
                      </div>
                      <div className="flex flex-wrap gap-2 pt-4">
                        {/* Criar no meu Dashboard (criação direta e navega para o agente) */}
                        <Button onClick={() => quickCreatePersonalAgent(template)} className="flex-1" disabled={creatingId === template.id}>
                          <Plus className="h-4 w-4 mr-2" />
                          {creatingId === template.id ? 'Criando…' : 'Criar no meu Dashboard'}
                        </Button>
                        {/* Importar p/ Empresa: somente para admins/owners/bot managers e apenas para globais */}
                        {template.visibility === 'global' && canImportToOrg && (
                          <Button variant="outline" onClick={() => importTemplateToOrg(template)} disabled={importingId === template.id}>
                            {importingId === template.id ? 'Importando…' : 'Importar p/ Empresa'}
                          </Button>
                        )}
                        {/* Editar Template: apenas para org + admins */}
                        {template.visibility === 'org' && canImportToOrg && (
                          <Button variant="outline" size="sm" onClick={() => openEditTemplate(template)} title="Editar Template da Empresa">Editar Template</Button>
                        )}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                {/* Botão de criar somente no Dialog; no Card omitimos a criação para reduzir ruído */}
                {/* Importar p/ Empresa: apenas para globais e com permissão */}
                {template.visibility === 'global' && canImportToOrg && (
                  <Button variant="outline" size="sm" onClick={() => importTemplateToOrg(template)} disabled={importingId === template.id}> {importingId === template.id ? 'Importando…' : 'Importar p/ Empresa'} </Button>
                )}
                {/* Editar Template: apenas para org + admins */}
                {template.visibility === 'org' && canImportToOrg && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); openEditTemplate(template); }}
                    title="Editar Template da Empresa"
                  >
                    Editar Template
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty state */}
      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <img src="/icons/ai-assistant.gif" alt="Agentes" className="h-12 w-12 opacity-60 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhum template encontrado</h3>
          <p className="text-muted-foreground">Tente ajustar os filtros ou busca para encontrar templates relevantes.</p>
        </div>
      )}
    </div>
  )
}