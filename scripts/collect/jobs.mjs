// Offres d'emploi : les entreprises publient leurs offres via des services standards (Greenhouse, Ashby, Lever, Personio…)
// qui offrent une lecture publique gratuite et sans clé. Chaque adaptateur renvoie les mêmes éléments bruts qu'un flux RSS.
//   source.type  : « greenhouse » | « ashby » | « lever » | « personio » | « recruitee » | « workday » | « arbeitnow »
//   source.board : identifiant de l'entreprise chez le service (ex. « isaraerospace »)
//                  Workday : « locataire/serveur/site » (ex. « ag/wd3/Airbus »), avec facets (filtres) et searchText facultatifs
//   source.company : nom affiché (par défaut : nom de la source)
//   source.france  : l'entreprise a au moins un site en France (ses offres passent devant, celles situées en France encore plus)
import { XMLParser } from 'fast-xml-parser';
import { clip, stripHtml } from './text.mjs';
import { UA_PAGE, postJSON } from './http.mjs';

export const JOB_TYPES = ['greenhouse', 'ashby', 'lever', 'personio', 'recruitee', 'workday', 'arbeitnow'];

const FR_PLACES = ['france', 'paris', 'toulouse', 'bordeaux', 'lyon', 'marseille', 'cannes', 'nice', 'vernon', 'les mureaux', 'élancourt', 'elancourt', 'vélizy', 'velizy', 'gennevilliers', 'issy', 'courbevoie', 'la défense', 'montpellier', 'nantes', 'grenoble', 'mérignac', 'merignac', 'saint-médard', 'kourou', 'guyane', 'orsay', 'palaiseau', 'saclay', 'massy', 'évry', 'occitanie', 'île-de-france', 'ile-de-france', 'rennes', 'lille', 'strasbourg', 'brest', 'colomiers', 'blagnac', 'labège', 'ramonville', 'meudon', 'boulogne', 'cestas', 'le haillan', 'aquitaine', 'verrières', 'guyancourt', 'bagneux', 'montrouge', 'clamart', 'créteil', 'angoulême', 'poitiers', 'aix-en-provence', 'toulon', 'sophia'];
const FR_RE = new RegExp(`(?<![\\p{L}])(?:${FR_PLACES.join('|')})(?![\\p{L}])`, 'iu');
/** Le lieu d'une offre est-il en France ? (code pays si on l'a, sinon recherche d'un nom de lieu français) */
export function inFrance(location = '', countryCode = '') {
  if (countryCode) return String(countryCode).toUpperCase() === 'FR';
  return FR_RE.test(location);
}

/** Adresse de lecture des offres d'une entreprise. */
export function jobsUrl(type, board) {
  switch (type) {
    case 'recruitee': return `https://${board}.recruitee.com/api/offers/`;
    case 'workday': {
      const [tenant, dc, site] = String(board).split('/');
      if (!tenant || !dc || !site) throw new Error('Workday : board attendu « locataire/serveur/site »');
      return `https://${tenant}.${dc}.myworkdayjobs.com/wday/cxs/${tenant}/${site}/jobs`;
    }
    case 'greenhouse': return `https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`;
    case 'ashby': return `https://api.ashbyhq.com/posting-api/job-board/${board}`;
    case 'lever': return `https://api.lever.co/v0/postings/${board}?mode=json`;
    case 'personio': return `https://${board}.jobs.personio.de/xml`;
    case 'arbeitnow': return 'https://www.arbeitnow.com/api/job-board-api';
    default: throw new Error('type d\'offres inconnu : ' + type);
  }
}

