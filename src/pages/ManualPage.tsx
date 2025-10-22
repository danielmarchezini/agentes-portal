import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useApp } from '@/contexts/AppContext';
import { AlertTriangle } from 'lucide-react';

export default function ManualPage() {
  const { currentUser } = useApp();
  const role = currentUser?.role || 'member';
  const allowed = role === 'owner' || role === 'admin';

  if (!allowed) {
    return (
      <div className="max-w-5xl mx-auto">
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Acesso não autorizado</CardTitle>
            <CardDescription>Esta página é restrita a Administradores e Especialistas em IA (owner/admin).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 text-amber-700">
              <AlertTriangle className="w-5 h-5" />
              <p className="text-sm">Se você precisa de acesso, solicite a um administrador de sua organização.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-4 animate-fade-in prose-like">
      {/* Header no padrão Organization */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manual</h1>
          <p className="text-muted-foreground">Guia completo de configurações, conceitos e operações para Administradores e Especialistas em IA</p>
        </div>
        <div className="flex gap-2">
          <a href="#topo" className="px-3 py-1.5 text-sm rounded border hover:bg-accent">Voltar ao topo</a>
          <button
            className="px-3 py-1.5 text-sm rounded bg-gradient-primary text-primary-foreground shadow-primary hover:opacity-95"
            onClick={() => window.print()}
          >
            Exportar PDF
          </button>
        </div>
      </div>

      <Card className="shadow-elegant">
        <CardHeader id="topo">
          <CardTitle>Sumário</CardTitle>
          <CardDescription>Use como índice rápido</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <ol className="list-decimal pl-6 space-y-1">
            <li><a href="#conceitos" className="underline">Conceitos-chave</a></li>
            <li><a href="#config-agente" className="underline">Configurações por Agente</a></li>
            <li><a href="#paginas" className="underline">Páginas do Sistema</a>
              <ul className="list-disc pl-6">
                <li><a href="#agents-sharing" className="underline">/agents/sharing</a></li>
                <li><a href="#chat-history" className="underline">/chat/history</a></li>
                <li><a href="#audit" className="underline">/audit</a></li>
                <li><a href="#agents-requests" className="underline">/agents/requests</a></li>
              </ul>
            </li>
            <li><a href="#operacoes-admin" className="underline">Operações do Administrador</a></li>
            <li><a href="#boas-praticas" className="underline">Boas práticas</a></li>
            <li><a href="#refs-tecnicas" className="underline">Referências técnicas</a></li>
          </ol>
        </CardContent>
      </Card>

      <Card className="shadow-elegant">
        <CardHeader id="conceitos">
          <CardTitle>Conceitos-chave</CardTitle>
          <CardDescription>Definições essenciais para operar a plataforma com segurança e eficiência</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed">
          <div>
            <h3 className="font-semibold">Contexto</h3>
            <p>Conjunto de informações enviado ao LLM a cada requisição: System Prompt, Regras da organização, Memória do usuário, Contexto RAG e histórico recente.</p>
          </div>
          <div>
            <h3 className="font-semibold">Tokens</h3>
            <p>Unidades de custo de processamento dos LLMs. Controlamos o envio com limite por agente e sumarização.</p>
          </div>
          <div>
            <h3 className="font-semibold">Sumarização</h3>
            <p>Resumo persistente do histórico quando o limiar de tokens é atingido, armazenado em memória de longo prazo e injetado como contexto do usuário.</p>
          </div>
          <div>
            <h3 className="font-semibold">Strict Mode</h3>
            <p>Camada de segurança em 3 etapas: anti-vazamento no System, detecção pré-envio (fishing e termos bloqueados) e sanitização pós-geração.</p>
          </div>
          <div>
            <h3 className="font-semibold">Regex e Termos Bloqueados</h3>
            <p>Lista de padrões (regex) para bloquear termos sensíveis tanto na entrada do usuário quanto na saída do agente.</p>
          </div>
          <div>
            <h3 className="font-semibold">Provider e Modelo</h3>
            <p>Provider de geração (OpenAI, Google, Anthropic, Ollama) e o modelo escolhido (ex.: gpt-4o, gemini-2.5-flash). Impactam custo/latência/qualidade.</p>
          </div>
          <div>
            <h3 className="font-semibold">Embeddings</h3>
            <p>Vetores numéricos para busca semântica no RAG Local. Seleção de provider e modelo de embeddings afeta precisão e custo.</p>
          </div>
          <div>
            <h3 className="font-semibold">KPI e Flags</h3>
            <p>Indicadores de performance exibidos no Dashboard e sinalizadores (ex.: cost_estimated) para transparência de dados estimados.</p>
          </div>
          <div>
            <h3 className="font-semibold">Template</h3>
            <p>Configuração completa de um agente salva como modelo reutilizável. Permite padronizar persona, políticas e modelos para replicar rapidamente.</p>
          </div>
          <div>
            <h3 className="font-semibold">API</h3>
            <p>Interfaces usadas para integrar com provedores de LLM e com o banco (Supabase). O app despacha prompts/respostas via HTTP seguro.</p>
          </div>
          <div>
            <h3 className="font-semibold">Trigger (Banco)</h3>
            <p>Gatilhos SQL que automatizam processos, como adicionar novos usuários ao grupo padrão ou criar registros auxiliares ao inserir dados.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-elegant">
        <CardHeader id="config-agente">
          <CardTitle>Configurações por Agente</CardTitle>
          <CardDescription>Disponíveis em Configuração do Agente</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed">
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Limite de tokens do histórico</strong>: controla custo e mantém coerência do diálogo.</li>
            <li><strong>Ativar sumarização</strong>: ativa memória de longo prazo.</li>
            <li><strong>Limiar para sumarização (tokens)</strong>: quando excedido, gera/atualiza sumário.</li>
            <li><strong>Máx. caracteres do sumário</strong>: tamanho alvo do sumário persistente.</li>
            <li><strong>Instruções Adicionais</strong>: concatenadas ao System Prompt como Regras da organização.</li>
            <li><strong>Strict Mode</strong>: ativa bloqueios e sanitização.</li>
            <li><strong>Termos bloqueados (regex)</strong>: padrões sensíveis proibidos.</li>
            <li><strong>Provider de geração</strong> e <strong>Modelo de IA</strong>: definem o cérebro do agente.</li>
            <li><strong>Provider de embeddings (RAG Local)</strong> e <strong>Modelo de embeddings</strong>: definem a precisão da busca semântica.</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="shadow-elegant">
        <CardHeader id="paginas">
          <CardTitle>Páginas do Sistema</CardTitle>
          <CardDescription>O que cada página oferece e quando usar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm leading-relaxed">
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Dashboard</strong>: visão geral rápida; atalhos e destaques.</li>
            <li><strong>Executive Dashboard</strong>: KPIs de Tokens, Gasto (com badge "estimado"), Conversas; Top Agentes por Custo; painel de depuração de uso.</li>
            <li><strong>Agent Config</strong>: criação/edição de agentes; seções de Modelo & Prompt, Memória & Contexto, Segurança & Políticas e Compartilhamento.</li>
            <li><strong>Agent Chat</strong>: interface conversacional; suporta múltiplos provedores e políticas ativas de segurança/memória.</li>
            <li><strong>User Groups</strong>: gestão de grupos; auxilia compartilhamento por papéis/equipes; integra com grupo padrão via triggers.</li>
            <li><strong>Users</strong>: convites, edição e papéis; fundamental para governança de acesso.</li>
            <li><strong>Organization/Permissions/Settings</strong>: módulos e políticas da organização; chaves de API dos provedores.</li>
            <li><strong>Audit</strong>: rastreio e logs de operações sensíveis (quando habilitado).</li>
            <li><strong>Chat History</strong>: histórico de conversas para análise, suporte e compliance.</li>
            <li><strong>Marketplace/Templates</strong>: catálogo interno; acelera criação por meio de templates.</li>
          </ul>

          {/* Seções detalhadas solicitadas */}
          <div id="agents-sharing" className="pt-4">
            <h4 className="font-semibold text-base">/agents/sharing — Compartilhamento de Agentes</h4>
            <p className="mt-1">Permite definir quem pode ver/usar um agente. Três modalidades:</p>
            <ul className="list-disc pl-6 mt-1">
              <li><strong>Público (organização)</strong>: todos os usuários da org têm acesso.</li>
              <li><strong>Usuários específicos</strong>: por e-mail/ID de usuário.</li>
              <li><strong>Grupos</strong>: usando a página de <em>User Groups</em> (recomendado para escala).</li>
            </ul>
            <p className="mt-2"><strong>Quando usar</strong>: ao publicar um agente novo, padronize para o <em>Grupo Padrão</em> — usuários entram automaticamente via triggers.</p>
            <p className="mt-1"><strong>Tecnicamente</strong>: persiste em <code>public.agent_shares</code> (backend) relacionando <code>agent_id</code> ao <code>target_type</code> (public/user/group). A UI consulta e atualiza via Supabase.</p>
            <p className="mt-1"><strong>Boas práticas</strong>: prefira grupos; evite múltiplas entradas por usuário para reduzir manutenção.</p>
          </div>

          <div id="chat-history" className="pt-4">
            <h4 className="font-semibold text-base">/chat/history — Histórico de Conversas</h4>
            <p className="mt-1">Lista conversas por dia/agente, com filtros. Útil para suporte, auditoria leve e análises de uso.</p>
            <p className="mt-1"><strong>Tecnicamente</strong>: usa RPCs como <code>list_chat_history_by_day</code> (parâmetros de período, agente, status). Integra com <code>public.agent_token_usage</code> para cruzar uso e custo.</p>
            <p className="mt-1"><strong>Boas práticas</strong>: combine com o Executive Dashboard para identificar outliers de custo e analisar conversas correlatas.</p>
          </div>

          <div id="audit" className="pt-4">
            <h4 className="font-semibold text-base">/audit — Auditoria</h4>
            <p className="mt-1">Rastreia ações administrativas e eventos sensíveis (ex.: mudanças de permissões, compartilhamentos, exclusões).</p>
            <p className="mt-1"><strong>Tecnicamente</strong>: consulta tabela de auditoria (ex.: <code>public.audit_logs</code>) com RLS. Cada ação do app deve registrar <em>quem</em>, <em>quando</em>, <em>o quê</em>.</p>
            <p className="mt-1"><strong>Boas práticas</strong>: retenção alinhada a compliance; filtros por usuário e período; export conforme política interna.</p>
          </div>

          <div id="agents-requests" className="pt-4">
            <h4 className="font-semibold text-base">/agents/requests — Solicitações de Agentes</h4>
            <p className="mt-1">Workflow para usuários pedirem novos agentes ou alterações em agentes. Centraliza demanda e priorização.</p>
            <p className="mt-1"><strong>Tecnicamente</strong>: tabela (ex.: <code>public.agent_requests</code>) com status, requerente e justificativa. Integra com notificações e permissões.</p>
            <p className="mt-1"><strong>Boas práticas</strong>: padronize templates de pedido; defina SLAs e critérios de aprovação.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-elegant">
        <CardHeader id="operacoes-admin">
          <CardTitle>Operações do Administrador</CardTitle>
          <CardDescription>Passo a passo do dia a dia</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm leading-relaxed">
          <ol className="list-decimal pl-6 space-y-1">
            <li><strong>Primeiro acesso</strong>: configure chaves de API dos provedores na organização.</li>
            <li><strong>Criar grupos</strong>: crie o grupo Padrão (se necessário). Triggers adicionam novos usuários automaticamente.</li>
            <li><strong>Criar usuários</strong>: convide por e-mail e atribua papéis.</li>
            <li><strong>Criar agentes</strong>: defina modelo, prompt, memória e políticas; compartilhe com usuários/grupos.</li>
            <li><strong>Monitorar</strong>: use o Dashboard Executivo para custos, tokens e conversas. Observe badges de custo estimado.</li>
          </ol>
          <div className="mt-3">
            <h4 className="font-semibold">Dicas de compartilhamento</h4>
            <ul className="list-disc pl-6 space-y-1">
              <li>Publique para <strong>Grupo Padrão</strong> para acesso amplo imediato.</li>
              <li>Use <strong>Grupos</strong> por área (RH, Vendas) para controlar visibilidade.</li>
              <li>Compartilhamento por <strong>usuários específicos</strong> para casos sensíveis/pilotos.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-elegant">
        <CardHeader id="boas-praticas">
          <CardTitle>Boas práticas</CardTitle>
          <CardDescription>Recomendações para qualidade e segurança</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm leading-relaxed">
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>System Prompt</strong> deve conter regras prioritárias e persona.</li>
            <li><strong>Strict Mode</strong> ligado por padrão.</li>
            <li><strong>Termos bloqueados</strong> com regex específicas para seu domínio.</li>
            <li><strong>Sumarização</strong> para conversas longas; injete como Memória do usuário, nunca regras internas.</li>
            <li><strong>Ajuste de limite de tokens</strong> por agente conforme custo e uso.</li>
            <li><strong>Modelos econômicos</strong> para tarefas simples; modelos premium para raciocínio complexo.</li>
            <li><strong>Rastreie custos</strong> e observe o badge "estimado" para entendimento de precisão.</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="shadow-elegant">
        <CardHeader id="refs-tecnicas">
          <CardTitle>Referências técnicas</CardTitle>
          <CardDescription>Onde encontrar e ajustar comportamentos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm leading-relaxed">
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Chat</strong>: lógica de envio, segurança e memória — <code>src/pages/AgentChatPage.tsx</code></li>
            <li><strong>Configuração do Agente</strong>: UI e persistência de políticas — <code>src/pages/AgentConfigPage.tsx</code></li>
            <li><strong>Dashboard Executivo</strong>: KPIs e custos estimados — <code>src/pages/ExecutiveDashboardPage.tsx</code></li>
            <li><strong>Preços</strong>: cálculo de custo por tokens — <code>src/lib/pricing.ts</code></li>
            <li><strong>Migrações</strong>: colunas e tabelas de memória/segurança — <code>supabase/migrations/</code></li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
