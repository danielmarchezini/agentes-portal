# Deploy Manual da Edge Function chat-anthropic

## Passos para deploy

### 1. Acessar o painel do Supabase
- Acesse https://app.supabase.com
- Faça login com sua conta
- Selecione o projeto "portal-agentes-de-ia-coporativo"

### 2. Navegar até as Edge Functions
- No menu lateral, clique em "Edge Functions"
- Você verá a lista de funções existentes

### 3. Criar a função chat-anthropic
- Clique em "Create new function"
- Nome da função: `chat-anthropic`
- Selecione "Custom" como template
- Clique em "Create"

### 4. Substituir o código
- Após criar, você verá um editor de código
- Substitua todo o conteúdo pelo código abaixo:

```typescript
// deno-lint-ignore-file no-explicit-any
// Edge Function: chat-anthropic
// Centraliza chamadas de chat com Anthropic no servidor (usa chave por organização via RPC)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// Shim de tipos para o lint do IDE (Node/TS) reconhecer o objeto Deno em tempo de edição.
// Isso não afeta a execução na Edge Function (que já fornece Deno no runtime).
declare const Deno: {
  env: { get(key: string): string | undefined }
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type ChatRequest = {
  organization_id?: string | null;
  agent_id: string;
  model?: string;
  temperature?: number;
  system?: string;
  history: Array<{ role: 'user'|'assistant'|'system'; content: string }>;
  debug_ok_errors?: boolean;
};

serve(async (req) => {
  // Flag de depuração controlado pelo payload (inicialmente falso)
  let debug_ok_errors = false;
  
  // Helper central para respostas JSON com CORS e, se debug ativo, forçar status 200 e embutir status original
  const sendJSON = (status: number, body: Record<string, any>) => {
    const effectiveStatus = debug_ok_errors && status !== 200 ? 200 : status;
    const b = debug_ok_errors && status !== 200 ? { ok: false, status, ...body } : body;
    return new Response(JSON.stringify(b), { status: effectiveStatus, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  };

  try {
    // CORS preflight handler (ecoar os headers solicitados pelo navegador)
    if (req.method === 'OPTIONS') {
      const reqHeaders = req.headers.get('Access-Control-Request-Headers') || 'authorization, x-client-info, apikey, content-type';
      const headers = { ...corsHeaders, 'Access-Control-Allow-Headers': reqHeaders } as Record<string, string>;
      return new Response('ok', { status: 200, headers });
    }

    // Parse do corpo da requisição
    const body: ChatRequest = await req.json();
    debug_ok_errors = !!body.debug_ok_errors;

    // Obter a chave da API da Anthropic para a organização
    const apiKeyResult = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/get_llm_api_key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      },
      body: JSON.stringify({
        p_organization_id: body.organization_id,
        p_provider: 'anthropic'
      })
    });

    if (!apiKeyResult.ok) {
      return sendJSON(500, { error: 'Failed to fetch API key', details: await apiKeyResult.text() });
    }

    const apiKeyData = await apiKeyResult.json();
    const apiKey = apiKeyData;

    if (!apiKey) {
      return sendJSON(400, { error: 'Anthropic API Key não configurada para esta organização' });
    }

    // Preparar as mensagens para o formato da Anthropic
    // Anthropic espera apenas mensagens de usuário no histórico
    const userMessages = body.history
      .filter(msg => msg.role === 'user')
      .map(msg => ({ role: 'user', content: msg.content }));

    // Adicionar a mensagem atual do usuário
    const lastMessage = body.history[body.history.length - 1];
    if (lastMessage && lastMessage.role === 'user') {
      userMessages.push({ role: 'user', content: lastMessage.content });
    }

    // Fazer a chamada para a API da Anthropic
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'User-Agent': 'portal-agentes/1.0'
      },
      body: JSON.stringify({
        model: body.model || 'claude-3-sonnet-20240229',
        max_tokens: 4096,
        temperature: body.temperature || 0.7,
        system: body.system,
        messages: userMessages
      })
    });

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text();
      console.error('Anthropic API Error:', {
        status: anthropicResponse.status,
        error: errorText
      });
      return sendJSON(anthropicResponse.status, { 
        error: 'Anthropic API Error', 
        details: errorText,
        status: anthropicResponse.status 
      });
    }

    const anthropicData = await anthropicResponse.json();
    
    // Retornar a resposta no formato esperado pelo frontend
    return sendJSON(200, {
      output_text: anthropicData.content[0].text,
      usage: anthropicData.usage,
      model: anthropicData.model,
      id: anthropicData.id
    });

  } catch (error) {
    console.error('Error in chat-anthropic:', error);
    return sendJSON(500, { 
      error: 'Internal Server Error', 
      details: error.message 
    });
  }
});
```

### 5. Deploy da função
- Clique no botão "Deploy" no canto superior direito
- Aguarde o deploy ser concluído

### 6. Configurar variáveis de ambiente (se necessário)
- Verifique se as variáveis de ambiente estão configuradas:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Se não estiverem, vá em "Settings" → "Edge Functions" → "Environment Variables"

### 7. Testar a função
- Após o deploy, você pode testar a função usando o frontend
- Tente enviar uma mensagem com um agente configurado para usar Anthropic

## Verificação

Para verificar se a função está funcionando corretamente:

1. Abra o console do navegador (F12)
2. Tente enviar uma mensagem com um agente Anthropic
3. Verifique se não há erros de CORS no console
4. Verifique se a resposta é recebida corretamente

## Solução de Problemas

Se encontrar problemas:

1. **Erro 404**: Verifique se a função foi deployada corretamente
2. **Erro de CORS**: Verifique os headers CORS na função
3. **Erro de API Key**: Verifique se a chave da Anthropic está configurada para a organização
4. **Erro 500**: Verifique os logs da Edge Function no painel do Supabase
