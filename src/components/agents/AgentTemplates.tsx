import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Bot, Copy, Plus, Search, Filter } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface AgentTemplate {
  id: string
  name: string
  description: string
  category: string
  model: string
  systemPrompt: string
  tags: string[]
  usageCount: number
  rating: number
}

const agentTemplates: AgentTemplate[] = [
  {
    id: '1',
    name: 'Assistente de Redação',
    description: 'Especializado em criação de conteúdo, blogs e artigos profissionais',
    category: 'Criatividade',
    model: 'gpt-4',
    systemPrompt: 'Você é um especialista em redação e criação de conteúdo. Ajude a criar textos claros, envolventes e bem estruturados para diversos fins: blogs, artigos, posts em redes sociais, newsletters e materiais de marketing. Sempre considere o tom da marca e o público-alvo.',
    tags: ['redação', 'conteúdo', 'marketing', 'blog'],
    usageCount: 156,
    rating: 4.8
  },
  {
    id: '2',
    name: 'Analista de Dados',
    description: 'Interpreta dados, cria insights e gera relatórios executivos',
    category: 'Análise',
    model: 'gpt-4',
    systemPrompt: 'Você é um analista de dados experiente. Ajude a interpretar dados, identificar padrões, criar visualizações e gerar insights acionáveis. Sempre apresente conclusões de forma clara e objetiva, com recomendações práticas baseadas nos dados.',
    tags: ['dados', 'análise', 'relatórios', 'insights'],
    usageCount: 203,
    rating: 4.9
  },
  {
    id: '3',
    name: 'Especialista em Email Marketing',
    description: 'Cria campanhas de email marketing eficazes e personalizadas',
    category: 'Marketing',
    model: 'gpt-4',
    systemPrompt: 'Você é um especialista em email marketing. Ajude a criar campanhas de email eficazes, linhas de assunto atrativas, copy persuasivo e sequências de automação. Foque em conversão, personalização e relacionamento com o cliente.',
    tags: ['email', 'marketing', 'campanhas', 'conversão'],
    usageCount: 89,
    rating: 4.7
  },
  {
    id: '4',
    name: 'Consultor de SEO',
    description: 'Otimiza conteúdo para mecanismos de busca e melhora rankings',
    category: 'SEO',
    model: 'gpt-4',
    systemPrompt: 'Você é um consultor de SEO experiente. Ajude a otimizar conteúdo para mecanismos de busca, pesquisar palavras-chave, analisar competidores e criar estratégias de SEO técnico e de conteúdo para melhorar rankings e tráfego orgânico.',
    tags: ['seo', 'otimização', 'keywords', 'ranking'],
    usageCount: 134,
    rating: 4.6
  },
  {
    id: '5',
    name: 'Especialista em Atendimento',
    description: 'Fornece suporte ao cliente personalizado e resolve problemas',
    category: 'Suporte',
    model: 'gpt-3.5-turbo',
    systemPrompt: 'Você é um especialista em atendimento ao cliente. Seja sempre educado, empático e proativo na resolução de problemas. Escute atentamente as necessidades dos clientes e forneça soluções claras e eficazes, sempre mantendo um tom profissional e acolhedor.',
    tags: ['atendimento', 'suporte', 'clientes', 'resolução'],
    usageCount: 267,
    rating: 4.8
  },
  {
    id: '6',
    name: 'Criador de Cursos',
    description: 'Desenvolve currículo educacional e material didático estruturado',
    category: 'Educação',
    model: 'gpt-4',
    systemPrompt: 'Você é um especialista em design educacional. Ajude a criar currículos estruturados, material didático engajante e avaliações eficazes. Foque em metodologias ativas de aprendizagem e adaptação ao perfil dos estudantes.',
    tags: ['educação', 'cursos', 'didática', 'currículo'],
    usageCount: 78,
    rating: 4.5
  }
]

export function AgentTemplates() {
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const { toast } = useToast()

  const categories = ['all', ...Array.from(new Set(agentTemplates.map(t => t.category)))]
  
  const filteredTemplates = agentTemplates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const handleUseTemplate = (template: AgentTemplate) => {
    // Here you would typically redirect to agent creation with pre-filled data
    toast({
      title: "Template aplicado!",
      description: `O template "${template.name}" foi carregado para criação do agente.`,
    })
    setSelectedTemplate(null)
  }

  const handleCopyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt)
    toast({
      title: "Prompt copiado!",
      description: "O prompt foi copiado para a área de transferência.",
    })
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Templates de Agentes</h2>
          <p className="text-muted-foreground">
            Biblioteca de prompts pré-configurados para diferentes casos de uso
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {categories.slice(1).map(category => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="hover-scale cursor-pointer transition-all">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                </div>
                <Badge variant="secondary">{template.category}</Badge>
              </div>
              <CardDescription className="line-clamp-2">
                {template.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1">
                  {template.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {template.tags.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{template.tags.length - 3}
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{template.usageCount} usos</span>
                  <span>★ {template.rating}</span>
                </div>

                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => setSelectedTemplate(template)}
                      >
                        Ver Detalhes
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Bot className="h-5 w-5" />
                          {template.name}
                        </DialogTitle>
                        <DialogDescription>
                          {template.description}
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Categoria</Label>
                            <p className="text-sm text-muted-foreground">{template.category}</p>
                          </div>
                          <div>
                            <Label>Modelo</Label>
                            <p className="text-sm text-muted-foreground">{template.model}</p>
                          </div>
                        </div>

                        <div>
                          <Label>Tags</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {template.tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Label>Prompt do Sistema</Label>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCopyPrompt(template.systemPrompt)}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Copiar
                            </Button>
                          </div>
                          <Textarea
                            value={template.systemPrompt}
                            readOnly
                            className="min-h-32"
                          />
                        </div>

                        <div className="flex gap-2 pt-4">
                          <Button 
                            onClick={() => handleUseTemplate(template)}
                            className="flex-1"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Usar Template
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => handleCopyPrompt(template.systemPrompt)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhum template encontrado</h3>
          <p className="text-muted-foreground">
            Tente ajustar os filtros ou busca para encontrar templates relevantes.
          </p>
        </div>
      )}
    </div>
  )
}