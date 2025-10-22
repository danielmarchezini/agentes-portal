import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '@/contexts/AppContext'
import { supabase } from '@/lib/supabaseClient'

const Logout = () => {
  const { logout } = useApp()
  const navigate = useNavigate()

  useEffect(() => {
    const doLogout = async () => {
      try {
        // Tenta encerrar sessão no Supabase explicitamente
        await supabase.auth.signOut()
        // Também atualiza o estado global
        await logout()
      } finally {
        // Força um reload para limpar qualquer estado residual do Vite/React
        window.location.replace('/')
      }
    }
    doLogout()
  }, [logout, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Saindo...</p>
    </div>
  )
}

export default Logout
