import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RefreshCw, Plus, UploadCloud, Play, Pencil } from "lucide-react";

// Página: Settings > Integrações > n8n (Ações Externas)
export default function ExternalActionsPage() {
  const { organization } = useApp();
  const { toast } = useToast();

  const orgId = organization?.id || null;

  const [loading, setLoading] = useState<boolean>(false);
  const [actions, setActions] = useState<any[]>([]);
  const [testingActionId, setTestingActionId] = useState<string | null>(null);
  const [lastTest, setLastTest] = useState<{ actionId: string; ok: boolean; data?: any; error?: string } | null>(null);
  const [testPayloads, setTestPayloads] = useState<Record<string, string>>({});
  const [editOpen, setEditOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    url: "",
    method: "POST",
    authType: "none" as "none" | "bearer" | "header",
    secretEnv: "",
    headerName: "X-API-Key",
    headersJson: "{}",
    inputSchemaJson: "{}",
    outputSchemaJson: "{}",
    enabled: true,
  });

  // Helper para garantir string de erro
  const normalizeError = (e: any): string => {
    if (typeof e === 'string') return e;
    if (typeof e?.message === 'string') return e.message;
    if (typeof e?.error === 'string') return e.error;
    if (typeof e?.details === 'string') return e.details;
    try { return JSON.stringify(e); } catch { return String(e); }
  };

  // Executa teste da ação externa usando o payload embutido
  const testAction = async (action: any) => {
    if (!orgId) return;
    try {
      setTestingActionId(action.id);
      setLastTest(null);
      const raw = testPayloads[action.id] || "{}";
      let params: any = {};
      try { params = JSON.parse(raw); } catch { throw new Error("JSON inválido nos params de teste"); }
      toast({ title: "Executando teste", description: `Ação: ${action.name}` });
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-external-action`;
      const session = await supabase.auth.getSession();
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
          ...(session.data.session?.access_token ? { 'Authorization': `Bearer ${session.data.session.access_token}` } : {})
        },
        body: JSON.stringify({ organization_id: orgId, action_name: action.name, params })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || (data?.ok === false) || data?.error) {
        const errMsg = normalizeError(data?.details || data?.error || `${res.status}`);
        setLastTest({ actionId: action.id, ok: false, error: errMsg });
        throw new Error(errMsg);
      }
      setLastTest({ actionId: action.id, ok: true, data });
      toast({ title: "Teste OK", description: "A resposta foi exibida abaixo." });
    } catch (e: any) {
      const msg = normalizeError(e);
      toast({ title: "Falha no teste", description: msg, variant: "destructive" });
    } finally {
      setTestingActionId(null);
    }
  };

  // Formulário simples de criação/edição (MVP)
  const [form, setForm] = useState({
    name: "",
    description: "",
    url: "",
    method: "POST",
    authType: "none" as "none" | "bearer" | "header",
    secretEnv: "",
    headerName: "X-API-Key",
    headersJson: "{\n  \"Content-Type\": \"application/json\"\n}",
    inputSchemaJson: "{\n  \"type\": \"object\",\n  \"properties\": {\n    \"cnpj\": { \"type\": \"string\" }\n  },\n  \"required\": [\"cnpj\"]\n}",
    outputSchemaJson: "{}",
    enabled: true,
  });

  const canSubmit = useMemo(() => {
    return !!orgId && form.name.trim().length > 0 && form.url.trim().length > 0 && form.method.trim().length > 0;
  }, [orgId, form.name, form.url, form.method]);

  const loadActions = async () => {
    if (!orgId) return;
    setLoading(true);
    const { data, error } = await supabase.from("external_actions").select("*").eq("organization_id", orgId).order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast({ title: "Falha ao listar ações", description: error.message, variant: "destructive" });
      return;
    }
    const arr = data || [];
    setActions(arr);
    // inicializa payloads de teste com base no input_schema (exemplo simples)
    try {
      const next: Record<string, string> = { ...testPayloads };
      for (const a of arr) {
        if (!next[a.id]) {
          const schema = a?.input_schema || {};
          const props = schema?.properties || {};
          const req: string[] = Array.isArray(schema?.required) ? schema.required : [];
          const sample: any = {};
          for (const key of Object.keys(props)) {
            if (req.includes(key)) sample[key] = ""; else sample[key] = "";
          }
          const text = Object.keys(sample).length ? JSON.stringify(sample, null, 2) : "{}";
          next[a.id] = text;
        }
      }
      setTestPayloads(next);
    } catch {}
  };

  const openEdit = (a: any) => {
    setEditingId(a.id);
    const auth = a.auth || {};
    setEditForm({
      name: a.name || "",
      description: a.description || "",
      url: a.url || "",
      method: (a.method || "POST").toUpperCase(),
      authType: (auth.type || "none") as any,
      secretEnv: auth.secret_env || "",
      headerName: auth.header_name || "X-API-Key",
      headersJson: JSON.stringify(a.headers || {}, null, 2),
      inputSchemaJson: JSON.stringify(a.input_schema || {}, null, 2),
      outputSchemaJson: JSON.stringify(a.output_schema || {}, null, 2),
      enabled: !!a.enabled,
    });
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!orgId || !editingId) return;
    try {
      const headers = JSON.parse(editForm.headersJson || "{}");
      const input_schema = JSON.parse(editForm.inputSchemaJson || "{}");
      const output_schema = JSON.parse(editForm.outputSchemaJson || "{}");
      const auth: any = { type: editForm.authType };
      if (editForm.authType === "bearer" || editForm.authType === "header") {
        auth.secret_env = editForm.secretEnv;
      }
      if (editForm.authType === "header") {
        auth.header_name = editForm.headerName || "X-API-Key";
      }

      const payload = {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        url: editForm.url.trim(),
        method: editForm.method.trim().toUpperCase(),
        headers,
        auth,
        input_schema,
        output_schema,
        enabled: !!editForm.enabled,
      };
      const { error } = await supabase.from("external_actions").update(payload).eq("id", editingId);
      if (error) throw error;
      toast({ title: "Ação atualizada", description: `Ação ${editForm.name} salva com sucesso.` });
      setEditOpen(false);
      setEditingId(null);
      await loadActions();
    } catch (e: any) {
      toast({ title: "Erro ao atualizar ação", description: e?.message || String(e), variant: "destructive" });
    }
  };

  useEffect(() => { loadActions(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [orgId]);

  const handleCreate = async () => {
    if (!orgId) return;
    try {
      const headers = JSON.parse(form.headersJson || "{}");
      const input_schema = JSON.parse(form.inputSchemaJson || "{}");
      const output_schema = JSON.parse(form.outputSchemaJson || "{}");
      const auth: any = { type: form.authType };
      if (form.authType === "bearer" || form.authType === "header") {
        auth.secret_env = form.secretEnv;
      }
      if (form.authType === "header") {
        auth.header_name = form.headerName || "X-API-Key";
      }

      const payload = {
        organization_id: orgId,
        name: form.name.trim(),
        description: form.description.trim() || null,
        url: form.url.trim(),
        method: form.method.trim().toUpperCase(),
        headers,
        auth,
        input_schema,
        output_schema,
        enabled: form.enabled,
      };

      const { error } = await supabase.from("external_actions").insert(payload);
      if (error) throw error;
      toast({ title: "Ação criada", description: `Ação ${form.name} criada com sucesso.` });
      setForm({
        name: "",
        description: "",
        url: "",
        method: "POST",
        authType: "none",
        secretEnv: "",
        headerName: "X-API-Key",
        headersJson: "{\n  \"Content-Type\": \"application/json\"\n}",
        inputSchemaJson: "{\n  \"type\": \"object\",\n  \"properties\": {\n    \"cnpj\": { \"type\": \"string\" }\n  },\n  \"required\": [\"cnpj\"]\n}",
        outputSchemaJson: "{}",
        enabled: true,
      });
      loadActions();
    } catch (e: any) {
      toast({ title: "Erro ao criar ação", description: e?.message || String(e), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Integrações — n8n (Ações Externas)</h1>
        <p className="text-muted-foreground">Cadastre webhooks do n8n como ações reutilizáveis pelos agentes.</p>
      </div>

      {/* Dialog de Edição */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Ação</DialogTitle>
            <DialogDescription>Altere os campos e salve para atualizar a ação.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nome</Label>
                <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Ativa</Label>
                <div className="flex items-center gap-2"><Switch checked={editForm.enabled} onCheckedChange={(v) => setEditForm({ ...editForm, enabled: !!v })} /> <span className="text-sm text-muted-foreground">Habilitar ação</span></div>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 space-y-1">
                <Label>URL do Webhook</Label>
                <Input value={editForm.url} onChange={(e) => setEditForm({ ...editForm, url: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Método</Label>
                <Select value={editForm.method} onValueChange={(v) => setEditForm({ ...editForm, method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="GET">GET</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Autenticação</Label>
              <Select value={editForm.authType} onValueChange={(v) => setEditForm({ ...editForm, authType: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem auth</SelectItem>
                  <SelectItem value="bearer">Bearer (Secret)</SelectItem>
                  <SelectItem value="header">Header custom (Secret)</SelectItem>
                </SelectContent>
              </Select>
              {(editForm.authType === "bearer" || editForm.authType === "header") && (
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Nome do Secret (Supabase)</Label>
                    <Input value={editForm.secretEnv} onChange={(e) => setEditForm({ ...editForm, secretEnv: e.target.value })} />
                  </div>
                  {editForm.authType === "header" && (
                    <div className="space-y-1">
                      <Label>Header Name</Label>
                      <Input value={editForm.headerName} onChange={(e) => setEditForm({ ...editForm, headerName: e.target.value })} />
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label>Headers (JSON)</Label>
              <Textarea rows={4} value={editForm.headersJson} onChange={(e) => setEditForm({ ...editForm, headersJson: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Input Schema (JSON)</Label>
              <Textarea rows={6} value={editForm.inputSchemaJson} onChange={(e) => setEditForm({ ...editForm, inputSchemaJson: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Output Schema (JSON)</Label>
              <Textarea rows={4} value={editForm.outputSchemaJson} onChange={(e) => setEditForm({ ...editForm, outputSchemaJson: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setEditOpen(false); setEditingId(null); }}>Cancelar</Button>
              <Button onClick={handleUpdate}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Ações cadastradas</CardTitle>
              <CardDescription>Organização atual: <Badge variant="secondary">{orgId || "Sem organização"}</Badge></CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={loadActions} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {actions.length === 0 && (
                <div className="text-sm text-muted-foreground">Nenhuma ação cadastrada ainda.</div>
              )}
              {actions.map((a) => (
                <div key={a.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{a.name} {a.enabled ? <Badge className="ml-2">Ativa</Badge> : <Badge variant="destructive" className="ml-2">Inativa</Badge>}</div>
                      <div className="text-xs text-muted-foreground truncate">{a.method} • {a.url}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(a)}>
                        <Pencil className="w-4 h-4 mr-1" /> Editar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => testAction(a)} disabled={testingActionId === a.id}>
                        <Play className={`w-4 h-4 mr-1 ${testingActionId === a.id ? 'animate-pulse' : ''}`} />
                        {testingActionId === a.id ? 'Testando...' : 'Testar'}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Payload (JSON)</Label>
                    <Textarea
                      rows={4}
                      value={testPayloads[a.id] || ''}
                      onChange={(e) => setTestPayloads(prev => ({ ...prev, [a.id]: e.target.value }))}
                    />
                  </div>
                  {lastTest && lastTest.actionId === a.id && (
                    <div className="mt-3 bg-muted/30 rounded p-2 text-xs overflow-auto max-h-64">
                      {lastTest.ok ? (
                        <pre className="whitespace-pre-wrap break-words">{JSON.stringify(lastTest.data, null, 2)}</pre>
                      ) : (
                        <div className="text-red-600">Erro: {typeof lastTest.error === 'string' ? lastTest.error : JSON.stringify(lastTest.error)}</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nova Ação</CardTitle>
            <CardDescription>Registre o webhook do n8n como uma ação externa.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="consulta_cnpj" />
            </div>
            <div className="space-y-1">
              <Label>Descrição (opcional)</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Consulta de CNPJ via n8n" />
            </div>
            <div className="space-y-1">
              <Label>URL do Webhook</Label>
              <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://seu-n8n/webhook/consulta-cnpj" />
            </div>
            <div className="space-y-1">
              <Label>Método</Label>
              <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="GET">GET</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Autenticação</Label>
              <Select value={form.authType} onValueChange={(v) => setForm({ ...form, authType: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem auth</SelectItem>
                  <SelectItem value="bearer">Bearer (Secret)</SelectItem>
                  <SelectItem value="header">Header custom (Secret)</SelectItem>
                </SelectContent>
              </Select>
              {(form.authType === "bearer" || form.authType === "header") && (
                <div className="mt-2 grid grid-cols-1 gap-2">
                  <div className="space-y-1">
                    <Label>Nome do Secret (Supabase)</Label>
                    <Input value={form.secretEnv} onChange={(e) => setForm({ ...form, secretEnv: e.target.value })} placeholder="N8N_BEARER_TOKEN" />
                  </div>
                  {form.authType === "header" && (
                    <div className="space-y-1">
                      <Label>Header Name</Label>
                      <Input value={form.headerName} onChange={(e) => setForm({ ...form, headerName: e.target.value })} placeholder="X-API-Key" />
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label>Headers (JSON)</Label>
              <Textarea rows={4} value={form.headersJson} onChange={(e) => setForm({ ...form, headersJson: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Input Schema (JSON)</Label>
              <Textarea rows={6} value={form.inputSchemaJson} onChange={(e) => setForm({ ...form, inputSchemaJson: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Output Schema (JSON)</Label>
              <Textarea rows={4} value={form.outputSchemaJson} onChange={(e) => setForm({ ...form, outputSchemaJson: e.target.value })} />
            </div>
            <Button className="w-full" onClick={handleCreate} disabled={!canSubmit}>
              <Plus className="w-4 h-4 mr-2" /> Criar Ação
            </Button>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <UploadCloud className="w-3 h-3" /> Segredos são lidos no servidor via nome do Secret.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
