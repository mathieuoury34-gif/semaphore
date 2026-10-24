import test from 'node:test';
import assert from 'node:assert/strict';
import { jobFilter, jobsUrl, parseJobs } from '../scripts/collect/jobs.mjs';
import { normalizeItems, parseFeed } from '../scripts/collect/feed.mjs';
import { loadRules, loadSectors, loadSources } from '../scripts/collect/config.mjs';

const GH = JSON.stringify({ jobs: [
  { title: 'CFD Engineer (m/f/d)', absolute_url: 'https://boards.example/1', location: { name: 'Munich' }, updated_at: '2026-10-22T10:00:00Z', departments: [{ name: 'Engineering' }], content: '&lt;p&gt;You will run &lt;b&gt;LES&lt;/b&gt; simulations of nozzle flows.&lt;/p&gt;' },
  { title: 'Marketing Manager', absolute_url: 'https://boards.example/2', location: { name: 'Berlin' }, updated_at: '2026-10-22T10:00:00Z', departments: [{ name: 'Marketing' }] },
  { title: 'Working Student Propulsion', absolute_url: 'https://boards.example/3', location: { name: 'Bremen' }, updated_at: '2026-10-21T10:00:00Z', departments: [] },
] });
const rules = { include: 'engineer|propulsion|\\bintern\\b|working student', exclude: '\\b(marketing|sales)\\b' };
const src = { id: 'job-x', name: 'X – offres', type: 'greenhouse', board: 'x', company: 'Xco', lang: 'en', sectors: ['emploi'] };

test('Greenhouse : intitulé enrichi (entreprise, lieu), description en clair, filtre sur le profil', () => {
  const raw = parseJobs(GH, src);
  assert.equal(raw.length, 3);
  assert.equal(raw[0].title, 'CFD Engineer (m/f/d) — Xco · Munich');
  assert.ok(raw[0].text.startsWith('You will run LES simulations'));
  const kept = raw.filter(jobFilter(rules, src));
  assert.deepEqual(kept.map((r: any) => r.meta.title), ['CFD Engineer (m/f/d)', 'Working Student Propulsion']);
  const items = normalizeItems(kept, src);
  assert.equal(items[0].url, 'https://boards.example/1');
  assert.equal((items[0] as any).noCluster, true);
});

test('Greenhouse : réponse inattendue → erreur claire', () => {
  assert.throws(() => parseJobs('<html>', src), /inattendue/);
  assert.throws(() => parseJobs('{"a":1}', src), /inattendue/);
});

test('Ashby, Lever, Personio, Arbeitnow', () => {
  const ashby = parseJobs(JSON.stringify({ jobs: [{ title: 'Thermal Engineer', location: 'Munich', department: 'Eng', employmentType: 'FullTime', publishedAt: '2026-10-20T00:00:00Z', jobUrl: 'https://ashby/1', descriptionPlain: 'Design the thermal control.' }, { title: 'Hidden', isListed: false, jobUrl: 'u' }] }), { ...src, type: 'ashby' });
  assert.equal(ashby.length, 1);
  assert.equal(ashby[0].snippet, 'Design the thermal control.');
  const lever = parseJobs(JSON.stringify([{ text: 'Propulsion Intern', categories: { location: 'Paris', team: 'Eng', commitment: 'Intern' }, createdAt: 1761000000000, hostedUrl: 'https://lever/1', descriptionPlain: 'Test rig.' }]), { ...src, type: 'lever' });
  assert.equal(lever[0].title, 'Propulsion Intern — Xco · Paris');
  assert.ok(lever[0].date instanceof Date);
  const xml = `<?xml version="1.0"?><workzag-jobs><position><id>42</id><subcompany>Mynaric AG</subcompany><office>Munich</office><department>R&amp;D</department><name>Optical Engineer</name><jobDescriptions><jobDescription><name>Tasks</name><value>&lt;p&gt;Build lasers&lt;/p&gt;</value></jobDescription></jobDescriptions><createdAt>2026-10-10T10:00:00+00:00</createdAt></position></workzag-jobs>`;
  const p = parseJobs(xml, { ...src, type: 'personio', board: 'mynaric' });
  assert.equal(p[0].url, 'https://mynaric.jobs.personio.de/job/42');
  assert.equal(p[0].title, 'Optical Engineer — Mynaric AG · Munich');
  assert.ok(/Build lasers/.test(p[0].text));
  const an = parseJobs(JSON.stringify({ data: [{ title: 'CFD-Ingenieur', company_name: 'Beispiel GmbH', location: 'München', url: 'https://an/1', created_at: 1761000000, description: '<p>Strömungssimulation</p>', job_types: ['Vollzeit'], remote: false }] }), { ...src, type: 'arbeitnow' });
  assert.equal(an[0].title, 'CFD-Ingenieur — Beispiel GmbH · München');
});

