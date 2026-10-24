import test from 'node:test';
import assert from 'node:assert/strict';
import { anySummaryTx, capPerSector, hasSummary, migrateStory, publicStory, refreshTx } from '../scripts/collect/stories.mjs';
import { attach, mergeAcrossLanguages } from '../scripts/collect/cluster.mjs';
import { llmBrief, llmSectorDigests, plainDigest } from '../scripts/collect/summarize.mjs';

const sources = new Map<string, any>([
  ['lm', { id: 'lm', weight: 2, kind: 'presse', lang: 'fr' }],
  ['bbc', { id: 'bbc', weight: 2, kind: 'presse', lang: 'en' }],
  ['fox', { id: 'fox', weight: 1, kind: 'presse', lang: 'en' }],
]);
const item = (url: string, title: string, sourceId: string, lang: string, date: string, sectors = ['international'], extra = {}) =>
  ({ url, title, sourceId, lang, date, snippet: 'Extrait de ' + title, sectors, rel: 0.5, ...extra });

test('attach : un sujet naît avec un bloc dans la langue de son article ; refreshTx choisit l’article de tête par langue', () => {
  const stories: any[] = [];
  attach(stories, [
    item('https://a/1', 'Frappes israéliennes sur Gaza : plusieurs morts dans la nuit', 'lm', 'fr', '2026-10-24T08:00:00Z'),
    item('https://a/2', 'Frappes israéliennes sur Gaza : de nombreux morts dans la nuit', 'fox', 'fr', '2026-10-24T09:00:00Z'),
  ], sources);
  assert.equal(stories.length, 1);
  refreshTx(stories[0], sources);
  assert.deepEqual(Object.keys(stories[0].tx), ['fr']);
  assert.equal(stories[0].tx.fr.u, 'https://a/1', 'source de plus fort poids');
  assert.equal(stories[0].tx.fr.x, 'lm');
});

test('offres d’emploi : une offre = un sujet, même si les titres sont presque identiques', () => {
  const stories: any[] = [];
  attach(stories, [
    item('https://j/1', 'Aerodynamics Engineer (m/f/d) — Isar Aerospace · Munich', 'job', 'en', '2026-10-24T08:00:00Z', ['emploi'], { noCluster: true }),
    item('https://j/2', 'Aerodynamics Engineer (m/f/d) — Isar Aerospace · Bremen', 'job', 'en', '2026-10-24T08:00:00Z', ['emploi'], { noCluster: true }),
  ], sources);
  assert.equal(stories.length, 2);
});

test('migrateStory : un sujet anglais résumé en français (ancien format) donne un bloc fr traduit et un bloc en', () => {
  const old: any = {
    id: 's1', title: 'Ukraine’s Starlink speeds restored', titleFr: 'Les débits Starlink de l’Ukraine rétablis', lang: 'en', sectors: ['international'], date: '2026-10-24T10:00:00Z', first: '2026-10-24T09:00:00Z',
    snippet: 'Speeds are back.', summary: 'Les débits de Starlink ont été rétablis en Ukraine après une semaine de perturbations.', summaryBy: 'llm', summaryLang: 'fr', score: 3,
    items: [{ u: 'https://b/1', t: 'Ukraine’s Starlink speeds restored', s: 'bbc', d: '2026-10-24T10:00:00Z', l: 'en' }],
  };
  const m: any = migrateStory(old);
  assert.equal(m.tx.en.t, 'Ukraine’s Starlink speeds restored');
  assert.equal(m.tx.en.n, 'Speeds are back.');
  assert.equal(m.tx.fr.t, 'Les débits Starlink de l’Ukraine rétablis');
  assert.equal(m.tx.fr.tr, 1);
  assert.equal(m.tx.fr.by, 'llm');
  assert.ok(m.tx.fr.s.startsWith('Les débits'));
  assert.ok(!('summary' in m) && !('titleFr' in m));
  assert.equal(migrateStory(m), m, 'idempotent');
});

test('migrateStory : sujet français résumé par extraction', () => {
  const m: any = migrateStory({ id: 's2', title: 'Titre', lang: 'fr', sectors: ['politique'], date: 'x', first: 'x', snippet: 'Extrait', summary: 'Phrase utile du texte.', summaryBy: 'extractive', summaryLang: 'fr', items: [{ u: 'u', t: 'Titre', s: 'lm', d: 'x', l: 'fr' }] });
  assert.equal(m.tx.fr.by, 'extractive');
  assert.equal(m.tx.en, undefined);
  assert.ok(hasSummary(m));
});

test('mergeAcrossLanguages : le même événement en français et en anglais est fusionné d’après le titre traduit', () => {
  const stories: any[] = [];
  attach(stories, [
    item('https://fr/1', 'Starlink : les débits rétablis en Ukraine après une semaine de perturbations au front', 'lm', 'fr', '2026-10-24T08:00:00Z'),
    item('https://en/1', 'Ukraine’s Starlink speeds restored after week of frontline disruption', 'bbc', 'en', '2026-10-24T09:00:00Z'),
    item('https://en/2', 'Rome hosts a summit on housing', 'bbc', 'en', '2026-10-24T09:30:00Z'),
  ], sources);
  assert.equal(stories.length, 3, 'pas de fusion avant traduction');
  for (const st of stories) refreshTx(st, sources);
  const en = stories.find((s) => s.items[0].u === 'https://en/1');
  en.tx.fr = { t: 'Starlink : les débits rétablis en Ukraine après une semaine de perturbations sur le front', tr: 1, s: 'Résumé français de la dépêche anglaise.', by: 'llm', u: 'https://en/1', x: 'bbc' };
  const r = mergeAcrossLanguages(stories, sources);
  assert.equal(r.merged, 1);
  assert.equal(r.stories.length, 2);
  const fused = (r.stories as any[]).find((s) => s.items.length === 2)!;
  assert.deepEqual(fused.items.map((i: any) => i.l).sort(), ['en', 'fr']);
  assert.ok(fused.tx.en, 'le sujet français reçoit le bloc anglais natif');
  refreshTx(fused, sources);
  assert.equal(fused.tx.fr.tr, undefined, 'plus de titre traduit : il existe un article français');
  assert.equal(fused.tx.fr.u, 'https://fr/1');
  assert.equal(fused.tx.en.u, 'https://en/1');
});

