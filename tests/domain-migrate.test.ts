import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDigest, normalizeFeed } from '../src/domain/migrate';

const story = (id: string, sectors: string[]) => ({ id, title: id, lang: 'fr', sectors, date: '2026-10-28T10:00:00Z', first: '2026-10-28T10:00:00Z', score: 1, votes: {}, rel: 1, tx: { fr: { t: id } }, items: [] });

test('ancien fichier gardé hors ligne : le secteur supprimé « europe » devient « international »', () => {
  const f = normalizeFeed({ generatedAt: '2026-10-24T00:00:00Z', stories: [story('a', ['europe']), story('b', ['climat', 'europe']), story('c', ['europe', 'international']), story('d', ['inconnu'])] });
  assert.deepEqual(f.stories.map((s) => s.sectors), [['international'], ['climat', 'international'], ['international'], ['international']]);
});

test('ancien digest hors ligne : le secteur supprimé et ses puces sont écartés', () => {
  const d = normalizeDigest({
    generatedAt: '2026-10-24T00:00:00Z', by: 'x',
    sectors: { europe: { by: 'x', bullets: [{ t: { fr: 'E' }, ids: ['a'] }] }, politique: { by: 'x', bullets: [{ t: { fr: 'P' }, ids: ['b'] }] } },
    brief: [{ sector: 'europe', t: { fr: 'E' }, ids: ['a'] }, { sector: 'politique', t: { fr: 'P' }, ids: ['b'] }],
  })!;
  assert.deepEqual(Object.keys(d.sectors), ['politique']);
  assert.deepEqual(d.brief.map((b) => b.sector), ['politique']);
});