const personio = new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: true, processEntities: true });
const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
const str = (x) => (x == null ? '' : typeof x === 'object' ? String(x['#text'] ?? '') : String(x));
const date = (v) => {
  if (v == null || v === '') return null;
  const d = typeof v === 'number' ? new Date(v < 1e12 ? v * 1000 : v) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

function make({ company, title, location, extra = [], url, when, html, plain, cc }) {
  const where = [location].filter(Boolean).join(', ');
  const text = plain ? String(plain).replace(/\s+/g, ' ').trim() : stripHtml(html || '');
  const head = [where, ...extra].filter(Boolean).join(' · ');
  return {
    title: `${stripHtml(title)} — ${company}${where ? ' · ' + where : ''}`,
    url,
    date: date(when),
    snippet: clip(text || head, 400),
    text,
    categories: extra.filter(Boolean),
    meta: { title: stripHtml(title), location: where, department: extra.join(' '), fr: inFrance(where, cc) },
  };
}

/** « Posted 3 Days Ago », « Posted Yesterday », « Posted 30+ Days Ago » → date approximative (les offres de plus de 30 jours sont écartées). */
function workdayDate(label, now) {
  const t = String(label || '');
  if (/today|aujourd/i.test(t)) return now;
  if (/yesterday|hier/i.test(t)) return new Date(now.getTime() - 86400000);
  const m = /(\d+)(\+)?\s*(?:days?|jours?)/i.exec(t);
  if (m) return new Date(now.getTime() - (m[2] ? 45 : Number(m[1])) * 86400000);
  return null;
}

/**
 * Workday ne se lit que par pages de 20 offres (requêtes POST) : on assemble les pages en un seul document.
 * @param {any} source
 * @param {(url:string, body:any, headers?:any, timeout?:number)=>Promise<{ok?:boolean,status:number,text:string}>} post
 */
export async function fetchWorkday(source, post = postJSON) {
  const url = jobsUrl('workday', source.board);
  const jobPostings = [];
  let total = Infinity;
  for (let page = 0; page < (source.maxPages ?? 40) && jobPostings.length < total; page++) {
    const r = await post(url, { appliedFacets: source.facets ?? {}, limit: 20, offset: page * 20, searchText: source.searchText ?? '' }, { Accept: 'application/json', 'User-Agent': UA_PAGE }, 30000);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    let j;
    try { j = JSON.parse(r.text); } catch { throw new Error('Réponse « workday » inattendue (JSON illisible)'); }
    if (!Array.isArray(j?.jobPostings)) throw new Error('Réponse « workday » inattendue (pas de liste « jobPostings »)');
    if (page === 0) total = Number(j.total) || 0;
    if (!j.jobPostings.length) break;
    jobPostings.push(...j.jobPostings);
  }
  return JSON.stringify({ total: jobPostings.length, jobPostings });
}

/** @returns {any[]} éléments bruts (comme parseFeed) ; lève une erreur si la réponse n'est pas celle attendue */
export function parseJobs(body, source, now = new Date()) {
  const company = source.company || source.name;
  const type = source.type;
  const bad = (what) => { throw new Error(`Réponse « ${type} » inattendue (${what})`); };
  if (type === 'personio') {
    const doc = personio.parse(body);
    if (!doc['workzag-jobs']) bad('pas de <workzag-jobs>');
    return arr(doc['workzag-jobs'].position).map((p) => {
      const desc = arr(p.jobDescriptions?.jobDescription).map((d) => `${str(d.name)}. ${str(d.value)}`).join(' ');
      return make({
        company: str(p.subcompany) || company, title: str(p.name), location: str(p.office),
        extra: [str(p.department), str(p.recruitingCategory), str(p.employmentType), str(p.seniority)],
        url: `https://${source.board}.jobs.personio.de/job/${str(p.id)}`, when: str(p.createdAt), html: desc,
      });
    });
  }
  let j;
  try { j = JSON.parse(body); } catch { bad('JSON illisible'); }
  if (type === 'greenhouse') {
    if (!Array.isArray(j?.jobs)) bad('pas de liste « jobs »');
    return j.jobs.map((x) => make({
      company, title: x.title, location: x.location?.name, extra: arr(x.departments).map((d) => d.name),
      url: x.absolute_url, when: x.first_published || x.updated_at, html: x.content,
    }));
  }
  if (type === 'ashby') {
    if (!Array.isArray(j?.jobs)) bad('pas de liste « jobs »');
    return j.jobs.filter((x) => x.isListed !== false).map((x) => make({
      company, title: x.title, location: x.location || (x.isRemote ? 'Remote' : ''), extra: [x.department, x.team, x.employmentType],
      url: x.jobUrl, when: x.publishedAt, plain: x.descriptionPlain, html: x.descriptionHtml,
    }));
  }
  if (type === 'lever') {
    if (!Array.isArray(j)) bad('pas une liste');
    return j.map((x) => make({
      company, title: x.text, location: x.categories?.location, extra: [x.categories?.team, x.categories?.department, x.categories?.commitment],
      url: x.hostedUrl, when: x.createdAt, plain: x.descriptionPlain, html: x.description,
    }));
  }
  if (type === 'recruitee') {
    if (!Array.isArray(j?.offers)) bad('pas de liste « offers »');
    return j.offers.filter((x) => !x.status || x.status === 'published').map((x) => make({
      company, title: x.title, location: x.location || [x.city, x.country].filter(Boolean).join(', '), cc: x.country_code,
      extra: [x.department, x.employment_type_code, x.experience_code],
      url: x.careers_url, when: String(x.published_at || x.created_at || '').replace(' UTC', 'Z').replace(' ', 'T'), html: `${x.description || ''} ${x.requirements || ''}`,
    }));
  }
  if (type === 'workday') {
    if (!Array.isArray(j?.jobPostings)) bad('pas de liste « jobPostings »');
    const [tenant, dc, site] = String(source.board).split('/');
    return j.jobPostings.filter((x) => x.title && x.externalPath).map((x) => make({
      company, title: x.title, location: x.locationsText,
      url: `https://${tenant}.${dc}.myworkdayjobs.com/${site}${x.externalPath}`, when: workdayDate(x.postedOn, now),
    }));
  }
  if (type === 'arbeitnow') {
    if (!Array.isArray(j?.data)) bad('pas de liste « data »');
    return j.data.map((x) => make({
      company: x.company_name || company, title: x.title, location: x.location, extra: [...arr(x.job_types), ...(x.remote ? ['Remote'] : [])],
      url: x.url, when: x.created_at, html: x.description,
    }));
  }
  bad('type inconnu');
}

/** Filtre « offres qui m'intéressent » : ingénierie, recherche et stages. Les expressions viennent de rules.json (section « jobs »). */
export function jobFilter(rules = {}, source = {}) {
  const inc = new RegExp(source.include ?? rules.include ?? '.', 'iu');
  const exc = rules.exclude || source.exclude ? new RegExp(source.exclude ?? rules.exclude, 'iu') : null;
  const loc = source.locations ? new RegExp(source.locations, 'iu') : null;
  return (item) => {
    const m = item.meta ?? { title: item.title, location: '', department: '' };
    const hay = `${m.title} ${m.department}`;
    if (!inc.test(hay)) return false;
    if (exc && exc.test(m.title)) return false;
    if (loc && !loc.test(m.location || '')) return false;
    return true;
  };
}
