import test from 'node:test';
import assert from 'node:assert/strict';
import { digestOf, followedSectors, keywordMatches, leadItem, leanSpread, localBullets, newCount, searchAll, sectorStories, sortStories, sourcesOfSector, storySpread, storyText, storyTitle, textBy, visibleIn, type View } from '../src/domain/select';
import { matchesQuery, norm, clip } from '../src/domain/text';
import { relTime, dateTime, edition, plural } from '../src/domain/format';
import { normalizeDigest, normalizeFeed } from '../src/domain/migrate';
import { makeT, translate } from '../src/i18n';
import type { Feed, SourceInfo, Story, Tx } from '../src/domain/types';

const NOW = Date.parse('2026-10-24T12:00:00Z');
const h = (n: number) => new Date(NOW - n * 3600000).toISOString();
const FR: View = { lang: 'fr' };
const EN: View = { lang: 'en' };
const it = (u: string, s: string, l: string, d = h(1)) => ({ u, t: u, s, d, l });
const st = (id: string, o: Partial<Story> & { fr?: Partial<Tx>; en?: Partial<Tx> }): Story => {
  const { fr, en, ...rest } = o;
  const tx: Story['tx'] = {};
  if (fr) tx.fr = { t: id, ...fr };
  if (en) tx.en = { t: id, ...en };
  return { id, title: id, sectors: ['espace'], date: h(1), first: h(2), lang: 'fr', score: 1, tx, items: [it('https://x/' + id, 'src-' + id, 'fr')], ...rest };
};
const feed: Feed = {
  v: 2, generatedAt: h(0), stories: [
    st('a', { score: 5, date: h(30), fr: { t: 'Ariane 6 : nouveau tir réussi', n: 'Le lanceur européen a décollé de Kourou' } }),
    st('b', { sectors: ['climat', 'europe'], score: 3, date: h(2), fr: { t: "Hydrogène vert : l'Allemagne accélère" } }),
    st('c', { lang: 'en', score: 4, date: h(5), items: [it('https://en/c', 'nasa', 'en')], en: { t: 'Moon lander contract awarded', u: 'https://en/c' }, fr: { t: 'Contrat attribué pour un atterrisseur lunaire', tr: 1, s: 'Résumé français', by: 'llm', u: 'https://en/c' } }),
    st('d', { score: 2, date: h(1), fr: { t: 'Autre sujet spatial' } }),
    st('e', { lang: 'en', score: 2, date: h(1), items: [it('https://en/e', 'nasa', 'en')], en: { t: 'English only story', n: 'Only English text' } }),
  ],
};

test('norm et recherche : accents, casse, préfixes', () => {
  assert.equal(norm('Hydrogène VERT !'), 'hydrogene vert');
  assert.ok(matchesQuery(norm('Hydrogène vert en Allemagne'), 'hydro vert'));
  assert.ok(!matchesQuery(norm('Hydrogène vert'), 'nucleaire'));
  assert.ok(matchesQuery('x', ''));
});

test('clip coupe proprement', () => {
  assert.equal(clip('court', 20), 'court');
  const c = clip('Un texte assez long pour être coupé quelque part, proprement.', 30);
  assert.ok(c.length <= 30 && c.endsWith('…'));
});

test('tri : importants (score) ou récents (date)', () => {
  const l = feed.stories.slice(0, 4);
  assert.deepEqual(sortStories(l, 'top').map((s) => s.id), ['a', 'c', 'b', 'd']);
  assert.deepEqual(sortStories(l, 'recent').map((s) => s.id), ['d', 'b', 'c', 'a']);
});

test('langue : jamais de mélange, un sujet n\'apparaît que dans une langue où il existe', () => {
  assert.deepEqual(sectorStories(feed, 'espace', FR).map((s) => s.id), ['a', 'c', 'd']);
  assert.deepEqual(sectorStories(feed, 'espace', EN).map((s) => s.id), ['c', 'e']);
  assert.equal(storyTitle(feed.stories[2], 'fr'), 'Contrat attribué pour un atterrisseur lunaire');
  assert.equal(storyTitle(feed.stories[2], 'en'), 'Moon lander contract awarded');
  assert.equal(storyText(feed.stories[0], 'fr'), 'Le lanceur européen a décollé de Kourou');
  assert.equal(storyText(feed.stories[0], 'en'), '', 'pas de texte inventé dans l\'autre langue');
  assert.equal(textBy(feed.stories[2], 'fr'), 'llm');
  assert.equal(textBy(feed.stories[0], 'fr'), null);
});

test('secteur : non lus et recherche dans la langue choisie', () => {
  assert.deepEqual(sectorStories(feed, 'espace', FR, { unreadOnly: true, read: { a: 'x' } }).map((s) => s.id), ['c', 'd']);
  assert.deepEqual(sectorStories(feed, 'espace', FR, { query: 'lunaire' }).map((s) => s.id), ['c']);
  assert.deepEqual(sectorStories(feed, 'espace', EN, { query: 'lunaire' }).map((s) => s.id), [], 'le titre français n\'est pas cherché en mode anglais');
  assert.deepEqual(sectorStories(feed, 'espace', EN, { query: 'lander' }).map((s) => s.id), ['c']);
});

