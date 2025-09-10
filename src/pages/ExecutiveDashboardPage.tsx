import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, TrendingDown, Users, MessageSquare, Bot, 
  DollarSign, Target, Clock, Download, Calendar 
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useApp } from '@/contexts/AppContext';
import { hasPermission } from '@/lib/permissions';

const monthlyUsageData = [
  { month: 'Jan', conversations: 450, tokens: 125000, activeUsers: 85 },
  { month: 'Fev', conversations: 620, tokens: 178000, activeUsers: 92 },
  { month: 'Mar', conversations: 780, tokens: 234000, activeUsers: 108 },
  { month: 'Abr', conversations: 890, tokens: 267000, activeUsers: 115 },
  { month: 'Mai', conversations: 1200, tokens: 345000, activeUsers: 134 },
  { month: 'Jun', conversations: 1450, tokens: 412000, activeUsers: 147 }
];

const agentUsageData = [
  { name: 'Vendas', value: 35, color: '#8884d8' },
  { name: 'Suporte', value: 28, color: '#82ca9d' },
  { name: 'Marketing', value: 22, color: '#ffc658' },
  { name: 'RH', value: 10, color: '#ff7c7c' },
  { name: 'Outros', value: 5, color: '#8dd1e1' }
];

const satisfactionData = [
  { week: 'Sem 1', satisfaction: 4.2 },
  { week: 'Sem 2', satisfaction: 4.3 },
  { week: 'Sem 3', satisfaction: 4.5 },
  { week: 'Sem 4', satisfaction: 4.7 },
  { week: 'Sem 5', satisfaction: 4.8 },
  { week: 'Sem 6', satisfaction: 4.6 }
];

const performanceMetrics = [
  { metric: 'ROI', value: '245%', change: '+12%', trend: 'up' },
  { metric: 'Custo por Interação', value: 'R$ 2,35', change: '-8%', trend: 'down' },
  { metric: 'Tempo de Resposta', value: '1.2s', change: '-15%', trend: 'down' },
  { metric: 'Taxa de Resolução', value: '89%', change: '+5%', trend: 'up' }
];

export default function ExecutiveDashboardPage() {
  const { currentUser } = useApp();

  if (!currentUser || !hasPermission(currentUser.role, 'Ver dashboard executivo')) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>
              Você não tem permissão para acessar o dashboard executivo.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Executivo</h1>
          <p className="text-muted-foreground">
            Visão estratégica e métricas de negócio
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Calendar className="h-4 w-4 mr-2" />
            Período
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar Relatório
          </Button>
        </div>
      </div>

      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Impactada</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 2.4M</div>
            <div className="flex items-center text-xs text-green-600">
              <TrendingUp className="h-3 w-3 mr-1" />
              +18% vs mês anterior
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversões</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,247</div>
            <div className="flex items-center text-xs text-green-600">
              <TrendingUp className="h-3 w-3 mr-1" />
              +24% vs mês anterior
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Economia de Tempo</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">847h</div>
            <div className="flex items-center text-xs text-muted-foreground">
              Equivalente a 5,3 FTEs
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Satisfação Geral</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4.8/5</div>
            <div className="flex items-center text-xs text-green-600">
              <TrendingUp className="h-3 w-3 mr-1" />
              +0.3 vs mês anterior
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Métricas de Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Métricas de Performance</CardTitle>
          <CardDescription>Indicadores chave de performance do sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {performanceMetrics.map((metric, index) => (
              <div key={index} className="text-center p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">{metric.metric}</div>
                <div className="text-2xl font-bold mb-2">{metric.value}</div>
                <div className={`flex items-center justify-center text-xs ${
                  metric.trend === 'up' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {metric.trend === 'up' ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  )}
                  {metric.change}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Crescimento de Uso */}
        <Card>
          <CardHeader>
            <CardTitle>Crescimento de Uso</CardTitle>
            <CardDescription>Evolução mensal de conversas e usuários ativos</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthlyUsageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="conversations"
                  stackId="1"
                  stroke="#8884d8"
                  fill="#8884d8"
                  name="Conversas"
                />
                <Area
                  type="monotone"
                  dataKey="activeUsers"
                  stackId="1"
                  stroke="#82ca9d"
                  fill="#82ca9d"
                  name="Usuários Ativos"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribuição por Agente */}
        <Card>
          <CardHeader>
            <CardTitle>Uso por Categoria de Agente</CardTitle>
            <CardDescription>Distribuição percentual do uso dos agentes</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={agentUsageData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {agentUsageData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Consumo de Tokens */}
        <Card>
          <CardHeader>
            <CardTitle>Consumo de Tokens</CardTitle>
            <CardDescription>Evolução mensal do consumo de tokens</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyUsageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value.toLocaleString()}`, 'Tokens']} />
                <Bar dataKey="tokens" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Satisfação dos Usuários */}
        <Card>
          <CardHeader>
            <CardTitle>Evolução da Satisfação</CardTitle>
            <CardDescription>Avaliação média semanal dos usuários</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={satisfactionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis domain={[4.0, 5.0]} />
                <Tooltip formatter={(value) => [`${value}`, 'Satisfação']} />
                <Line
                  type="monotone"
                  dataKey="satisfaction"
                  stroke="#82ca9d"
                  strokeWidth={3}
                  dot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Resumo Executivo */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo Executivo</CardTitle>
          <CardDescription>Principais insights e recomendações</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border-l-4 border-green-500 pl-4">
              <h4 className="font-semibold text-green-700">Crescimento Acelerado</h4>
              <p className="text-sm text-muted-foreground">
                O uso de agentes cresceu 87% nos últimos 3 meses, com forte adoção na área de vendas.
              </p>
            </div>
            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-semibold text-blue-700">ROI Positivo</h4>
              <p className="text-sm text-muted-foreground">
                ROI de 245% demonstra excelente retorno do investimento em IA conversacional.
              </p>
            </div>
            <div className="border-l-4 border-yellow-500 pl-4">
              <h4 className="font-semibold text-yellow-700">Oportunidade de Expansão</h4>
              <p className="text-sm text-muted-foreground">
                Áreas de RH e Financeiro mostram baixa adoção, representando oportunidades de crescimento.
              </p>
            </div>
            <div className="border-l-4 border-purple-500 pl-4">
              <h4 className="font-semibold text-purple-700">Melhoria Contínua</h4>
              <p className="text-sm text-muted-foreground">
                Satisfação dos usuários aumentou consistentemente, indicando melhorias na qualidade dos agentes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}