import test from 'node:test';
import assert from 'node:assert/strict';
import { attach, sameStory, vote } from '../scripts/collect/cluster.mjs';
import { rankStories } from '../scripts/collect/rank.mjs';
import { tokens } from '../scripts/collect/text.mjs';

const sources = new Map([
  ['lemonde', { id: 'lemonde', weight: 2, kind: 'presse' }],
  ['bfm', { id: 'bfm', weight: 1, kind: 'presse' }],
  ['esa', { id: 'esa', weight: 3, kind: 'institution' }],
]);
const it = (title: string, sourceId: string, date: string, sectors = ['politique'], url?: string) => ({ title, sourceId, date, sectors, lang: 'fr', snippet: '', url: url ?? `https://x.test/${sourceId}/${encodeURIComponent(title)}` });

test('sameStory : mêmes faits, titres différents', () => {
  assert.ok(sameStory(tokens('Moody’s maintient la note de la France à Aa3 avec perspective négative'), tokens('L’agence Moody’s maintient la note souveraine de la France, perspective négative')));
  assert.ok(!sameStory(tokens('Séisme de magnitude 7 au Tibet'), tokens('Séisme politique au Parlement européen')));
  assert.ok(!sameStory(tokens('Lancement d’Ariane 6'), tokens('Lancement d’un nouveau forfait mobile')));
});

test('attach : regroupe les titres proches, sépare les sujets distincts', () => {
  const stories: any[] = [];
  attach(stories, [
    it('Sébastien Lecornu en déplacement à Limoges après l’incendie de la mairie', 'lemonde', '2026-10-23T10:00:00Z'),
    it('Incendie de la mairie de Limoges : Sébastien Lecornu se rend sur place', 'bfm', '2026-10-23T11:00:00Z'),
    it('Ariane 6 : nouveau lancement réussi depuis Kourou', 'esa', '2026-10-23T12:00:00Z', ['espace']),
  ], sources);
  assert.equal(stories.length, 2);
  const limoges = stories.find((s) => s.items.length === 2);
  assert.ok(limoges);
  assert.equal(limoges.date, '2026-10-23T11:00:00Z');
});

test('attach : hors de la fenêtre de 72 h, ce sont deux sujets', () => {
  const stories: any[] = [];
  attach(stories, [
    it('Réforme des retraites : le gouvernement dévoile son projet', 'lemonde', '2026-10-10T10:00:00Z'),
    it('Réforme des retraites : le gouvernement dévoile son projet', 'bfm', '2026-10-23T10:00:00Z'),
  ], sources);
  assert.equal(stories.length, 2);
});

test('attach : titres sans contenu (émissions) ignorés', () => {
  const stories: any[] = [];
  attach(stories, [it('Émission du 23 octobre 2026', 'bfm', '2026-10-23T10:00:00Z'), it('Émission du 23 octobre 2026 (suite)', 'bfm', '2026-10-23T11:00:00Z')], sources);
  assert.equal(stories.length, 0);
});

test('vote : le secteur le plus cité devient principal', () => {
  const st: any = { sectors: ['international'], votes: {} };
  vote(st, ['international']);
  vote(st, ['politique', 'international']);
  vote(st, ['politique']);
  assert.equal(st.sectors[0], 'politique');
  assert.ok(st.sectors.length <= 3);
});

test('rankStories : plusieurs sources et institution > source seule ; la fraîcheur compte', () => {
  const now = Date.parse('2026-10-24T12:00:00Z');
  const a: any = { id: 'a', date: '2026-10-24T10:00:00Z', items: [{ s: 'lemonde' }, { s: 'bfm' }], rel: 0.5 };
  const b: any = { id: 'b', date: '2026-10-24T10:00:00Z', items: [{ s: 'bfm' }], rel: 0.5 };
  const c: any = { id: 'c', date: '2026-10-20T10:00:00Z', items: [{ s: 'esa' }, { s: 'lemonde' }], rel: 0.5 };
  rankStories([a, b, c], sources, now);
  assert.ok(a.score > b.score);
  assert.ok(a.score > c.score, 'un vieux sujet passe derrière un sujet frais');
});

test('rankStories : une offre d’emploi de 5 jours compte encore ; en France elle passe devant', () => {
  const now = Date.parse('2026-10-24T12:00:00Z');
  const fr: any = { id: 'j1', sectors: ['emploi'], date: '2026-10-19T12:00:00Z', items: [{ s: 'bfm' }], rel: 1 };
  const other: any = { id: 'j2', sectors: ['emploi'], date: '2026-10-19T12:00:00Z', items: [{ s: 'bfm' }], rel: 0.3 };
  const news: any = { id: 'n1', sectors: ['politique'], date: '2026-10-19T12:00:00Z', items: [{ s: 'bfm' }], rel: 1 };
  rankStories([fr, other, news], sources, now);
  assert.ok(fr.score > other.score);
  assert.ok(fr.score > 0.3, 'une offre de 5 jours garde un score utilisable');
  assert.ok(news.score < 0.1, 'une actualité de 5 jours est devenue sans intérêt');
});
