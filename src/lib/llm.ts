import { supabase } from '@/lib/supabaseClient';

/**
 * Get full LLM API key for an organization + provider. Falls back to localStorage when orgId is undefined.
 */
export async function getLLMKey(orgId: string | undefined | null, provider: 'openai'|'anthropic'|'google'|'perplexity'|'ollama'): Promise<string> {
  const prov = provider.toLowerCase() as typeof provider;
  if (orgId) {
    // 1) Tenta a RPC canônica nova
    const r1 = await supabase.rpc('get_llm_api_key', { p_org_id: orgId, p_provider: prov });
    if (r1.error) {
      // 2) Fallback para bases antigas
      const r2 = await supabase.rpc('get_llm_secret', { p_org: orgId, p_provider: prov });
      if (r2.error) throw r2.error;
      return (r2.data as string) || '';
    }
    return (r1.data as string) || '';
  }
  // Fallback para dev/dono global sem organização (desativado em produção)
  if (import.meta.env.PROD) return '';
  const map: Record<string, string> = {
    openai: 'openai_api_key',
    anthropic: 'anthropic_api_key',
    google: 'google_api_key',
    perplexity: 'perplexity_api_key',
    ollama: 'ollama_endpoint'
  };
  return localStorage.getItem(map[provider]) || '';
}

// =============================
// Utilitários de extração (browser) para RAG Local
// =============================

/** Extrai texto de um PDF no navegador usando pdf.js (import dinâmico). */
export async function extractTextFromPdf(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  // Import dinâmico do pdf.js (legacy) e do worker, resolvido pelo Vite como URL.
  const mod = await import('pdfjs-dist/legacy/build/pdf');
  // @ts-ignore - Vite resolve o worker para uma URL válida com '?url'
  const workerUrl: string = (await import('pdfjs-dist/build/pdf.worker?url')).default as unknown as string;
  const getDocument = (mod as any).getDocument as (src: any) => any;
  const GlobalWorkerOptions = (mod as any).GlobalWorkerOptions as { workerSrc?: string };
  const setVerbosity = (mod as any).setVerbosity as ((level: number) => void) | undefined;
  const VerbosityLevel = (mod as any).VerbosityLevel as { ERRORS: number } | undefined;
  if (GlobalWorkerOptions) GlobalWorkerOptions.workerSrc = workerUrl;
  // Reduz verbosidade para evitar warnings no console (ex.: TT: undefined function: 32)
  if (setVerbosity && VerbosityLevel) setVerbosity(VerbosityLevel.ERRORS);
  const loadingTask = getDocument({ data: buf });
  const pdf = await loadingTask.promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((it: any) => (it.str || ''));
    fullText += strings.join(' ') + '\n';
  }
  return fullText;
}

/** Extrai texto de DOCX no navegador usando mammoth (import dinâmico). */
export async function extractTextFromDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  // deno-lint-ignore no-explicit-any
  // @ts-ignore - import por URL para uso em runtime no navegador
  const mammoth: any = await import('https://esm.sh/mammoth@1.7.2');
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value || '';
}

/** Ingestão local a partir de texto (útil para PDF/DOCX convertidos). */
export async function ingestLocalRAGFromTextGeneric(
  orgId: string | undefined | null,
  agentId: string,
  text: string,
  filename: string,
  embeddingProvider: 'openai'|'ollama' = 'openai',
  embeddingModel?: string
): Promise<string> {
  const chunks = chunkText(text);
  const embs = await embedTextBatch(orgId, chunks, embeddingProvider, embeddingModel);
  const { data: docIns, error: docErr } = await supabase
    .from('rag_documents')
    .insert({ organization_id: orgId, agent_id: agentId, filename, mime_type: 'text/plain', file_size: text.length })
    .select('id')
    .single();
  if (docErr) throw docErr;
  const documentId = docIns.id as string;
  for (let idx = 0; idx < chunks.length; idx++) {
    const c = chunks[idx];
    const e = embs[idx];
    const { error } = await supabase.rpc('rag_insert_chunk', {
      p_document_id: documentId,
      p_agent_id: agentId,
      p_chunk_index: idx,
      p_content: c,
      p_embedding: e,
    });
    if (error) throw error;
  }
  return documentId;
}

