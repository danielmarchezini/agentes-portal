import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useApp } from "@/contexts/AppContext"
import { Bot, Users, MessageSquare, TrendingUp, Clock, Shield } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export function DashboardStats() {
  const { agents, users } = useApp()

  const activeAgents = agents.filter(agent => agent.status === 'active').length
  const totalUsers = users.length
  const activeUsers = users.filter(user => user.status === 'active').length
  const totalUsage = agents.reduce((sum, agent) => sum + (agent.usageCount || 0), 0)
  
  // Mock data for recent activity
  const recentChats = 45
  const avgResponseTime = 2.3

  const stats = [
    {
      title: "Agentes Ativos",
      value: activeAgents,
      total: agents.length,
      icon: Bot,
      description: "Agentes em funcionamento",
      trend: "+12% vs mês passado"
    },
    {
      title: "Usuários Ativos",
      value: activeUsers,
      total: totalUsers,
      icon: Users,
      description: "Usuários da plataforma",
      trend: "+5% vs mês passado"
    },
    {
      title: "Conversas Hoje",
      value: recentChats,
      icon: MessageSquare,
      description: "Interações realizadas",
      trend: "+23% vs ontem"
    },
    {
      title: "Uso Total",
      value: totalUsage,
      icon: TrendingUp,
      description: "Total de interações",
      trend: "+18% vs mês passado"
    },
    {
      title: "Tempo Resposta",
      value: `${avgResponseTime}s`,
      icon: Clock,
      description: "Tempo médio de resposta",
      trend: "-15% vs mês passado"
    },
    {
      title: "Disponibilidade",
      value: "99.8%",
      icon: Shield,
      description: "Uptime da plataforma",
      trend: "Estável"
    }
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 animate-fade-in">
      {stats.map((stat, index) => {
        const Icon = stat.icon
        return (
          <Card key={stat.title} className="hover-scale">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {stat.value}
                {stat.total && (
                  <span className="text-sm text-muted-foreground font-normal">
                    /{stat.total}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary" className="text-xs">
                  {stat.trend}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}