import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Bot, Plus, Search, Filter, MessageSquare, Users, BarChart } from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import { Link } from "react-router-dom";

const Dashboard = () => {
  const { currentUser, agents } = useApp();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  if (!currentUser) return null;

  const categories = ["all", "Análise", "Criatividade", "Suporte"];
  
  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         agent.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || agent.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const canCreateAgent = hasPermission(currentUser.role, "Criar um novo agente");

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success text-success-foreground';
      case 'inactive': return 'bg-muted text-muted-foreground';
      case 'pending': return 'bg-warning text-warning-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard de Agentes</h1>
          <p className="text-muted-foreground">
            Gerencie e interaja com os agentes de IA da sua organização
          </p>
        </div>
        {canCreateAgent && (
          <Button asChild className="bg-gradient-primary hover:bg-primary-hover shadow-primary">
            <Link to="/agents/new">
              <Plus className="w-4 h-4 mr-2" />
              Criar Novo Agente
            </Link>
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="animate-scale-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Agentes</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agents.length}</div>
            <p className="text-xs text-muted-foreground">
              {agents.filter(a => a.status === 'active').length} ativos
            </p>
          </CardContent>
        </Card>

        <Card className="animate-scale-in" style={{ animationDelay: '0.1s' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Interações Hoje</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,234</div>
            <p className="text-xs text-muted-foreground">
              +12% em relação a ontem
            </p>
          </CardContent>
        </Card>

        <Card className="animate-scale-in" style={{ animationDelay: '0.2s' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">89</div>
            <p className="text-xs text-muted-foreground">
              +5 novos esta semana
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar agentes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className={selectedCategory === category ? "bg-gradient-primary" : ""}
            >
              {category === "all" ? "Todos" : category}
            </Button>
          ))}
        </div>
      </div>

      {/* Agents Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredAgents.map((agent, index) => (
          <Card 
            key={agent.id} 
            className="hover:shadow-lg transition-all duration-200 hover:-translate-y-1 cursor-pointer animate-scale-in"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-primary rounded-lg shadow-primary">
                    <Bot className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                    <Badge variant="secondary" className="mt-1">
                      {agent.category}
                    </Badge>
                  </div>
                </div>
                <Badge className={getStatusColor(agent.status)}>
                  {agent.status === 'active' ? 'Ativo' : 
                   agent.status === 'inactive' ? 'Inativo' : 'Pendente'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-4">
                {agent.description}
              </CardDescription>
              
              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                <div className="flex items-center gap-1">
                  <MessageSquare className="w-4 h-4" />
                  {agent.usageCount} usos
                </div>
                <div className="flex items-center gap-1">
                  <BarChart className="w-4 h-4" />
                  v{agent.version}
                </div>
              </div>

              <div className="flex flex-wrap gap-1 mb-4">
                {agent.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {agent.tags.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{agent.tags.length - 3}
                  </Badge>
                )}
              </div>

              <div className="flex gap-2">
                <Button 
                  asChild
                  size="sm" 
                  className="flex-1 bg-gradient-primary hover:bg-primary-hover"
                >
                  <Link to={`/agents/${agent.id}/chat`}>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Chat
                  </Link>
                </Button>
                {hasPermission(currentUser.role, "Editar a configuração de um agente") && (
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/agents/edit/${agent.id}`}>
                      Configurar
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredAgents.length === 0 && (
        <div className="text-center py-12">
          <Bot className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhum agente encontrado</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm || selectedCategory !== "all" 
              ? "Tente ajustar os filtros de busca"
              : "Comece criando seu primeiro agente de IA"
            }
          </p>
          {canCreateAgent && !searchTerm && selectedCategory === "all" && (
            <Button asChild className="bg-gradient-primary hover:bg-primary-hover shadow-primary">
              <Link to="/agents/new">
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeiro Agente
              </Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;