// =============================
// Human-friendly model info (display helpers)
// =============================

export type ModelInfo = { title: string; description: string; bestFor?: string };

// Catálogo dinâmico (público) de modelos
export type ModelCatalog = {
  [provider: string]: Record<string, ModelInfo> | any;
  embeddings?: Record<string, Record<string, ModelInfo>>;
};

let __modelCatalogCache: ModelCatalog | null = null;
export async function fetchModelCatalog(): Promise<ModelCatalog | null> {
  try {
    if (__modelCatalogCache) return __modelCatalogCache;
    // Override local (apenas client-side)
    try {
      const ov = localStorage.getItem('model_catalog_override');
      if (ov) {
        __modelCatalogCache = JSON.parse(ov) as ModelCatalog;
        return __modelCatalogCache;
      }
    } catch {}
    const res = await fetch('/model-catalog.json', { cache: 'force-cache' });
    if (!res.ok) return null;
    const json = (await res.json()) as ModelCatalog;
    __modelCatalogCache = json;
    return json;
  } catch {
    return null;
  }
}

export function setModelCatalogOverride(catalog: ModelCatalog | null) {
  if (catalog) localStorage.setItem('model_catalog_override', JSON.stringify(catalog));
  else localStorage.removeItem('model_catalog_override');
  __modelCatalogCache = null; // força recarregar no próximo fetch
}

export function getCatalogGenModelInfo(catalog: ModelCatalog | null | undefined, provider: string | null | undefined, id: string | null | undefined): ModelInfo | undefined {
  if (!catalog || !provider || !id) return undefined;
  const p = provider.toLowerCase();
  const byProv = (catalog as any)[p] as Record<string, ModelInfo> | undefined;
  if (!byProv) return undefined;
  // Match exato primeiro
  if (byProv[id]) return byProv[id];
  // Heurística: procurar por chave que contenha o id (para modelos tipo o3-mini etc.)
  const key = Object.keys(byProv).find(k => k.toLowerCase() === id.toLowerCase() || id.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(id.toLowerCase()));
  return key ? byProv[key] : undefined;
}

export function getCatalogEmbeddingModelInfo(catalog: ModelCatalog | null | undefined, provider: string | null | undefined, id: string | null | undefined): ModelInfo | undefined {
  if (!catalog || !provider || !id) return undefined;
  const emb = catalog.embeddings || {};
  const p = provider.toLowerCase();
  const byProv = emb[p] as Record<string, ModelInfo> | undefined;
  if (!byProv) return undefined;
  if (byProv[id]) return byProv[id];
  const key = Object.keys(byProv).find(k => k.toLowerCase() === id.toLowerCase() || id.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(id.toLowerCase()));
  return key ? byProv[key] : undefined;
}

