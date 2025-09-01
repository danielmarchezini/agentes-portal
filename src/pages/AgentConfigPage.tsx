import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Bot, Save, ArrowLeft, History, Users, MessageSquare, Sparkles, Code } from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import { useToast } from "@/hooks/use-toast";
import { Agent } from "@/contexts/AppContext";

const AgentConfigPage = () => {
  const { agentId, id } = useParams();
  const routeAgentId = agentId ?? id;
  const navigate = useNavigate();
  const { currentUser, agents, setAgents, organization } = useApp();
  const { toast } = useToast();

  const agent = agents.find(a => a.id === routeAgentId);
  const isNewAgent = !routeAgentId;

  const [agentType, setAgentType] = useState<'custom' | 'assistant'>('custom');
  const [selectedAssistant, setSelectedAssistant] = useState('');
  const [name, setName] = useState(agent?.name || "");
  const [description, setDescription] = useState(agent?.description || "");
  const [category, setCategory] = useState(agent?.category || "");
  const [model, setModel] = useState(agent?.model || "gpt-4");
  const [systemPrompt, setSystemPrompt] = useState(agent?.systemPrompt || "");
  const [tags, setTags] = useState(agent?.tags?.join(", ") || "");

  if (!currentUser) return null;

  const canEdit = isNewAgent 
    ? hasPermission(currentUser.role, "Criar um novo agente")
    : hasPermission(currentUser.role, "Editar a configuração de um agente");

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

  if (!isNewAgent && !agent) {
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

  const handleSave = () => {
    if (!name || !description || !category || !systemPrompt || !model) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    const agentData: Agent = {
      id: agent?.id || String(Date.now()),
      name,
      description,
      category,
      model,
      systemPrompt,
      status: agent?.status || 'active',
      createdBy: currentUser.id,
      createdAt: agent?.createdAt || new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      version: (agent?.version || 0) + 1,
      usageCount: agent?.usageCount || 0,
      tags: tags.split(",").map(tag => tag.trim()).filter(Boolean)
    };

    if (isNewAgent) {
      setAgents([...agents, agentData]);
      toast({
        title: "Agente criado!",
        description: "O novo agente foi criado com sucesso",
      });
    } else {
      setAgents(agents.map(a => a.id === agent?.id ? agentData : a));
      toast({
        title: "Agente atualizado!",
        description: "As configurações foram salvas com sucesso",
      });
    }

    navigate("/dashboard");
  };

  // Get available models from organization's LLM providers
  const availableModels = [];
  const availableAssistants = [];
  
  if (organization?.llmProviders) {
    for (const provider of organization.llmProviders) {
      if (provider.enabled) {
        for (const modelInfo of provider.models) {
          availableModels.push({
            value: modelInfo.id,
            label: `${modelInfo.name} (${provider.name})`,
            description: modelInfo.description,
            provider: provider.name
          });
        }

        // Add pre-built assistants for each provider
        if (provider.name === 'OpenAI') {
          availableAssistants.push(
            { value: 'gpt-4-assistant-1', label: 'Code Assistant', description: 'Especialista em desenvolvimento de código', provider: 'OpenAI' },
            { value: 'gpt-4-assistant-2', label: 'Data Analyst', description: 'Especialista em análise de dados', provider: 'OpenAI' },
            { value: 'gpt-4-assistant-3', label: 'Writing Helper', description: 'Assistente para escrita e redação', provider: 'OpenAI' }
          );
        } else if (provider.name === 'Anthropic') {
          availableAssistants.push(
            { value: 'claude-assistant-1', label: 'Research Assistant', description: 'Especialista em pesquisa e análise', provider: 'Anthropic' },
            { value: 'claude-assistant-2', label: 'Creative Writer', description: 'Assistente criativo para escrita', provider: 'Anthropic' }
          );
        } else if (provider.name === 'Google') {
          availableAssistants.push(
            { value: 'gemini-assistant-1', label: 'Gemini Pro Assistant', description: 'Assistente multimodal avançado', provider: 'Google' },
            { value: 'gemini-assistant-2', label: 'Document Helper', description: 'Especialista em processamento de documentos', provider: 'Google' }
          );
        }
      }
    }
  }
  
  // Fallback models if no providers configured
  const models = availableModels.length > 0 ? availableModels : [
    { value: "gpt-4", label: "GPT-4", description: "Modelo padrão", provider: "OpenAI" },
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo", description: "Modelo rápido", provider: "OpenAI" }
  ];

  const categories = ["Análise", "Criatividade", "Suporte", "Automação", "Pesquisa"];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
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

      <Tabs defaultValue="config" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Bot className="w-4 h-4" />
            Configuração
          </TabsTrigger>
          <TabsTrigger value="governance" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Governança
          </TabsTrigger>
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="config">
          {isNewAgent && (
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
              {agentType === 'assistant' && isNewAgent && (
                <div className="space-y-2">
                  <Label htmlFor="assistant-select">Assistente *</Label>
                  <Select value={selectedAssistant} onValueChange={(value) => {
                    setSelectedAssistant(value);
                    const assistant = availableAssistants.find(a => a.value === value);
                    if (assistant) {
                      setName(assistant.label);
                      setDescription(assistant.description);
                      setModel(assistant.value);
                      setCategory("Pré-configurado");
                      setSystemPrompt(`Você é um ${assistant.label}. ${assistant.description}.`);
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
                            <span className="text-xs text-muted-foreground">
                              {assistant.description} - {assistant.provider}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {availableAssistants.length === 0 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Nenhum assistente disponível. Configure os provedores de LLM nas configurações da organização.
                    </p>
                  )}
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
                    disabled={agentType === 'assistant' && selectedAssistant && isNewAgent}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Categoria *</Label>
                  <Select value={category} onValueChange={setCategory} disabled={agentType === 'assistant' && selectedAssistant && isNewAgent}>
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

              {agentType === 'custom' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="model">Modelo de IA</Label>
                    <Select value={model} onValueChange={setModel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um modelo de IA" />
                      </SelectTrigger>
                      <SelectContent>
                        {models.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            <div className="flex flex-col">
                              <span>{m.label}</span>
                              {m.description && (
                                <span className="text-xs text-muted-foreground">{m.description}</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {models.length === 0 && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Nenhum modelo de IA configurado. Configure os provedores de LLM nas configurações da organização.
                      </p>
                    )}
                  </div>

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
                      Este prompt define como o agente se comportará nas conversas
                    </p>
                  </div>
                </>
              )}

              {agentType === 'assistant' && (
                <div className="space-y-2">
                  <Label htmlFor="systemPrompt">Instruções Adicionais</Label>
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

              <div className="flex justify-end">
                <Button onClick={handleSave} className="bg-gradient-primary shadow-primary">
                  <Save className="w-4 h-4 mr-2" />
                  {isNewAgent ? "Criar Agente" : "Salvar Alterações"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Governance Tab */}
        <TabsContent value="governance">
          <div className="space-y-6">
            {/* Agent Information */}
            {!isNewAgent && agent && (
              <Card className="animate-scale-in">
                <CardHeader>
                  <CardTitle>Informações do Agente</CardTitle>
                  <CardDescription>
                    Histórico e metadados do agente
                  </CardDescription>
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