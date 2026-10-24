import test from 'node:test';
import assert from 'node:assert/strict';
import { followedSectors, keywordMatches, newCount, searchAll, sectorStories, sortStories, storyText, storyTitle } from '../src/domain/select';
import { matchesQuery, norm, clip } from '../src/domain/text';
import { relTime, edition, plural } from '../src/domain/format';
import type { Feed, Story } from '../src/domain/types';

const NOW = Date.parse('2026-10-24T12:00:00Z');
const h = (n: number) => new Date(NOW - n * 3600000).toISOString();
const st = (id: string, o: Partial<Story>): Story => ({ id, title: id, sectors: ['espace'], date: h(1), first: h(2), lang: 'fr', snippet: '', summary: null, summaryBy: null, score: 1, items: [], ...o });
const feed: Feed = {
  v: 1, generatedAt: h(0), stories: [
    st('a', { title: 'Ariane 6 : nouveau tir réussi', score: 5, date: h(30), snippet: 'Le lanceur européen a décollé de Kourou' }),
    st('b', { title: 'Hydrogène vert : l\'Allemagne accélère', sectors: ['climat', 'europe'], score: 3, date: h(2) }),
    st('c', { title: 'Moon lander contract awarded', lang: 'en', titleFr: 'Contrat attribué pour un atterrisseur lunaire', score: 4, date: h(5) }),
    st('d', { title: 'Autre sujet spatial', score: 2, date: h(1) }),
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
  assert.deepEqual(sortStories(feed.stories, 'top').map((s) => s.id), ['a', 'c', 'b', 'd']);
  assert.deepEqual(sortStories(feed.stories, 'recent').map((s) => s.id), ['d', 'b', 'c', 'a']);
});

test('secteur : filtre, non lus et recherche', () => {
  assert.deepEqual(sectorStories(feed, 'espace').map((s) => s.id), ['a', 'c', 'd']);
  assert.deepEqual(sectorStories(feed, 'espace', { unreadOnly: true, read: { a: 'x' } }).map((s) => s.id), ['c', 'd']);
  assert.deepEqual(sectorStories(feed, 'espace', { query: 'lunaire' }).map((s) => s.id), ['c'], 'la recherche porte aussi sur le titre français');
});

test('recherche globale limitée aux secteurs suivis', () => {
  assert.deepEqual(searchAll(feed, 'hydrogene', ['climat']).map((s) => s.id), ['b']);
  assert.deepEqual(searchAll(feed, 'hydrogene', ['espace']).map((s) => s.id), []);
});

test('mots suivis', () => {
  assert.deepEqual(keywordMatches(feed, ['ariane']).map((s) => s.id), ['a']);
  assert.deepEqual(keywordMatches(feed, ['lanceur', 'allemagne']).map((s) => s.id), ['b', 'a']);
  assert.deepEqual(keywordMatches(feed, []), []);
});

test('nouveaux : 36 h, non lus', () => {
  assert.equal(newCount(feed, 'espace', {}, NOW), 3); // a (30 h), c (5 h) et d (1 h)
  assert.equal(newCount(feed, 'espace', { a: 'x', d: 'x' }, NOW), 1);
  assert.equal(newCount(feed, 'espace', {}, NOW + 10 * 3600000), 2, 'a (40 h) sort de la fenêtre');
});

test('titre français et texte de lecture', () => {
  assert.equal(storyTitle(feed.stories[2]), 'Contrat attribué pour un atterrisseur lunaire');
  assert.equal(storyText(feed.stories[0]), 'Le lanceur européen a décollé de Kourou');
});

test('secteurs suivis', () => {
  const all = ['a', 'b', 'c'];
  assert.deepEqual(followedSectors(all, { followed: null, keywords: [], at: '' }), all);
  assert.deepEqual(followedSectors(all, { followed: ['c', 'a'], keywords: [], at: '' }), ['a', 'c']);
});

test('dates relatives', () => {
  assert.equal(relTime(h(0), NOW), "à l'instant");
  assert.equal(relTime(new Date(NOW - 15 * 60000).toISOString(), NOW), 'il y a 15 min');
  assert.equal(relTime(h(5), NOW), 'il y a 5 h');
  assert.equal(relTime(h(30), NOW), 'hier');
  assert.match(relTime(h(100), NOW), /oct/);
  assert.equal(plural(2, 'nouveau', 'nouveaux'), '2 nouveaux');
  assert.equal(plural(1, 'source'), '1 source');
  assert.ok(['Édition du matin', 'Édition du soir'].includes(edition(h(0))));
});