export function getGenModelInfo(provider: string | undefined | null, id: string | undefined | null): ModelInfo | undefined {
  if (!id) return undefined;
  const p = (provider || '').toLowerCase();
  const m = id.toLowerCase();
  if (p.includes('openai')) {
    if (m.includes('gpt-4.1')) return { title: 'GPT-4.1 (OpenAI)', description: 'Evolução do GPT‑4 com melhorias gerais de qualidade.', bestFor: 'tarefas complexas e conversação de alta qualidade' };
    if (m.includes('o3')) return { title: 'o3 (OpenAI)', description: 'Família voltada a raciocínio e otimização.', bestFor: 'raciocínio, planejamento e problemas estruturados' };
    if (m.includes('o1')) return { title: 'o1 (OpenAI)', description: 'Foco em custo/latência dentro da linha “o”.', bestFor: 'assistentes de uso geral com boa eficiência' };
    if (m.includes('gpt-4o-mini')) return { title: 'GPT-4o Mini (OpenAI)', description: 'Rápido e econômico com boa qualidade geral.', bestFor: 'alto volume, baixa latência' };
    if (m.includes('gpt-4o')) return { title: 'GPT-4o (OpenAI)', description: 'Multimodal de alta qualidade.', bestFor: 'tarefas complexas e multimodais' };
    if (m.includes('gpt-4-turbo')) return { title: 'GPT-4 Turbo (OpenAI)', description: 'Otimizado para custo/latência.', bestFor: 'tarefas complexas com custo moderado' };
    if (m.includes('gpt-3.5-turbo')) return { title: 'GPT-3.5 Turbo (OpenAI)', description: 'Legado e econômico.', bestFor: 'chat básico, automações simples' };
  }
  if (p.includes('anthropic')) {
    if (m.includes('opus')) return { title: 'Claude 3 Opus (Anthropic)', description: 'Topo de linha para tarefas exigentes.', bestFor: 'escrita longa e análise complexa' };
    if (m.includes('claude-3-5-sonnet')) return { title: 'Claude 3.5 Sonnet (Anthropic)', description: 'Alto raciocínio e qualidade contextual.', bestFor: 'análise e tarefas complexas' };
    if (m.includes('claude-3-sonnet')) return { title: 'Claude 3 Sonnet (Anthropic)', description: 'Equilíbrio entre custo e qualidade.', bestFor: 'assistentes corporativos' };
    if (m.includes('claude-3-haiku')) return { title: 'Claude 3 Haiku (Anthropic)', description: 'Rápido e econômico.', bestFor: 'alto volume, baixa latência' };
  }
  if (p.includes('google')) {
    if (m.includes('gemini-1.5-pro')) return { title: 'Gemini 1.5 Pro (Google)', description: 'Melhor qualidade/raciocínio da linha 1.5.', bestFor: 'tarefas complexas, contexto grande' };
    if (m.includes('gemini-1.5-flash')) return { title: 'Gemini 1.5 Flash (Google)', description: 'Mais rápido e econômico da linha 1.5.', bestFor: 'uso geral com latência baixa' };
  }
  if (p.includes('perplexity')) {
    if (m === 'sonar') return { title: 'Sonar (Perplexity)', description: 'Modelo leve otimizado para velocidade.', bestFor: 'respostas rápidas e econômicas' };
    if (m === 'sonar-pro') return { title: 'Sonar Pro (Perplexity)', description: 'Modelo avançado para consultas profundas.', bestFor: 'análises mais completas com melhor qualidade' };
    if (m === 'sonar-reasoning') return { title: 'Sonar Reasoning (Perplexity)', description: 'Raciocínio rápido.', bestFor: 'tarefas de raciocínio com baixa latência' };
    if (m === 'sonar-reasoning-pro') return { title: 'Sonar Reasoning Pro (Perplexity)', description: 'Raciocínio de nível superior.', bestFor: 'problemas complexos que exigem raciocínio' };
    if (m === 'sonar-deep-research') return { title: 'Sonar Deep Research (Perplexity)', description: 'Pesquisa profunda e multietapas.', bestFor: 'investigações detalhadas e análise aprofundada' };
    // Legacy fallback
    if (m.includes('sonar-small-online')) return { title: 'Sonar Small Online (Perplexity)', description: 'Modelo leve legado.', bestFor: 'respostas rápidas e econômicas' };
    if (m.includes('sonar-large-online')) return { title: 'Sonar Large Online (Perplexity)', description: 'Modelo avançado legado.', bestFor: 'análises mais completas com melhor qualidade' };
  }
  if (p.includes('ollama')) {
    if (m.includes('llama3.1')) return { title: 'Llama 3.1 (Ollama)', description: 'Local, equilibrado, bom para protótipos/offline.', bestFor: 'privacidade e ambientes sem internet' };
    if (m.includes('qwen2.5')) return { title: 'Qwen 2.5 (Ollama)', description: 'Local com bom custo/desempenho.', bestFor: 'tarefas gerais em ambiente local' };
  }
  return undefined;
}