test('sources masquées : un sujet disparaît d\'un secteur si toutes ses sources y sont masquées', () => {
  const v: View = { lang: 'fr', off: { espace: ['src-a', 'nasa'] } };
  assert.deepEqual(sectorStories(feed, 'espace', v).map((s) => s.id), ['d']);
  assert.ok(visibleIn(feed.stories[1], 'climat', v), 'masquer dans un secteur ne touche pas les autres');
  const multi = st('m', { items: [it('https://x/1', 'a1', 'fr'), it('https://x/2', 'b2', 'fr')], fr: { t: 'Multi' } });
  assert.ok(visibleIn(multi, 'espace', { lang: 'fr', off: { espace: ['a1'] } }), 'il reste une source active');
  assert.ok(!visibleIn(multi, 'espace', { lang: 'fr', off: { espace: ['a1', 'b2'] } }));
});

test('recherche globale limitée aux secteurs suivis', () => {
  assert.deepEqual(searchAll(feed, 'hydrogene', ['climat'], FR).map((s) => s.id), ['b']);
  assert.deepEqual(searchAll(feed, 'hydrogene', ['espace'], FR).map((s) => s.id), []);
  assert.deepEqual(searchAll(feed, 'english', ['espace'], EN).map((s) => s.id), ['e']);
});

test('mots suivis', () => {
  assert.deepEqual(keywordMatches(feed, ['ariane'], FR).map((s) => s.id), ['a']);
  assert.deepEqual(keywordMatches(feed, ['lanceur', 'allemagne'], FR).map((s) => s.id), ['b', 'a']);
  assert.deepEqual(keywordMatches(feed, ['lander'], FR), []);
  assert.deepEqual(keywordMatches(feed, ['lander'], EN).map((s) => s.id), ['c']);
  assert.deepEqual(keywordMatches(feed, [], FR), []);
});

test('nouveaux : 36 h (7 jours pour l\'emploi), non lus, dans la langue', () => {
  assert.equal(newCount(feed, 'espace', {}, FR, NOW), 3);
  assert.equal(newCount(feed, 'espace', { a: 'x', d: 'x' }, FR, NOW), 1);
  assert.equal(newCount(feed, 'espace', {}, FR, NOW + 10 * 3600000), 2, 'a (40 h) sort de la fenêtre');
  assert.equal(newCount(feed, 'espace', {}, EN, NOW), 2);
  const jobs = [st('j', { sectors: ['emploi'], date: h(100), fr: { t: 'Ingénieur' } })];
  assert.equal(newCount({ ...feed, stories: jobs }, 'emploi', {}, FR, NOW), 1, 'une offre de 4 jours est encore nouvelle');
});

test('article de tête : celui de la langue choisie', () => {
  const s = st('x', { items: [it('https://fr/1', 'lm', 'fr'), it('https://en/1', 'bbc', 'en')], fr: { t: 'f', u: 'https://fr/1' }, en: { t: 'e', u: 'https://en/1' } });
  assert.equal(leadItem(s, 'fr').u, 'https://fr/1');
  assert.equal(leadItem(s, 'en').u, 'https://en/1');
});

test('secteurs suivis', () => {
  const all = ['a', 'b', 'c'];
  assert.deepEqual(followedSectors(all, { followed: null }), all);
  assert.deepEqual(followedSectors(all, { followed: ['c', 'a'] }), ['a', 'c']);
});

test('digest : puces dans la langue, sujets masqués écartés, repli sur le titre', () => {
  const byId = new Map(feed.stories.map((s) => [s.id, s]));
  const bullets = [{ t: { fr: 'Puce française', en: 'English bullet' }, ids: ['c'] }, { t: { fr: 'Autre' }, ids: ['d'] }, { t: { fr: 'Caché' }, ids: ['a'] }];
  assert.deepEqual(localBullets(bullets, 'espace', { lang: 'fr', off: { espace: ['src-a'] } }, byId).map((b) => b.text), ['Puce française', 'Autre']);
  assert.deepEqual(localBullets(bullets, 'espace', EN, byId).map((b) => b.text), ['English bullet'], 'les puces sans texte anglais et sans sujet anglais disparaissent');
  assert.deepEqual(localBullets([{ t: {}, ids: ['e'] }], 'espace', EN, byId).map((b) => b.text), ['English only story'], 'sans texte : titre du sujet');
  assert.deepEqual(digestOf(null, 'espace'), []);
});

