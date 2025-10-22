import { useEffect, useMemo, useState } from "react"
import { Bell, X, CheckCircle, AlertCircle, Info, Clock, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabaseClient"
import { useNavigate } from "react-router-dom"
import { useApp } from "@/contexts/AppContext"

interface DBNotification {
  id: string
  user_id: string
  organization_id: string | null
  type: string
  title: string
  body: string | null
  data: any
  read_at: string | null
  created_at: string
}

type UiType = 'info' | 'success' | 'warning' | 'error'
type FilterType = 'all' | 'requests' | 'system'

interface NotificationUI {
  id: string
  title: string
  message: string
  type: UiType
  timestamp: string
  read: boolean
  actionUrl?: string
  category: FilterType
}

export function NotificationCenter() {
  const { currentUser } = useApp()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<NotificationUI[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<FilterType>('all')

  const unreadCount = notifications.filter(n => !n.read).length

  const fetchNotifications = async () => {
    try {
      if (!currentUser?.id) return
      setLoading(true)
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false } as any)
        .limit(100)
      if (error) throw error
      const mapped: NotificationUI[] = (data as DBNotification[]).map((n) => {
        const cat: FilterType = n.type === 'agent_request_status' ? 'requests' : 'system'
        const uiType: UiType = n.type === 'agent_request_status'
          ? (n.data?.status === 'created' ? 'success' : n.data?.status === 'rejected' ? 'warning' : 'info')
          : 'info'
        return {
          id: n.id,
          title: n.title,
          message: n.body || '',
          type: uiType,
          timestamp: n.created_at,
          read: !!n.read_at,
          category: cat,
          actionUrl: n.data?.action_url || undefined
        }
      })
      setNotifications(mapped)
    } catch (e) {
      // noop
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchNotifications() }, [currentUser?.id])

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    try { await supabase.from('notifications').update({ read_at: new Date().toISOString() } as any).eq('id', id) } catch {}
  }

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    try { await supabase.from('notifications').update({ read_at: new Date().toISOString() } as any).is('read_at', null) } catch {}
  }

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    // Opcional: deletar do banco. Mantemos apenas no UI por enquanto.
  }

  const getNotificationIcon = (type: NotificationUI['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-success" />
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-warning" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />
      default:
        return <Info className="h-4 w-4 text-primary" />
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return 'Agora há pouco'
    if (diffInHours < 24) return `${diffInHours}h atrás`
    
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays === 1) return 'Ontem'
    if (diffInDays < 7) return `${diffInDays} dias atrás`
    
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit' 
    })
  }

  const filtered = useMemo(() => notifications.filter(n => filter === 'all' ? true : n.category === filter), [notifications, filter])

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-medium">Notificações</h4>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
              <SelectTrigger className="h-8 w-[130px]">
                <SelectValue placeholder="Filtrar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all"><span className="flex items-center gap-2"><Filter className="h-3 w-3" /> Todos</span></SelectItem>
                <SelectItem value="requests">Solicitações</SelectItem>
                <SelectItem value="system">Sistema</SelectItem>
              </SelectContent>
            </Select>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead} disabled={loading}>
                Marcar todas como lidas
              </Button>
            )}
          </div>
        </div>
        
        <ScrollArea className="h-96">
          <div className="p-2">
            {filtered.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma notificação
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {filtered.map((notification, index) => (
                  <div key={notification.id}>
                    <div 
                      className={cn(
                        "relative p-3 rounded-lg cursor-pointer transition-colors hover:bg-accent",
                        !notification.read && "bg-primary/5 border-l-2 border-l-primary"
                      )}
                      onClick={() => {
                        markAsRead(notification.id)
                        if (notification.actionUrl) {
                          setIsOpen(false)
                          navigate(notification.actionUrl)
                        }
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h5 className={cn(
                              "text-sm font-medium leading-tight",
                              !notification.read && "font-semibold"
                            )}>
                              {notification.title}
                            </h5>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation()
                                removeNotification(notification.id)
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {formatTime(notification.timestamp)}
                            </span>
                            {!notification.read && (
                              <div className="h-2 w-2 bg-primary rounded-full ml-auto" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    {index < filtered.length - 1 && (
                      <Separator className="my-1" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {filtered.length > 0 && (
          <div className="p-4 border-t">
            <Button variant="outline" className="w-full" size="sm">
              Ver todas as notificações
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}