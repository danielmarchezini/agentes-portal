import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Mail, Shield, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";

const Index = () => {
  const navigate = useNavigate();
  const { requestLogin, login, isAuthenticated, organization } = useApp();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [otpStep, setOtpStep] = useState<'request' | 'verify'>("request");
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const { toast } = useToast();

  // Redirect if already authenticated
  if (isAuthenticated) {
    navigate("/dashboard");
    return null;
  }

  const ALLOWLIST = (import.meta as any).env?.VITE_LOGIN_ALLOWLIST
    ? String((import.meta as any).env.VITE_LOGIN_ALLOWLIST).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    : ['dmarchezini@gmail.com'];

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    try {
      const domain = email.split("@")[1]?.toLowerCase();
      if (!domain) {
        toast({
          title: "E-mail inválido",
          description: "Informe um e-mail válido (ex.: nome@empresa.com)",
          variant: "destructive",
        });
        return;
      }

      let allowed = ALLOWLIST.includes(email.toLowerCase());
      if (!allowed) {
        // Verifica domínio via RPC no Supabase (suporta subdomínios)
        const { data, error: rpcErr } = await supabase.rpc('is_domain_allowed', { p_domain: domain });
        if (rpcErr) {
          toast({
            title: "Erro ao verificar domínio",
            description: rpcErr.message || "Tente novamente em instantes.",
            variant: "destructive",
          });
          return;
        }
        allowed = !!data;
      }

      if (!allowed) {
        toast({
          title: "Verificação de domínio",
          description: "Se o domínio informado pertencer a uma organização cadastrada, você receberá um e-mail com o link de acesso.",
        });
        return;
      }

      const { error } = await requestLogin(email);
      if (error) {
        throw error;
      }
      toast({
        title: "Código enviado!",
        description: `Enviamos um código de verificação para ${email}. Verifique sua caixa de entrada (e spam).`,
      });
      setOtpStep('verify');
      setResendCooldown(60);
    } catch (error: any) {
      const msg = String(error?.message || 'Falha ao enviar e-mail');
      const throttled = /rate|thrott/i.test(msg);
      toast({
        title: throttled ? "Muitas tentativas" : "Erro ao enviar e-mail",
        description: throttled ? "Aguarde alguns segundos antes de solicitar um novo código." : (msg || "Não foi possível enviar o código de acesso."),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpDigits.join("");
    if (!email || code.length < 6) return;
    setIsLoading(true);
    try {
      const ok = await login(email, code);
      if (!ok) throw new Error('Código inválido ou expirado.');
      toast({ title: 'Autenticado com sucesso!' });
      navigate('/dashboard');
    } catch (error: any) {
      toast({ title: 'Falha na verificação', description: error?.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  useEffect(() => {
    if (otpStep === 'verify') {
      // Foco no primeiro campo ao entrar na etapa de verificação
      setTimeout(() => otpRefs.current[0]?.focus(), 0);
    }
  }, [otpStep]);

  const handleResend = async () => {
    if (resendCooldown > 0 || !email) return;
    setIsLoading(true);
    try {
      const { error } = await requestLogin(email);
      if (error) throw error;
      toast({ title: 'Código reenviado', description: `Enviamos um novo código para ${email}.` });
      setResendCooldown(60);
    } catch (e: any) {
      toast({ title: 'Falha ao reenviar', description: e?.message || 'Aguarde e tente novamente.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-surface flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            {organization?.branding?.logo ? (
              <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-primary border">
                <img 
                  src={organization.branding.logo} 
                  alt={`${organization.name} logo`}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="p-3 bg-gradient-primary rounded-2xl shadow-primary">
                <Bot className="w-8 h-8 text-primary-foreground" />
              </div>
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{organization?.name || 'AI Portal'}</h1>
            <p className="text-muted-foreground mt-2">
              Portal corporativo para gestão de agentes de IA
            </p>
          </div>
        </div>

        {/* Login Card */}
        <Card className="shadow-lg border-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Acesso Seguro</CardTitle>
            <CardDescription className="text-center">
              {otpStep === 'request' ? (
                <>Digite seu e-mail para receber um <b>código de verificação</b>. Se o domínio estiver cadastrado, você receberá o e-mail.</>
              ) : (
                <>Enviamos um <b>código de verificação</b> para {email}. Informe abaixo para entrar.</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {otpStep === 'request' ? (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div className="space-y-2">
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-gradient-primary hover:bg-primary-hover shadow-primary"
                  disabled={isLoading}
                >
                  {isLoading ? "Enviando..." : "Enviar Código"}
                </Button>
                <div className="text-center text-xs text-muted-foreground">
                  Prefere não digitar o código?{' '}
                  <button
                    type="button"
                    className="underline"
                    onClick={async () => {
                      if (!email) return;
                      setIsLoading(true);
                      try {
                        const { error } = await requestLogin(email);
                        if (error) throw error;
                        toast({ title: 'Link mágico enviado', description: `Enviamos um link de acesso para ${email}.` });
                      } catch (e: any) {
                        toast({ title: 'Falha ao enviar link', description: e?.message || 'Tente novamente mais tarde.', variant: 'destructive' });
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                  >
                    Receber link mágico por e-mail
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="flex justify-between gap-2">
                  {otpDigits.map((d, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (otpRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      className="w-12 h-12 text-center text-lg border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      value={d}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, '').slice(0, 1);
                        const next = [...otpDigits];
                        next[idx] = v;
                        setOtpDigits(next);
                        if (v && idx < 5) {
                          otpRefs.current[idx + 1]?.focus();
                        }
                      }}
                      onPaste={(e) => {
                        const text = e.clipboardData.getData('text') || '';
                        const digits = text.replace(/\D/g, '').slice(0, 6).split('');
                        if (digits.length > 0) {
                          e.preventDefault();
                          const next = [...otpDigits];
                          for (let i = 0; i < 6; i++) {
                            next[i] = digits[i] || '';
                          }
                          setOtpDigits(next);
                          const filled = digits.length >= 6 ? 5 : Math.max(0, digits.length - 1);
                          otpRefs.current[filled]?.focus();
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace') {
                          if (!otpDigits[idx] && idx > 0) {
                            const prev = idx - 1;
                            otpRefs.current[prev]?.focus();
                            const next = [...otpDigits];
                            next[prev] = '';
                            setOtpDigits(next);
                          } else {
                            const next = [...otpDigits];
                            next[idx] = '';
                            setOtpDigits(next);
                          }
                        }
                        if (e.key === 'ArrowLeft' && idx > 0) {
                          otpRefs.current[idx - 1]?.focus();
                        }
                        if (e.key === 'ArrowRight' && idx < 5) {
                          otpRefs.current[idx + 1]?.focus();
                        }
                      }}
                      onFocus={(e) => e.currentTarget.select()}
                      aria-label={`Dígito ${idx + 1} do código`}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={handleResend}
                    disabled={isLoading || resendCooldown > 0}
                  >
                    {resendCooldown > 0 ? `Reenviar (${resendCooldown}s)` : 'Reenviar código'}
                  </Button>
                  <Button 
                    type="submit" 
                    className="bg-gradient-primary hover:bg-primary-hover shadow-primary"
                    disabled={isLoading || otpDigits.join("").length < 6}
                  >
                    {isLoading ? "Verificando..." : "Verificar Código"}
                  </Button>
                </div>
                <div className="text-center text-xs text-muted-foreground">
                  Preferir link mágico?{' '}
                  <button
                    type="button"
                    className="underline"
                    onClick={async () => {
                      if (!email) return;
                      setIsLoading(true);
                      try {
                        const { error } = await requestLogin(email);
                        if (error) throw error;
                        toast({ title: 'Link mágico enviado', description: `Enviamos um link de acesso para ${email}.` });
                      } catch (e: any) {
                        toast({ title: 'Falha ao enviar link', description: e?.message || 'Tente novamente mais tarde.', variant: 'destructive' });
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                  >
                    Enviar link
                  </button>
                </div>
                <div className="text-xs text-muted-foreground text-center">Não recebeu? Verifique a caixa de spam.</div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Features */}
        <div className="grid grid-cols-1 gap-4">
          <div className="text-center space-y-4">
            <p className="text-sm font-medium text-muted-foreground">
              Recursos da plataforma:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Bot className="w-3 h-3" />
                Gestão de Agentes
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Governança IA
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Automação
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;