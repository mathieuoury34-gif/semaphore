// Offres d'emploi : les entreprises publient leurs offres via des services standards (Greenhouse, Ashby, Lever, Personio…)
// qui offrent une lecture publique gratuite et sans clé. Chaque adaptateur renvoie les mêmes éléments bruts qu'un flux RSS.
//   source.type  : « greenhouse » | « ashby » | « lever » | « personio » | « arbeitnow »
//   source.board : identifiant de l'entreprise chez le service (ex. « isaraerospace »)
//   source.company : nom affiché (par défaut : nom de la source)
import { XMLParser } from 'fast-xml-parser';
import { clip, stripHtml } from './text.mjs';

export const JOB_TYPES = ['greenhouse', 'ashby', 'lever', 'personio', 'arbeitnow'];

/** Adresse de lecture des offres d'une entreprise. */
export function jobsUrl(type, board) {
  switch (type) {
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

function make({ company, title, location, extra = [], url, when, html, plain }) {
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
    meta: { title: stripHtml(title), location: where, department: extra.join(' ') },
  };
}

/** @returns {any[]} éléments bruts (comme parseFeed) ; lève une erreur si la réponse n'est pas celle attendue */
export function parseJobs(body, source) {
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