test('filtre de lieu et d’inclusion propres à une source', () => {
  const raw = parseJobs(GH, src);
  const f = jobFilter(rules, { ...src, locations: 'Munich|München' });
  assert.deepEqual(raw.filter(f).map((r: any) => r.meta.location), ['Munich']);
  const g = jobFilter(rules, { ...src, include: 'propulsion' });
  assert.equal(raw.filter(g).length, 1);
});

test('adresse de lecture selon le service', () => {
  assert.equal(jobsUrl('personio', 'mynaric'), 'https://mynaric.jobs.personio.de/xml');
  assert.throws(() => jobsUrl('inconnu', 'x'));
});

test('flux RSS d’offres (Teamtailor) : lu comme un flux, un sujet par offre', () => {
  const rss = `<?xml version="1.0"?><rss version="2.0"><channel><item><title>Orbital Engineer</title><link>https://exotrail.teamtailor.com/jobs/1</link><pubDate>Wed, 21 Oct 2026 10:00:00 GMT</pubDate><description>Join us</description></item></channel></rss>`;
  const items = normalizeItems(parseFeed(rss, { id: 'j', jobs: true }), { id: 'j', lang: 'en', jobs: true });
  assert.equal((items[0] as any).noCluster, true);
});

test('configuration : chaque source a un secteur connu, une langue fr/en, un identifiant unique ; les médias à ligne éditoriale ont un repère valide', () => {
  const sectors = new Set(loadSectors().map((s: any) => s.id));
  const sources = loadSources();
  assert.equal(new Set(sources.map((s: any) => s.id)).size, sources.length, 'identifiants uniques');
  const leans = new Set(['left', 'center-left', 'center', 'center-right', 'right']);
  for (const s of sources as any[]) {
    assert.ok(s.url, s.id + ' : adresse');
    assert.ok(['fr', 'en'].includes(s.lang), s.id + ' : langue');
    assert.ok(s.sectors.length > 0 && s.sectors.every((x: string) => sectors.has(x)), s.id + ' : secteurs');
    if (s.lean) assert.ok(leans.has(s.lean), s.id + ' : repère');
  }
  const rules = loadRules() as any;
  for (const id of Object.keys(rules.sectors)) assert.ok(sectors.has(id), 'règles : secteur inconnu ' + id);
  for (const s of loadSectors() as any[]) assert.ok(s.en?.name && s.en?.short && s.en?.description, s.id + ' : traduction anglaise');
});

test('diversité : chaque secteur d’opinion compte des sources de plusieurs sensibilités', () => {
  const sources = loadSources().filter((s: any) => s.enabled !== false) as any[];
  for (const sec of ['politique', 'international', 'europe', 'economie', 'climat']) {
    const leans = new Set(sources.filter((s) => s.sectors.includes(sec) && s.lean).map((s) => s.lean));
    assert.ok(leans.size >= 3, `${sec} : au moins 3 sensibilités (trouvé : ${[...leans].join(', ')})`);
  }
  for (const sec of ['politique', 'international']) {
    const left = sources.filter((s) => s.sectors.includes(sec) && ['left', 'center-left'].includes(s.lean)).length;
    const right = sources.filter((s) => s.sectors.includes(sec) && ['right', 'center-right'].includes(s.lean)).length;
    assert.ok(left >= 3 && right >= 3, `${sec} : équilibre gauche (${left}) / droite (${right})`);
  }
});
