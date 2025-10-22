import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { fetchModelCatalog, getCatalogGenModelInfo, getCatalogEmbeddingModelInfo, setModelCatalogOverride, type ModelCatalog, type ModelInfo } from "@/lib/llm";
import { useToast } from "@/hooks/use-toast";

export default function ModelCatalogAdminPage() {
  const { toast } = useToast();
  const [baseCatalog, setBaseCatalog] = useState<ModelCatalog | null>(null);
  const [working, setWorking] = useState<ModelCatalog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setLoading(true);
        const cat = await fetchModelCatalog();
        if (!ignore) {
          setBaseCatalog(cat);
          // Cria uma cópia editável
          setWorking(cat ? JSON.parse(JSON.stringify(cat)) as ModelCatalog : {} as ModelCatalog);
        }
      } catch (e: any) {
        toast({ title: "Falha ao carregar catálogo", description: e?.message || "Verifique o arquivo público", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, []);

  const providers = useMemo(() => {
    if (!working) return [] as string[];
    return Object.keys(working).filter(k => k !== "embeddings").sort();
  }, [working]);

  const embeddingsProv = useMemo(() => {
    if (!working) return [] as string[];
    const emb = (working.embeddings || {}) as Record<string, any>;
    return Object.keys(emb).sort();
  }, [working]);

  const setGenInfo = (provider: string, modelId: string, updater: (old: ModelInfo | undefined) => ModelInfo) => {
    setWorking(prev => {
      const next = JSON.parse(JSON.stringify(prev || {})) as ModelCatalog;
      if (!next[provider]) (next as any)[provider] = {};
      const old = (next as any)[provider][modelId] as ModelInfo | undefined;
      (next as any)[provider][modelId] = updater(old);
      return next;
    });
  };

  const setEmbInfo = (provider: string, modelId: string, updater: (old: ModelInfo | undefined) => ModelInfo) => {
    setWorking(prev => {
      const next = JSON.parse(JSON.stringify(prev || {})) as ModelCatalog;
      if (!next.embeddings) next.embeddings = {} as any;
      if (!(next.embeddings as any)[provider]) (next.embeddings as any)[provider] = {};
      const old = (next.embeddings as any)[provider][modelId] as ModelInfo | undefined;
      (next.embeddings as any)[provider][modelId] = updater(old);
      return next;
    });
  };

  const handleApply = async () => {
    try {
      setModelCatalogOverride(working as any);
      await fetchModelCatalog();
      toast({ title: "Override aplicado", description: "O catálogo local foi sobrescrito (localStorage)." });
    } catch (e: any) {
      toast({ title: "Falha ao aplicar override", description: e?.message || "Erro ao salvar no localStorage", variant: "destructive" });
    }
  };
  const handleClear = async () => {
    try {
      setModelCatalogOverride(null);
      const fresh = await fetchModelCatalog();
      setBaseCatalog(fresh);
      setWorking(fresh ? JSON.parse(JSON.stringify(fresh)) : {} as any);
      toast({ title: "Override limpo", description: "Voltamos ao catálogo público." });
    } catch (e: any) {
      toast({ title: "Falha ao limpar override", description: e?.message || "Erro ao limpar localStorage", variant: "destructive" });
    }
  };
  const handleReload = async () => {
    try {
      setModelCatalogOverride(null); // garante recarregar do arquivo
      const fresh = await fetchModelCatalog();
      setBaseCatalog(fresh);
      setWorking(fresh ? JSON.parse(JSON.stringify(fresh)) : {} as any);
      toast({ title: "Catálogo recarregado" });
    } catch (e: any) {
      toast({ title: "Falha ao recarregar", description: e?.message || "Erro ao ler arquivo público", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-sm text-muted-foreground">Carregando catálogo…</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Catálogo de Modelos</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReload}>Recarregar catálogo</Button>
          <Button variant="secondary" onClick={handleClear}>Limpar override</Button>
          <Button onClick={handleApply} className="bg-gradient-primary">Aplicar override</Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Modelos de Geração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {providers.length === 0 && (
            <div className="text-sm text-muted-foreground">Nenhum provider encontrado.</div>
          )}
          {providers.map((prov) => {
            const models = Object.keys((working as any)?.[prov] || {}).sort();
            return (
              <div key={prov} className="border rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{prov}</Badge>
                    <span className="text-xs text-muted-foreground">{models.length} modelos</span>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {models.map((mid) => {
                    const info = getCatalogGenModelInfo(working as any, prov, mid) || {} as ModelInfo;
                    return (
                      <div key={mid} className="border rounded p-3 space-y-2">
                        <div className="text-xs text-muted-foreground">{mid}</div>
                        <div className="space-y-2">
                          <div>
                            <Label>Título</Label>
                            <Input value={info.title || ""} onChange={(e) => setGenInfo(prov, mid, () => ({ ...info, title: e.target.value }))} />
                          </div>
                          <div>
                            <Label>Descrição</Label>
                            <Textarea value={info.description || ""} onChange={(e) => setGenInfo(prov, mid, () => ({ ...info, description: e.target.value }))} rows={2} />
                          </div>
                          <div>
                            <Label>Melhor para</Label>
                            <Input value={info.bestFor || ""} onChange={(e) => setGenInfo(prov, mid, () => ({ ...info, bestFor: e.target.value }))} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Modelos de Embeddings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {embeddingsProv.length === 0 && (
            <div className="text-sm text-muted-foreground">Nenhum provider de embeddings encontrado.</div>
          )}
          {embeddingsProv.map((prov) => {
            const models = Object.keys((working?.embeddings as any)?.[prov] || {}).sort();
            return (
              <div key={prov} className="border rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{prov}</Badge>
                    <span className="text-xs text-muted-foreground">{models.length} modelos</span>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {models.map((mid) => {
                    const info = getCatalogEmbeddingModelInfo(working as any, prov, mid) || {} as ModelInfo;
                    return (
                      <div key={mid} className="border rounded p-3 space-y-2">
                        <div className="text-xs text-muted-foreground">{mid}</div>
                        <div className="space-y-2">
                          <div>
                            <Label>Título</Label>
                            <Input value={info.title || ""} onChange={(e) => setEmbInfo(prov, mid, () => ({ ...info, title: e.target.value }))} />
                          </div>
                          <div>
                            <Label>Descrição</Label>
                            <Textarea value={info.description || ""} onChange={(e) => setEmbInfo(prov, mid, () => ({ ...info, description: e.target.value }))} rows={2} />
                          </div>
                          <div>
                            <Label>Melhor para</Label>
                            <Input value={info.bestFor || ""} onChange={(e) => setEmbInfo(prov, mid, () => ({ ...info, bestFor: e.target.value }))} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
