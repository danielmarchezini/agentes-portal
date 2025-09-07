import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'

const weeklyData = [
  { day: 'Seg', chats: 12, tokens: 1540 },
  { day: 'Ter', chats: 19, tokens: 2340 },
  { day: 'Qua', chats: 15, tokens: 1890 },
  { day: 'Qui', chats: 25, tokens: 3200 },
  { day: 'Sex', chats: 22, tokens: 2800 },
  { day: 'Sáb', chats: 8, tokens: 1020 },
  { day: 'Dom', chats: 5, tokens: 650 }
]

const agentUsageData = [
  { name: 'Análise', value: 35, color: '#0ea5e9' },
  { name: 'Marketing', value: 25, color: '#8b5cf6' },
  { name: 'Suporte', value: 20, color: '#10b981' },
  { name: 'Outros', value: 20, color: '#f59e0b' }
]

const monthlyTrendData = [
  { month: 'Jan', users: 20, agents: 3 },
  { month: 'Fev', users: 25, agents: 4 },
  { month: 'Mar', users: 30, agents: 5 },
  { month: 'Abr', users: 28, agents: 6 },
  { month: 'Mai', users: 35, agents: 7 },
  { month: 'Jun', users: 42, agents: 8 }
]

export function UsageChart() {
  return (
    <div className="grid gap-6 md:grid-cols-2 animate-fade-in">
      {/* Weekly Activity */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Atividade Semanal</CardTitle>
          <CardDescription>
            Conversas e tokens utilizados nos últimos 7 dias
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="chats" fill="hsl(var(--primary))" name="Conversas" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Agent Usage Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Uso por Categoria</CardTitle>
          <CardDescription>
            Distribuição de uso dos agentes por categoria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={agentUsageData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}%`}
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

      {/* Monthly Growth */}
      <Card>
        <CardHeader>
          <CardTitle>Crescimento Mensal</CardTitle>
          <CardDescription>
            Evolução de usuários e agentes ao longo do tempo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={monthlyTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="users" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                name="Usuários"
              />
              <Line 
                type="monotone" 
                dataKey="agents" 
                stroke="hsl(var(--success))" 
                strokeWidth={2}
                name="Agentes"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}