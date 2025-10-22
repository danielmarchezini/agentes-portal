import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";

interface TemplateRow {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  tags: string[] | null;
  is_featured: boolean;
  config: any;
}

const OwnerAdminTemplatesPage = () => {
  const { toast } = useToast();
  const { isSystemAdmin, checkingOwner } = usePermissions();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);

  // Form state
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [configText, setConfigText] = useState<string>(JSON.stringify({ generation_provider: 'openai', model: "gpt-4o", system_prompt: "" }, null, 2));
  // Estados auxiliares para gerador de JSON
  const [genProvider, setGenProvider] = useState<'openai'|'google'|'anthropic'>("openai");
  const [genModel, setGenModel] = useState<string>("gpt-4o");
  const [systemPrompt, setSystemPrompt] = useState<string>("");
  const [additionalInstructions, setAdditionalInstructions] = useState<string>("");

  // Pré-visualização e validação
  const finalSystem = useMemo(() => {
    const base = (systemPrompt || "").trim();
    const add = (additionalInstructions || "").trim();
    return add ? `${base}\n\n${add}` : base;
  }, [systemPrompt, additionalInstructions]);
  const configValid = useMemo(() => {
    try {
      const obj = JSON.parse(configText || '{}');
      return !!obj && typeof obj === 'object' && !!obj.system_prompt && !!obj.model && !!obj.generation_provider;
    } catch {
      return false;
    }
  }, [configText]);

  const resetForm = () => {
    setEditId(null);
    setTitle("");
    setDescription("");
    setCategory("");
    setTags("");
    setIsFeatured(false);
    setConfigText(JSON.stringify({ generation_provider: 'openai', model: "gpt-4o", system_prompt: "" }, null, 2));
    setGenProvider('openai');
    setGenModel('gpt-4o');
    setSystemPrompt("");
    setAdditionalInstructions("");
  };

  const load = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('agent_templates')
        .select('id,title,description,category,tags,is_featured,config')
        .eq('visibility', 'global')
        .order('created_at', { ascending: false } as any);
      if (error) throw error;
      setTemplates((data || []) as any);
    } catch (e: any) {
      toast({ title: 'Erro ao carregar', description: e?.message || 'Falha ao listar templates globais', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (checkingOwner) {
    return (
      <div className="min-h-[60vh] grid place-items-center text-sm text-muted-foreground">Verificando permissões…</div>
    );
  }
  if (!isSystemAdmin()) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Acesso restrito</h3>
          <p className="text-muted-foreground">Somente OWNER pode gerenciar templates globais.</p>
        </div>
      </div>
    );
  }

  const onEdit = (t?: TemplateRow) => {
    if (t) {
      setEditId(t.id);
      setTitle(t.title || "");
      setDescription(t.description || "");
      setCategory(t.category || "");
      setTags((t.tags || []).join(', '));
      setIsFeatured(!!t.is_featured);
      setConfigText(JSON.stringify(t.config || { generation_provider: 'openai', model: 'gpt-4o', system_prompt: '' }, null, 2));
      const cfg = (t.config || {}) as any;
      const prov = (cfg?.generation_provider || 'openai') as 'openai'|'google'|'anthropic';
      setGenProvider(prov);
      setGenModel(cfg?.model || (prov === 'google' ? 'gemini-1.5-pro' : prov === 'anthropic' ? 'claude-3-5-sonnet-20241022' : 'gpt-4o'));
      setSystemPrompt(cfg?.system_prompt || '');
      setAdditionalInstructions(cfg?.additional_instructions || '');
    } else {
      resetForm();
    }
    setOpen(true);
  };

  const onSave = async () => {
    try {
      const payload: any = {
        title: title.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        is_featured: !!isFeatured,
        visibility: 'global',
        owner_id: null, // opcional, pode armazenar caller em outra evolução
      };
      try {
        payload.config = JSON.parse(configText);
      } catch {
        toast({ title: 'Config inválida', description: 'JSON do campo Config é inválido.', variant: 'destructive' });
        return;
      }
      if (!payload.title) {
        toast({ title: 'Título obrigatório', description: 'Informe o título do template.' , variant: 'destructive' });
        return;
      }
      if (editId) {
        const { error } = await supabase.from('agent_templates').update(payload).eq('id', editId);
        if (error) throw error;
        toast({ title: 'Template atualizado' });
      } else {
        // Define author_id (obrigatório) no insert
        const { data: userResp, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userResp?.user?.id) {
          toast({ title: 'Usuário não identificado', description: 'Faça login novamente para criar templates.', variant: 'destructive' });
          return;
        }
        payload.author_id = userResp.user.id;
        const { error } = await supabase.from('agent_templates').insert(payload);
        if (error) throw error;
        toast({ title: 'Template criado' });
      }
      setOpen(false);
      resetForm();
      load();
    } catch (e: any) {
      toast({ title: 'Falha ao salvar', description: e?.message || 'Tente novamente', variant: 'destructive' });
    }
  };

  const onDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('agent_templates').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Template excluído' });
      load();
    } catch (e: any) {
      toast({ title: 'Falha ao excluir', description: e?.message || 'Tente novamente', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Templates Globais (OWNER)</h2>
          <p className="text-muted-foreground">Gerencie os modelos globais do Marketplace</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => onEdit(undefined)}>Novo Template Global</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editId ? 'Editar Template Global' : 'Novo Template Global'}</DialogTitle>
              <DialogDescription>Defina título, descrição e o JSON de configuração do agente.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>Título</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Descrição</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>
              <div className="grid gap-2">
                <Label>Categoria</Label>
                <Input value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Tags (separadas por vírgula)</Label>
                <Input value={tags} onChange={(e) => setTags(e.target.value)} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Destacado</Label>
                <Switch checked={isFeatured} onCheckedChange={setIsFeatured} />
              </div>

              {/* Gerador de JSON: Provider, Modelo e Prompt do Sistema */}
              <div className="p-3 border rounded-md space-y-3 bg-muted/30">
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Provider</Label>
                    <Select value={genProvider} onValueChange={(v: 'openai'|'google'|'anthropic') => {
                      setGenProvider(v);
                      // Ajusta modelo default por provider
                      if (v === 'openai') setGenModel('gpt-4o');
                      if (v === 'google') setGenModel('gemini-1.5-pro');
                      if (v === 'anthropic') setGenModel('claude-3-5-sonnet-20241022');
                    }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="google">Google</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Modelo</Label>
                    {/* Modelos variam conforme provider */}
                    {genProvider === 'openai' && (
                      <Select value={genModel} onValueChange={setGenModel}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o modelo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                          <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                          <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {genProvider === 'google' && (
                      <Select value={genModel} onValueChange={setGenModel}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o modelo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                          <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {genProvider === 'anthropic' && (
                      <Select value={genModel} onValueChange={setGenModel}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o modelo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="claude-3-sonnet-20240229">Claude 3 Sonnet</SelectItem>
                          <SelectItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</SelectItem>
                          <SelectItem value="claude-3-haiku-20240307">Claude 3 Haiku</SelectItem>
                          <SelectItem value="claude-3-opus-20240229">Claude 3 Opus</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Prompt do Sistema *</Label>
                  <Textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="Instruções do Sistema (System Prompt)"
                    rows={4}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Instruções Adicionais (concatenadas ao System Prompt)</Label>
                  <Textarea
                    value={additionalInstructions}
                    onChange={(e) => setAdditionalInstructions(e.target.value)}
                    placeholder="Regras adicionais, políticas ou orientações que serão adicionadas ao final do System Prompt"
                    rows={3}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Pré-visualização do System Prompt final</Label>
                  <Textarea value={finalSystem} readOnly className="font-mono text-xs" rows={4} />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!systemPrompt.trim() || !genProvider || !genModel}
                    onClick={() => {
                      if (!systemPrompt.trim()) {
                        toast({ title: 'Prompt obrigatório', description: 'Preencha o Prompt do Sistema para gerar o JSON.', variant: 'destructive' });
                        return;
                      }
                      const add = additionalInstructions.trim();
                      const json = {
                        generation_provider: genProvider,
                        model: genModel,
                        system_prompt: finalSystem,
                        additional_instructions: add,
                      } as any;
                      setConfigText(JSON.stringify(json, null, 2));
                    }}
                  >
                    Gerar JSON
                  </Button>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Config (JSON)</Label>
                <Textarea value={configText} onChange={(e) => setConfigText(e.target.value)} className="font-mono text-xs min-h-40" />
                {!configValid && (
                  <div className="text-xs text-destructive">JSON inválido ou faltando campos obrigatórios (generation_provider, model, system_prompt).</div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancelar</Button>
                <Button onClick={onSave} disabled={!configValid || !title.trim()}>Salvar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map(t => (
          <Card key={t.id} className="hover:shadow-md transition-all">
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{t.title}</CardTitle>
                {t.is_featured && <Badge>Destacado</Badge>}
              </div>
              <CardDescription>{t.description || 'Sem descrição'}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground mb-3">{t.category || 'Sem categoria'}</div>
              <div className="flex flex-wrap gap-1 mb-4">
                {(t.tags || []).slice(0, 4).map(tag => (
                  <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                ))}
                {(t.tags || []).length > 4 && (
                  <Badge variant="outline" className="text-xs">+{(t.tags || []).length - 4}</Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onEdit(t)}>Editar</Button>
                <Button variant="destructive" onClick={() => onDelete(t.id)}>Excluir</Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {templates.length === 0 && !loading && (
          <div className="col-span-full text-center text-sm text-muted-foreground py-10">Nenhum template global ainda.</div>
        )}
      </div>
    </div>
  );
};

export default OwnerAdminTemplatesPage;