export function getEmbeddingModelInfo(provider: string | undefined | null, id: string | undefined | null): ModelInfo | undefined {
  if (!id) return undefined;
  const p = (provider || '').toLowerCase();
  const m = id.toLowerCase();
  if (p.includes('openai')) {
    if (m.includes('text-embedding-3-small')) return { title: 'text-embedding-3-small (OpenAI)', description: 'Baixo custo e bom desempenho geral (dimensão menor).', bestFor: 'RAG de alto volume com custo controlado' };
    if (m.includes('text-embedding-3-large')) return { title: 'text-embedding-3-large (OpenAI)', description: 'Maior precisão semântica (dimensão maior).', bestFor: 'relevância crítica e documentos complexos' };
  }
  if (p.includes('ollama')) {
    if (m.includes('nomic-embed-text')) return { title: 'nomic-embed-text (Local)', description: 'Modelo open-source para embeddings de texto.', bestFor: 'on-premise/air-gapped e controle de dados' };
  }
  return undefined;
}

export async function embedTextBatchOllama(orgId: string | undefined | null, texts: string[], model = 'nomic-embed-text'): Promise<number[][]> {
  const endpoint = await getLLMKey(orgId, 'ollama');
  if (!endpoint) throw new Error('Endpoint do Ollama não configurado');
  const out: number[][] = [];
  for (const t of texts) {
    const res = await fetch(`${endpoint.replace(/\/$/, '')}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, input: t })
    });
    if (!res.ok) {
      const d = await res.text();
      throw new Error(`Falha no Ollama embeddings: ${res.status} ${d}`);
    }
    const js = await res.json();
    const emb = js?.embedding || js?.data?.[0]?.embedding;
    if (!emb) throw new Error('Resposta inválida do Ollama embeddings');
    out.push(emb as number[]);
  }
  return out;
}

export async function embedTextBatch(orgId: string | undefined | null, texts: string[], provider: 'openai' | 'ollama', model?: string): Promise<number[][]> {
  if (provider === 'ollama') return embedTextBatchOllama(orgId, texts, model || 'nomic-embed-text');
  return embedTextBatchOpenAI(orgId, texts);
}

// =============================
// Local RAG helpers (txt ingestion + search)
// =============================

export async function embedTextBatchOpenAI(orgId: string | undefined | null, texts: string[]): Promise<number[][]> {
  const apiKey = await getLLMKey(orgId, 'openai');
  if (!apiKey) throw new Error('Chave OpenAI ausente para embeddings');
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: texts })
  });
  if (!res.ok) {
    let d = ''; try { const j = await res.json(); d = j?.error?.message || ''; } catch {}
    throw new Error(`Falha ao gerar embeddings: ${res.status}${d ? ` - ${d}` : ''}`);
  }
  const js = await res.json();
  return (js.data || []).map((row: any) => row.embedding as number[]);
}

export function chunkText(text: string, chunkSize = 800, overlap = 120): string[] {
  const clean = text.replace(/\r\n?/g, '\n');
  const out: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const slice = clean.slice(i, i + chunkSize);
    out.push(slice);
    i += chunkSize - overlap;
  }
  return out.filter(Boolean);
}

export async function ingestLocalRAGTxtFile(orgId: string | undefined | null, agentId: string, file: File): Promise<string> {
  const text = await file.text();
  const chunks = chunkText(text);
  const embs = await embedTextBatchOpenAI(orgId, chunks);
  // create document
  const { data: docIns, error: docErr } = await supabase
    .from('rag_documents')
    .insert({ organization_id: orgId, agent_id: agentId, filename: file.name, mime_type: file.type || 'text/plain', file_size: file.size })
    .select('id')
    .single();
  if (docErr) throw docErr;
  const documentId = docIns.id as string;
  // insert chunks via rpc for vector casting
  for (let idx = 0; idx < chunks.length; idx++) {
    const c = chunks[idx];
    const e = embs[idx];
    // reduce to float4[] (number[] is fine)
    const { error } = await supabase.rpc('rag_insert_chunk', {
      p_document_id: documentId,
      p_agent_id: agentId,
      p_chunk_index: idx,
      p_content: c,
      p_embedding: e,
    });
    if (error) throw error;
  }
  return documentId;
}

export async function ingestLocalRAGTxtFileGeneric(
  orgId: string | undefined | null,
  agentId: string,
  file: File,
  embeddingProvider: 'openai'|'ollama' = 'openai',
  embeddingModel?: string
): Promise<string> {
  const text = await file.text();
  const chunks = chunkText(text);
  const embs = await embedTextBatch(orgId, chunks, embeddingProvider, embeddingModel);
  const { data: docIns, error: docErr } = await supabase
    .from('rag_documents')
    .insert({ organization_id: orgId, agent_id: agentId, filename: file.name, mime_type: file.type || 'text/plain', file_size: file.size })
    .select('id')
    .single();
  if (docErr) throw docErr;
  const documentId = docIns.id as string;
  for (let idx = 0; idx < chunks.length; idx++) {
    const c = chunks[idx];
    const e = embs[idx];
    const { error } = await supabase.rpc('rag_insert_chunk', {
      p_document_id: documentId,
      p_agent_id: agentId,
      p_chunk_index: idx,
      p_content: c,
      p_embedding: e,
    });
    if (error) throw error;
  }
  return documentId;
}

export type RagHit = { document_id: string; chunk_index: number; content: string; distance: number };

export async function searchLocalRAGTopK(orgId: string | undefined | null, agentId: string, query: string, k = 6): Promise<RagHit[]> {
  const [qEmb] = await embedTextBatchOpenAI(orgId, [query]);
  const { data, error } = await supabase.rpc('rag_search_array', { p_agent: agentId, p_query: qEmb, p_k: k });
  if (error) throw error;
  return (data || []).map((row: any) => ({
    document_id: row.document_id as string,
    chunk_index: row.chunk_index as number,
    content: row.content as string,
    distance: row.distance as number,
  }));
}

export async function searchLocalRAGTopKGeneric(
  orgId: string | undefined | null,
  agentId: string,
  query: string,
  provider: 'openai'|'ollama',
  k = 6,
  model?: string
): Promise<RagHit[]> {
  const [qEmb] = await embedTextBatch(orgId, [query], provider, model);
  const { data, error } = await supabase.rpc('rag_search_array', { p_agent: agentId, p_query: qEmb, p_k: k });
  if (error) throw error;
  return (data || []).map((row: any) => ({
    document_id: row.document_id as string,
    chunk_index: row.chunk_index as number,
    content: row.content as string,
    distance: row.distance as number,
  }));
}

export async function fetchRagDocNames(docIds: string[]): Promise<Record<string, { filename: string }>> {
  if (!docIds.length) return {};
  const { data, error } = await supabase
    .from('rag_documents')
    .select('id, filename')
    .in('id', docIds);
  if (error) return {};
  const out: Record<string, { filename: string }> = {};
  for (const r of data || []) out[r.id] = { filename: r.filename };
  return out;
}

export function buildContextFromChunks(chunks: { content: string; distance: number }[], maxChars = 2800): string {
  let acc = 'Contexto recuperado (RAG Local):\n';
  let size = acc.length;
  for (const c of chunks) {
    const block = `\n---\n${c.content.trim()}\n`;
    if (size + block.length > maxChars) break;
    acc += block;
    size += block.length;
  }
  return acc + '\nUse apenas as partes relevantes para responder.';
}


// =============================
// Assistants v2 - Files & Vector Stores helpers
// =============================

export async function ensureVectorStoreForAgent(orgId: string | null | undefined, agentId: string, currentVectorStoreId?: string | null): Promise<string> {
  const apiKey = await getLLMKey(orgId || null, 'openai');
  if (!apiKey) throw new Error('Chave OpenAI ausente');
  if (currentVectorStoreId) return currentVectorStoreId;
  const res = await fetch('https://api.openai.com/v1/vector_stores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, 'OpenAI-Beta': 'assistants=v2' },
    body: JSON.stringify({ name: `agent:${agentId}` })
  });
  if (!res.ok) {
    let d = ''; try { const j = await res.json(); d = j?.error?.message || ''; } catch {}
    throw new Error(`Falha ao criar Vector Store: ${res.status}${d ? ` - ${d}` : ''}`);
  }
  const js = await res.json();
  return js.id as string;
}

export async function uploadFileToOpenAI(orgId: string | null | undefined, file: File): Promise<string> {
  const apiKey = await getLLMKey(orgId || null, 'openai');
  if (!apiKey) throw new Error('Chave OpenAI ausente');
  const form = new FormData();
  form.append('file', file);
  form.append('purpose', 'assistants');
  if (import.meta.env.DEV) console.debug('[uploadFileToOpenAI] iniciando upload', { name: file.name, size: file.size, type: file.type });
  const res = await fetch('https://api.openai.com/v1/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form
  });
  if (!res.ok) {
    let d = '';
    try { const j = await res.json(); d = j?.error?.message || ''; }
    catch {
      try { d = await res.text(); } catch {}
    }
    throw new Error(`Falha no upload de arquivo: ${res.status} ${res.statusText}${d ? ` - ${d}` : ''}`);
  }
  const js = await res.json();
  if (import.meta.env.DEV) console.debug('[uploadFileToOpenAI] upload concluído', { name: file.name, fileId: js?.id });
  return js.id as string;
}

export async function attachFileToVectorStore(orgId: string | null | undefined, vectorStoreId: string, fileId: string): Promise<void> {
  const apiKey = await getLLMKey(orgId || null, 'openai');
  if (!apiKey) throw new Error('Chave OpenAI ausente');
  const res = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, 'OpenAI-Beta': 'assistants=v2' },
    body: JSON.stringify({ file_id: fileId })
  });
  if (!res.ok) {
    let d = ''; try { const j = await res.json(); d = j?.error?.message || ''; } catch {}
    throw new Error(`Falha ao anexar arquivo ao Vector Store: ${res.status}${d ? ` - ${d}` : ''}`);
  }
}

/**
 * List OpenAI Assistants (v1). Requires API key.
 */
export async function listOpenAIAssistants(orgId: string | undefined | null): Promise<Array<{id: string; name: string; description?: string}>> {
  const apiKey = await getLLMKey(orgId, 'openai');
  if (!apiKey) throw new Error('Chave da OpenAI não encontrada. Configure em Configurações > LLM.');
  const res = await fetch('https://api.openai.com/v1/assistants', {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      // Assistants v2 requires this beta header
      'OpenAI-Beta': 'assistants=v2',
    },
  });
  if (!res.ok) {
    let detail = '';
    try { const j = await res.json(); detail = j?.error?.message || ''; } catch {}
    throw new Error(`${res.status} ${res.statusText}${detail ? ` - ${detail}` : ''}`);
  }
  const json = await res.json();
  return (json.data || []).map((a: any) => ({ id: a.id, name: a.name || a.id, description: a.description }));
}

// Fetch single OpenAI Assistant (v2)
export async function getOpenAIAssistant(orgId: string | undefined | null, assistantId: string): Promise<{ id: string; name?: string; description?: string; instructions?: string } | null> {
  const apiKey = await getLLMKey(orgId, 'openai');
  if (!apiKey) throw new Error('Chave da OpenAI não encontrada. Configure em Configurações > LLM.');
  const res = await fetch(`https://api.openai.com/v1/assistants/${assistantId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v2',
    },
  });
  if (!res.ok) {
    let detail = '';
    try { const j = await res.json(); detail = j?.error?.message || ''; } catch {}
    throw new Error(`${res.status} ${res.statusText}${detail ? ` - ${detail}` : ''}`);
  }
  const a = await res.json();
  return { id: a.id, name: a.name, description: a.description, instructions: a.instructions };
}