test('lecture tolérante de l\'ancien format (v1)', () => {
  const f = normalizeFeed({ v: 1, generatedAt: h(0), stories: [
    { id: 'o', title: 'Moon lander', titleFr: 'Atterrisseur', lang: 'en', sectors: ['espace'], date: h(1), first: h(1), snippet: 'Snippet', summary: 'Résumé', summaryBy: 'llm', summaryLang: 'fr', score: 1, items: [it('https://en/o', 'nasa', 'en')] },
    { id: 'p', title: 'Titre', lang: 'fr', sectors: ['espace'], date: h(1), first: h(1), snippet: 'Extrait', summary: null, summaryBy: null, score: 1, items: [it('https://fr/p', 'lm', 'fr')] },
    { broken: true },
  ] });
  assert.equal(f.stories.length, 2);
  const [o, p] = f.stories;
  assert.equal(o.tx.fr?.t, 'Atterrisseur');
  assert.equal(o.tx.fr?.s, 'Résumé');
  assert.equal(o.tx.en?.t, 'Moon lander');
  assert.equal(p.tx.fr?.n, 'Extrait');
  assert.equal(p.tx.en, undefined);
  const d = normalizeDigest({ v: 1, generatedAt: h(0), by: 'llm', brief: [{ sector: 'espace', text: 'Puce', ids: ['o'] }], sectors: { espace: { by: 'llm', bullets: [{ text: 'Autre', ids: ['p'] }] } } })!;
  assert.deepEqual(d.brief[0].t, { fr: 'Puce' });
  assert.deepEqual(d.sectors.espace.bullets[0].t, { fr: 'Autre' });
  assert.equal(normalizeDigest(null), null);
});

test('sources par secteur et répartition des sensibilités', () => {
  const src = (id: string, name: string, sectors: string[], lean?: SourceInfo['lean']): SourceInfo => ({ id, name, lang: 'fr', country: 'FR', kind: 'presse', sectors, weight: 1, lean });
  const sources = new Map([
    src('l', 'Zeta', ['politique'], 'left'), src('cl', 'Alpha', ['politique'], 'center-left'), src('c', 'Mid', ['politique', 'europe'], 'center'),
    src('r', 'Beta', ['politique'], 'right'), src('cr', 'Gamma', ['politique'], 'center-right'), src('x', 'Agence', ['politique']),
  ].map((s) => [s.id, s]));
  const pol = sourcesOfSector(sources, 'politique');
  assert.deepEqual(pol.map((s) => s.name), ['Agence', 'Alpha', 'Beta', 'Gamma', 'Mid', 'Zeta']);
  assert.deepEqual(leanSpread(pol), { left: 2, center: 1, right: 2, unknown: 1 });
  assert.deepEqual(sourcesOfSector(sources, 'europe').map((s) => s.id), ['c']);
  const story = st('s', { items: [it('u1', 'l', 'fr'), it('u2', 'r', 'fr'), it('u3', 'r', 'fr')] });
  assert.deepEqual(storySpread(story, sources), { left: 1, center: 0, right: 1, unknown: 0 });
});

test('dates relatives, dans les deux langues', () => {
  assert.equal(relTime(h(0), 'fr', NOW), "à l'instant");
  assert.equal(relTime(h(0), 'en', NOW), 'just now');
  assert.equal(relTime(new Date(NOW - 15 * 60000).toISOString(), 'fr', NOW), 'il y a 15 min');
  assert.equal(relTime(new Date(NOW - 15 * 60000).toISOString(), 'en', NOW), '15 min ago');
  assert.equal(relTime(h(5), 'fr', NOW), 'il y a 5 h');
  assert.equal(relTime(h(5), 'en', NOW), '5 h ago');
  assert.equal(relTime(h(30), 'fr', NOW), 'hier');
  assert.equal(relTime(h(30), 'en', NOW), 'yesterday');
  assert.match(relTime(h(100), 'fr', NOW), /oct/);
  assert.match(relTime(h(100), 'en', NOW), /Oct/);
  assert.match(dateTime(h(3), 'fr'), / à /);
  assert.match(dateTime(h(3), 'en'), / at /);
  assert.equal(plural(2, 'nouveau', 'nouveaux'), '2 nouveaux');
  assert.ok(['morning', 'evening'].includes(edition(h(0))));
});

test('traductions : pluriels, variables, repli', () => {
  assert.equal(translate('fr', 'sources.n', { n: 1 }), '1 source');
  assert.equal(translate('fr', 'sources.n', { n: 0 }), '0 source');
  assert.equal(translate('fr', 'sources.n', { n: 3 }), '3 sources');
  assert.equal(translate('en', 'sources.n', { n: 1 }), '1 source');
  assert.equal(translate('en', 'sources.n', { n: 0 }), '0 sources');
  assert.equal(makeT('en')('common.updated', { when: 'just now' }), 'Updated just now');
  assert.equal(makeT('fr')('tab.reglages'), 'Réglages');
  assert.equal(makeT('en')('set.lang'), 'Language');
});
