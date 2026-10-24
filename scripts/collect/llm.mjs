// Accès aux modèles de langage GRATUITS (facultatif). Ordre d'essai :
//   1. Gemini (clé gratuite Google AI Studio, secret GEMINI_API_KEY) ;
//   2. GitHub Models (aucune clé : jeton GITHUB_TOKEN du workflow, droit « models: read »).
// Sans aucun des deux, le robot produit des résumés par extraction de phrases (sans IA).
// Les noms de modèles et les quotas gratuits évoluent : tout se règle par variables d'environnement (voir README).
import { postJSON } from './http.mjs';
import { sleep } from './text.mjs';

const GEMINI_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.1-flash-lite'];
const GITHUB_MODELS = ['openai/gpt-4.1-mini', 'openai/gpt-4o-mini', 'meta/llama-3.3-70b-instruct'];

export class LLMError extends Error {
  constructor(msg, { status = 0, retryAfter = 0, daily = false, model = false } = {}) {
    super(msg);
    this.status = status; this.retryAfter = retryAfter; this.daily = daily; this.badModel = model;
  }
}

const isDaily = (body) => /per ?day|daily|86400|PerDay|RPD/i.test(body);
const isBadModel = (status, body) => status === 404 || (status === 400 && /model/i.test(body) && /not (found|supported|available)|unknown|invalid/i.test(body)) || /unknown_model|model_not_found|not found/i.test(body.slice(0, 400)) && status >= 400;

function retryAfter(res) {
  const v = Number(res.headers?.get?.('retry-after'));
  return Number.isFinite(v) && v > 0 ? v : 0;
}

export function geminiProvider(env = process.env) {
  const models = (env.GEMINI_MODEL ? env.GEMINI_MODEL.split(',') : GEMINI_MODELS).map((s) => s.trim()).filter(Boolean);
  let idx = 0;
  return {
    name: 'gemini',
    get model() { return models[idx]; },
    minIntervalMs: Number(env.VIGIE_LLM_INTERVAL_MS) || 4500,
    async call({ system, user, maxTokens = 3000 }) {
      for (;;) {
        const model = models[idx];
        const res = await postJSON(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: maxTokens, responseMimeType: 'application/json' },
          },
          { 'x-goog-api-key': env.GEMINI_API_KEY },
        );
        if (res.ok) {
          const j = JSON.parse(res.text);
          const parts = j.candidates?.[0]?.content?.parts ?? [];
          const text = parts.map((p) => p.text ?? '').join('');
          if (!text) throw new LLMError('réponse vide (' + (j.candidates?.[0]?.finishReason || j.promptFeedback?.blockReason || '?') + ')', { status: 200 });
          return text;
        }
        if (isBadModel(res.status, res.text) && idx < models.length - 1) { idx++; continue; }
        throw new LLMError(`Gemini ${model} : HTTP ${res.status} ${res.text.slice(0, 200)}`, { status: res.status, retryAfter: retryAfter(res), daily: res.status === 429 && isDaily(res.text), model: isBadModel(res.status, res.text) });
      }
    },
  };
}

export function githubProvider(env = process.env) {
  const models = (env.GH_MODELS_MODEL ? env.GH_MODELS_MODEL.split(',') : GITHUB_MODELS).map((s) => s.trim()).filter(Boolean);
  let idx = 0;
  return {
    name: 'github-models',
    get model() { return models[idx]; },
    minIntervalMs: Number(env.VIGIE_LLM_INTERVAL_MS) || 4500, // palier gratuit : 15 requêtes/minute
    async call({ system, user, maxTokens = 3000 }) {
      for (;;) {
        const model = models[idx];
        // deux adresses équivalentes : la nouvelle (models.github.ai) puis l'ancienne (Azure, noms de modèles sans éditeur)
        const endpoints = [
          ['https://models.github.ai/inference/chat/completions', model],
          ['https://models.inference.ai.azure.com/chat/completions', model.split('/').pop()],
        ];
        let res, content, why = '';
        for (const [url, name] of endpoints) {
          res = await postJSON(
            url,
            { model: name, temperature: 0.2, max_tokens: Math.min(maxTokens, 3500), response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] },
            { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
          );
          if (!res.ok) break; // vraie erreur HTTP : traitée plus bas
          try {
            content = JSON.parse(res.text).choices?.[0]?.message?.content ?? '';
            break;
          } catch {
            why = `${url.split('/')[2]} : réponse inattendue (HTTP ${res.status}, ${res.headers?.get?.('content-type') || '?'}) « ${res.text.slice(0, 60).replace(/\s+/g, ' ')} »`;
            console.log('  [llm] ' + why);
          }
        }
        if (res.ok) {
          if (content === undefined) throw new LLMError(why || 'réponse illisible', { status: 200 });
          if (!content) throw new LLMError('réponse vide', { status: 200 });
          return content;
        }
        if (isBadModel(res.status, res.text) && idx < models.length - 1) { idx++; continue; }
        throw new LLMError(`GitHub Models ${model} : HTTP ${res.status} ${res.text.slice(0, 200)}`, { status: res.status, retryAfter: retryAfter(res), daily: res.status === 429 && isDaily(res.text), model: isBadModel(res.status, res.text) });
      }
    },
  };
}