/**
 * List available chat models for OpenAI via API (filters common chat models).
 */
export async function listOpenAIModels(orgId: string | undefined | null): Promise<string[]> {
  const apiKey = await getLLMKey(orgId, 'openai');
  if (!apiKey) return [];
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) return [];
  const json = await res.json();
  const ids: string[] = (json.data || []).map((m: any) => m.id);
  // Heuristic: keep common chat models
  return ids.filter((id) => /gpt|o1|o3|mini|turbo|4o/i.test(id)).slice(0, 50);
}

/** Static sets for other providers (until public list endpoints are available). */
export function listAnthropicModelsStatic(): string[] {
  return [
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
    'claude-3-5-sonnet-20241022',
  ];
}

export function listGoogleModelsStatic(): string[] {
  return [
    // Família 2.5
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    // Previews/Experimental
    'gemini-live-2.5-flash-preview',
    'gemini-2.5-flash-preview-native-audio-dialog',
    'gemini-2.5-flash-exp-native-audio-thinking-dialog',
    // Legados/compatibilidade
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-pro',
    'gemini-pro-vision',
  ];
}

export async function getAvailableModels(orgId: string | undefined | null): Promise<{ provider: string; models: string[] }[]> {
  const out: { provider: string; models: string[] }[] = [];
  const openaiKey = await getLLMKey(orgId, 'openai');
  if (openaiKey) {
    const openaiModels = await listOpenAIModels(orgId);
    out.push({ provider: 'OpenAI', models: openaiModels.length ? openaiModels : ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] });
  }
  const anthropicKey = await getLLMKey(orgId, 'anthropic');
  if (anthropicKey) out.push({ provider: 'Anthropic', models: listAnthropicModelsStatic() });
  const googleKey = await getLLMKey(orgId, 'google');
  if (googleKey) {
    const googleModels = listGoogleModelsStatic();
    out.push({ provider: 'Google', models: googleModels.length ? googleModels : listGoogleModelsStatic() });
  }
  const perplexityKey = await getLLMKey(orgId, 'perplexity');
  if (perplexityKey) {
    try {
      // Tentar descobrir modelos disponíveis via test-llm (list=true)
      const testRes = await fetch('/functions/v1/test-llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token') || ''}` },
        body: JSON.stringify({ provider: 'perplexity', organization_id: orgId, list: true })
      });
      if (testRes.ok) {
        const testData = await testRes.json();
        if (testData.ok && testData.data?.successes) {
          const workingModels = testData.data.successes.map((s: any) => s.model);
          if (workingModels.length > 0) {
            out.push({ provider: 'Perplexity', models: workingModels });
          } else {
            throw new Error('No working models found');
          }
        } else {
          throw new Error('Test response invalid');
        }
      } else {
        throw new Error('Test request failed');
      }
    } catch (e) {
      // Fallback para catálogo estático se test-llm falhar
      try {
        const cat = await fetchModelCatalog();
        const perpl = (cat as any)?.perplexity || {};
        const ids = Object.keys(perpl);
        const models = ids.length ? ids : ['sonar', 'sonar-pro', 'sonar-reasoning', 'sonar-reasoning-pro', 'sonar-deep-research'];
        out.push({ provider: 'Perplexity', models });
      } catch {
        out.push({ provider: 'Perplexity', models: ['sonar', 'sonar-pro', 'sonar-reasoning', 'sonar-reasoning-pro', 'sonar-deep-research'] });
      }
    }
  }
  return out;
}
