import test from 'node:test';
import assert from 'node:assert/strict';
import { extractiveSummary, isUseless, plainBrief, readSummaries } from '../scripts/collect/summarize.mjs';
import { LLMClient, LLMError, parseJSONLoose } from '../scripts/collect/llm.mjs';

const TEXT = `Le lanceur européen Ariane 6 a décollé vendredi depuis Kourou avec deux satellites Galileo à son bord. ` +
  `Lire aussi : tous nos articles sur l’espace. Le lancement s’est déroulé sans incident et les satellites ont été placés sur leur orbite prévue. ` +
  `Abonnez-vous à notre newsletter pour ne rien manquer. Les responsables de l’ESA ont salué une réussite pour l’autonomie de l’Europe dans l’espace. ` +
  `Le prochain lancement est prévu en décembre avec deux autres satellites de la constellation Galileo.`;

test('extractiveSummary : phrases utiles seulement, au plus 3, dans l’ordre du texte', () => {
  const s = extractiveSummary(TEXT, { title: 'Ariane 6 lance deux satellites Galileo' });
  assert.ok(s.length > 60 && s.length <= 380);
  assert.ok(!/Lire aussi|Abonnez/.test(s));
  assert.ok(s.includes('Ariane 6'));
});

test('extractiveSummary : texte vide ou inexploitable', () => {
  assert.equal(extractiveSummary(''), '');
  assert.equal(extractiveSummary('Lire aussi : bla. Abonnez-vous maintenant à la newsletter.'), '');
});

test('isUseless : un résumé qui répète le titre ou une métadonnée ne sert à rien', () => {
  assert.ok(isUseless('Implicit Gas-Kinetic Scheme', 'Implicit Gas-Kinetic Scheme'));
  assert.ok(isUseless('Publication date: January 2027 Source: JCP', 'Autre titre'));
  assert.ok(!isUseless('Les chercheurs décrivent un schéma implicite plus stable pour les écoulements compressibles.', 'Implicit Gas-Kinetic Scheme'));
});

test('parseJSONLoose : JSON entouré de clôtures ou de texte', () => {
  assert.deepEqual(parseJSONLoose('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJSONLoose('Voici : {"a":[1,2]} merci'), { a: [1, 2] });
  assert.equal(parseJSONLoose('pas du json'), null);
});

test('readSummaries : ignore les identifiants inconnus et les résumés trop courts', () => {
  const ok = 'Le gouvernement a présenté son plan de relance doté de dix milliards d’euros, destiné aux PME.';
  const res = readSummaries({ items: [{ id: 'a', titre: 'Plan de relance', resume: ok }, { id: 'zz', resume: ok }, { id: 'b', resume: 'court' }] }, new Set(['a', 'b']));
  assert.equal(res.size, 1);
  assert.equal(res.get('a')!.titre, 'Plan de relance');
});

test('plainBrief : pas deux fois le même sujet', () => {
  const digests: any = {
    politique: [{ text: 'A', ids: ['s1'] }],
    international: [{ text: 'A', ids: ['s1'] }, { text: 'B', ids: ['s2'] }],
    europe: [{ text: 'A', ids: ['s1'] }],
  };
  const b = plainBrief(['politique', 'international', 'europe'], digests);
  assert.deepEqual(b.map((x) => x.text), ['A', 'B']);
});

test('LLMClient : réessaie après un 429, abandonne un fournisseur épuisé, bascule sur le suivant', async () => {
  const calls: string[] = [];
  const silent = () => {};
  const exhausted = { name: 'a', model: 'm', minIntervalMs: 0, async call() { calls.push('a'); throw new LLMError('quota', { status: 429, daily: true }); } };
  let n = 0;
  const flaky = { name: 'b', model: 'm', minIntervalMs: 0, async call() { calls.push('b'); if (n++ === 0) throw new LLMError('limite', { status: 429, retryAfter: 0.01 }); return '{"ok":true}'; } };
  const llm = new LLMClient([exhausted, flaky], { maxRequests: 10, log: silent });
  const res = await llm.json({ system: 's', user: 'u' });
  assert.deepEqual(res, { ok: true });
  assert.deepEqual(calls, ['a', 'b', 'b']);
  assert.equal(llm.providers[0].dead, true);
  await llm.json({ system: 's', user: 'u' });
  assert.equal(calls.filter((c) => c === 'a').length, 1, 'le fournisseur épuisé n’est plus sollicité');
});

test('LLMClient : plafond de requêtes', async () => {
  const p = { name: 'a', model: 'm', minIntervalMs: 0, async call() { return '{"x":1}'; } };
  const llm = new LLMClient([p], { maxRequests: 2, log: () => {} });
  await llm.json({ system: '', user: '' }); await llm.json({ system: '', user: '' });
  assert.equal(llm.available, false);
  assert.equal(await llm.json({ system: '', user: '' }), null);
});