/** Réponse JSON d'un modèle, même entourée de ```json … ``` ou de texte. */
export function parseJSONLoose(text) {
  let s = String(text ?? '').trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try { return JSON.parse(s); } catch { /* essai suivant */ }
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch { /* abandon */ } }
  return null;
}

/**
 * Client : enchaîne les fournisseurs, espace les requêtes, réessaie sur 429/5xx, abandonne un fournisseur épuisé.
 */
export class LLMClient {
  constructor(providers, { maxRequests = 60, log = console.log } = {}) {
    this.providers = providers.map((p) => ({ p, dead: false, last: 0 }));
    this.maxRequests = maxRequests;
    this.requests = 0;
    this.failures = 0;
    this.used = new Set();
    this.log = log;
  }
  get available() {
    return this.requests < this.maxRequests && this.providers.some((x) => !x.dead);
  }
  get label() {
    return [...this.used].join('+') || this.providers.map((x) => x.p.name).join('+');
  }
  /** @returns {Promise<any|null>} objet JSON ou null si aucun fournisseur n'a répondu */
  async json({ system, user, maxTokens = 2000 }) {
    for (const slot of this.providers) {
      if (slot.dead) continue;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (this.requests >= this.maxRequests) return null;
        const wait = slot.last + slot.p.minIntervalMs - Date.now();
        if (wait > 0) await sleep(wait);
        slot.last = Date.now();
        this.requests++;
        try {
          const raw = await slot.p.call({ system, user, maxTokens });
          const obj = parseJSONLoose(raw);
          if (obj) { this.used.add(slot.p.name + ':' + slot.p.model); return obj; }
          this.failures++;
          this.log(`  [llm] ${slot.p.name} : réponse non JSON`);
          break;
        } catch (e) {
          this.failures++;
          const msg = String(e.message || e);
          if (e instanceof LLMError && e.daily) { this.log(`  [llm] ${slot.p.name} : quota du jour épuisé`); slot.dead = true; break; }
          if (e instanceof LLMError && (e.status === 401 || e.status === 403 || e.badModel)) { this.log(`  [llm] ${slot.p.name} abandonné : ${msg.slice(0, 160)}`); slot.dead = true; break; }
          if (e instanceof LLMError && (e.status === 429 || e.status >= 500) && attempt < 2) {
            const delay = Math.min(65, e.retryAfter || 20 * (attempt + 1));
            this.log(`  [llm] ${slot.p.name} : HTTP ${e.status}, nouvel essai dans ${delay} s`);
            await sleep(delay * 1000);
            continue;
          }
          this.log(`  [llm] ${slot.p.name} : ${msg.slice(0, 160)}`);
          break;
        }
      }
    }
    return null;
  }
}

export function createLLM(env = process.env, opts = {}) {
  if (env.VIGIE_NO_LLM === '1') return null;
  const providers = [];
  if (env.GEMINI_API_KEY) providers.push(geminiProvider(env));
  if (env.GITHUB_TOKEN && env.VIGIE_GH_MODELS !== '0') providers.push(githubProvider(env));
  return providers.length ? new LLMClient(providers, { maxRequests: Number(env.VIGIE_LLM_MAX_REQUESTS) || 60, ...opts }) : null;
}
