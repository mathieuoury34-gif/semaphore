import test from 'node:test';
import assert from 'node:assert/strict';
import { activeFavorites, emptyState, favFromStory, favIn, mergeState, pruneRead, sanitize, stable, withFav, withoutFav } from '../src/domain/state';
import type { Story, UserState } from '../src/domain/types';

const story = (id: string, extra: Partial<Story> = {}): Story => ({
  id, title: 'Titre ' + id, sectors: ['espace'], date: '2026-10-23T10:00:00Z', first: '2026-10-23T09:00:00Z', lang: 'fr', score: 3,
  tx: { fr: { t: 'Titre ' + id, n: 'Extrait', s: 'Résumé du sujet ' + id, by: 'extractive', u: 'https://x.test/' + id, x: 'src' } }, items: [{ u: 'https://x.test/' + id, t: 'Titre ' + id, s: 'src', d: '2026-10-23T10:00:00Z', l: 'fr' }], ...extra,
});
const NOW = Date.parse('2026-10-24T12:00:00Z');
const iso = (h: number) => new Date(NOW - h * 3600000).toISOString();

test('favori : ajout puis retrait avec pierre tombale', () => {
  let s = emptyState();
  s = withFav(s, favFromStory(story('a'), () => 'Source A', iso(3)));
  assert.equal(activeFavorites(s).length, 1);
  assert.equal(activeFavorites(s)[0].source, 'Source A');
  s = withoutFav(s, 'a', iso(2));
  assert.equal(activeFavorites(s).length, 0);
  assert.ok(s.favorites.a, 'la pierre tombale est conservée pour la fusion');
});

test('fusion : les favoris de deux appareils s\'additionnent', () => {
  const a = withFav(emptyState(), favFromStory(story('a'), () => 'S', iso(5)));
  const b = withFav(emptyState(), favFromStory(story('b'), () => 'S', iso(4)));
  const m = mergeState(a, b, NOW);
  assert.deepEqual(activeFavorites(m).map((f) => f.id).sort(), ['a', 'b']);
});

test('fusion : un retrait plus récent l\'emporte, un ajout plus récent aussi', () => {
  const base = withFav(emptyState(), favFromStory(story('a'), () => 'S', iso(10)));
  const removed = withoutFav(base, 'a', iso(5));
  assert.equal(activeFavorites(mergeState(base, removed, NOW)).length, 0);
  const readded = withFav(removed, { ...favFromStory(story('a'), () => 'S', iso(1)) });
  assert.equal(activeFavorites(mergeState(removed, readded, NOW)).length, 1);
});

test('fusion : commutative et idempotente', () => {
  const a: UserState = { ...withFav(emptyState(), favFromStory(story('a'), () => 'S', iso(5))), read: { x: iso(3), y: iso(9) }, prefs: { followed: ['espace'], keywords: ['ariane'], lang: 'fr', off: {}, at: iso(8) }, updatedAt: iso(2) };
  const b: UserState = { ...withFav(emptyState(), favFromStory(story('b'), () => 'S', iso(4))), read: { y: iso(2), z: iso(6) }, prefs: { followed: null, keywords: [], lang: 'en', off: { climat: ['x'] }, at: iso(1) }, updatedAt: iso(1) };
  const ab = mergeState(a, b, NOW), ba = mergeState(b, a, NOW);
  assert.equal(stable(ab), stable(ba));
  assert.equal(stable(mergeState(ab, ab, NOW)), stable(ab));
  assert.equal(ab.read.y, iso(2), 'la lecture la plus récente est gardée');
  assert.equal(ab.prefs.at, iso(1), 'les réglages les plus récents l\'emportent');
  assert.equal(ab.prefs.lang, 'en', 'la langue choisie suit les réglages les plus récents');
  assert.deepEqual(ab.prefs.off, { climat: ['x'] });
});

test('fusion : les vieilles lectures et pierres tombales disparaissent', () => {
  const old = new Date(NOW - 100 * 86400000).toISOString();
  const a: UserState = { ...emptyState(), read: { vieux: new Date(NOW - 20 * 86400000).toISOString(), recent: iso(1) } };
  const b = withoutFav(withFav(emptyState(), favFromStory(story('a'), () => 'S', old)), 'a', old);
  const m = mergeState(a, b, NOW);
  assert.deepEqual(Object.keys(m.read), ['recent']);
  assert.equal(m.favorites.a, undefined);
  assert.deepEqual(Object.keys(pruneRead(a.read, NOW)), ['recent']);
});

test('sanitize : ignore les données invalides', () => {
  const s = sanitize({ favorites: { a: { title: 'ok', savedAt: iso(1) }, b: 42 }, read: { x: 3, y: iso(1) }, prefs: { followed: 'oops', keywords: ['a', 5] } });
  assert.deepEqual(Object.keys(s.favorites), ['a']);
  assert.deepEqual(Object.keys(s.read), ['y']);
  assert.equal(s.prefs.followed, null);
  assert.deepEqual(s.prefs.keywords, ['a']);
  assert.equal(stable(sanitize(null)), stable(emptyState()));
});

test('sanitize : langue et sources masquées', () => {
  const s = sanitize({ prefs: { lang: 'en', off: { climat: ['a', 'a', 3, 'b'], vide: [], faux: 'x' }, followed: null, keywords: [] } });
  assert.equal(s.prefs.lang, 'en');
  assert.deepEqual(s.prefs.off, { climat: ['a', 'b'] });
  assert.equal(sanitize({ prefs: { lang: 'de' } }).prefs.lang, 'fr', 'langue inconnue : français');
  assert.equal(sanitize({}).prefs.lang, 'fr');
});

test('favori : une copie par langue disponible, affichée dans la langue choisie', () => {
  const st = story('z', { lang: 'en', tx: {
    en: { t: 'Moon lander awarded', s: 'English summary', by: 'llm', u: 'https://en.test/z', x: 'en-src' },
    fr: { t: 'Atterrisseur lunaire attribué', s: 'Résumé français', by: 'llm', tr: 1, u: 'https://en.test/z', x: 'en-src' },
  }, items: [{ u: 'https://en.test/z', t: 'Moon lander awarded', s: 'en-src', d: '2026-10-23T10:00:00Z', l: 'en' }] });
  const f = favFromStory(st, (id) => 'Source ' + id, iso(1), 'fr');
  assert.equal(f.title, 'Atterrisseur lunaire attribué');
  assert.equal(favIn(f, 'en').title, 'Moon lander awarded');
  assert.equal(favIn(f, 'en').other, false);
  const old = { id: 'o', title: 'Ancien', summary: 's', sector: 'espace', date: iso(9), url: 'u', source: 'S', lang: 'fr', savedAt: iso(9) };
  assert.equal(favIn(old, 'fr').other, false);
  assert.equal(favIn(old, 'en').title, 'Ancien', 'un ancien favori reste lisible');
  assert.equal(favIn(old, 'en').other, true, 'mais il est signalé comme étant dans une autre langue');
});

test('stable : indépendant de l\'ordre des clés', () => {
  assert.equal(stable({ b: 1, a: { d: 1, c: [2, { z: 1, y: 2 }] } }), stable({ a: { c: [2, { y: 2, z: 1 }], d: 1 }, b: 1 }));
});