test('mergeAcrossLanguages : des événements différents ne sont pas fusionnés', () => {
  const stories: any[] = [];
  attach(stories, [
    item('https://fr/1', 'Le Parlement européen vote le budget de l’Union pour 2027', 'lm', 'fr', '2026-10-24T08:00:00Z'),
    item('https://en/1', 'Ukraine’s Starlink speeds restored after week of frontline disruption', 'bbc', 'en', '2026-10-24T09:00:00Z'),
  ], sources);
  for (const st of stories) refreshTx(st, sources);
  stories[1].tx.fr = { t: 'Les débits Starlink de l’Ukraine rétablis après une semaine de perturbations', tr: 1 };
  assert.equal(mergeAcrossLanguages(stories, sources).merged, 0);
});

test('capPerSector : un secteur prolifique n’étouffe pas les autres', () => {
  const mk = (id: string, sector: string, score: number) => ({ id, sectors: [sector], score, date: '2026-10-24' });
  const list = [...Array.from({ length: 10 }, (_, i) => mk('i' + i, 'international', 10 - i)), mk('e1', 'espace', 0.1), ...Array.from({ length: 5 }, (_, i) => mk('j' + i, 'emploi', 0.1))];
  const kept = capPerSector(list, 3);
  assert.equal(kept.filter((s: any) => s.sectors[0] === 'international').length, 3);
  assert.ok(kept.some((s: any) => s.id === 'e1'));
  assert.equal(kept.filter((s: any) => s.sectors[0] === 'emploi').length, 5, 'quota plus large pour les offres');
});

test('publicStory : pas de champ interne, pas d’ancien format', () => {
  const st: any = { id: 's', title: 'T', lang: 'fr', sectors: ['politique'], date: 'd', first: 'f', score: 1, votes: { politique: 1 }, tx: { fr: { t: 'T' } }, items: [], titleLocked: true };
  const p: any = publicStory(st);
  assert.ok(!('titleLocked' in p) && !('summary' in p));
  assert.deepEqual(p.tx, { fr: { t: 'T' } });
});

test('digests bilingues : puces dans les deux langues, repli sur une seule langue, références vers les sujets', async () => {
  const fake: any = {
    available: true,
    async json({ user }: { user: string }) {
      const sectors = JSON.parse(user);
      assert.ok(sectors.politique.sujets.length >= 2);
      return { secteurs: { politique: [
        { fr: 'Le gouvernement présente son plan', en: 'The government unveils its plan', refs: [1, 2] },
        { fr: 'Seulement en français ici', refs: [2] },
        { en: 'x', refs: [1] },
      ] } };
    },
  };
  const res = await llmSectorDigests(fake, [{ id: 'politique', name: 'Politique', stories: [{ id: 'a', title: 'A', summary: 'a' }, { id: 'b', title: 'B', summary: 'b' }] }]);
  assert.equal(res.politique.length, 2, 'une puce sans texte exploitable est écartée');
  assert.deepEqual(res.politique[0].t, { fr: 'Le gouvernement présente son plan', en: 'The government unveils its plan' });
  assert.deepEqual(res.politique[0].ids, ['a', 'b']);
  assert.deepEqual(res.politique[1].t, { fr: 'Seulement en français ici' });
});

test('brief bilingue', async () => {
  const digests: any = {
    politique: [{ t: { fr: 'P1', en: 'P1 en' }, ids: ['a'] }],
    europe: [{ t: { fr: 'E1', en: 'E1 en' }, ids: ['b'] }],
    ia: [{ t: { fr: 'I1', en: 'I1 en' }, ids: ['c'] }],
  };
  const fake: any = { available: true, async json() { return { brief: [
    { secteur: 'politique', fr: 'Brief politique assez long', en: 'Political brief long enough', ref: 1 },
    { secteur: 'europe', fr: 'Brief Europe assez long', en: 'Europe brief long enough', ref: 1 },
    { secteur: 'ia', fr: 'Brief IA assez long ici', en: 'AI brief long enough here', ref: 1 },
    { secteur: 'inconnu', fr: 'Secteur inconnu écarté', en: 'Unknown sector dropped', ref: 1 },
  ] }; } };
  const b = await llmBrief(fake, digests, { politique: 'Politique', europe: 'Europe', ia: 'IA' });
  assert.equal(b!.length, 3);
  assert.deepEqual(b![0].ids, ['a']);
  assert.equal((b![2].t as any).en, 'AI brief long enough here');
});

test('plainDigest : un titre par langue disponible, rien si aucune langue', () => {
  const rows = plainDigest([
    { id: 'a', tx: { fr: { t: 'Titre FR' }, en: { t: 'Title EN' } } },
    { id: 'b', tx: { en: { t: 'Only EN' } } },
    { id: 'c', tx: {} },
  ], 5);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[1].t, { en: 'Only EN' });
});

test('anySummaryTx : préfère la langue de l’article de tête', () => {
  const st: any = { lang: 'en', tx: { fr: { t: 'T', s: 'résumé fr' }, en: { t: 'T', s: 'summary en' } } };
  assert.equal(anySummaryTx(st).s, 'summary en');
});
