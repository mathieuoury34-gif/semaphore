import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileRules, matchSectors, reclassifyStory, sectorsFor } from '../scripts/collect/classify.mjs';

const rules = compileRules(JSON.parse(readFileSync('data-src/rules.json', 'utf8')));
const top = (title: string, snippet = '') => matchSectors(rules, title, snippet).map((m) => m.sector);

test('mots-clés forts dans le titre', () => {
  assert.ok(top('Ariane 6 place deux satellites en orbite').includes('espace'));
  assert.ok(top('OpenAI lance un nouveau modèle de langage').includes('ia'));
  assert.ok(top('Airbus livre son 10 000e avion').includes('aero'));
  assert.ok(top('Simulation numérique de la turbulence dans une tuyère').includes('metier'));
  assert.ok(top('Inflation : la BCE maintient ses taux').includes('economie'));
});

test('« mars » le mois ne déclenche pas l’espace, la planète si', () => {
  assert.ok(!top('Le budget sera voté le 12 mars').includes('espace'));
  assert.ok(top('Un rover explore la planète Mars').includes('espace') || top('Sample return mission to Mars').includes('espace'));
});

test('sigles sensibles à la casse : « ai » du français n’est pas l’IA', () => {
  assert.ok(!top("J'ai vu ce film hier soir").includes('ia'));
  assert.ok(top('Les agents IA débarquent dans les entreprises').includes('ia'));
  assert.ok(top('How AI agents change coding').includes('ia'));
});

test('mode fixed : secteur de la source + un secondaire si le titre le justifie', () => {
  const src = { sectors: ['science'] };
  const r = sectorsFor({ title: 'Un télescope spatial repère une exoplanète', snippet: '' }, src, rules);
  assert.equal(r.sectors[0], 'science');
  assert.ok(r.sectors.includes('espace'));
});

test('mode keywords : repli sur la source, ou écarté avec onlyMatched', () => {
  const src = { sectors: ['science'], mode: 'keywords' };
  assert.deepEqual(sectorsFor({ title: 'Une recette de tarte aux pommes', snippet: '' }, src, rules).sectors, ['science']);
  const strict = { sectors: ['metier'], mode: 'keywords', onlyMatched: true };
  assert.deepEqual(sectorsFor({ title: 'Une recette de tarte aux pommes', snippet: '' }, strict, rules).sectors, []);
  assert.ok(sectorsFor({ title: 'Boundary layer transition on a flat plate', snippet: '' }, strict, rules).sectors.includes('metier'));
});

test('exclude : cryogénie et thermique ne vont pas en Climat & énergie, l’hydrogène vert si', () => {
  assert.ok(!top('Thermodynamic modelling of thermal stratification in liquid hydrogen tanks').includes('climat'));
  assert.ok(!top('A cryogenic mechanical testing system for liquid hydrogen temperature applications').includes('climat'));
  assert.ok(!top('Modélisation thermique d’un réservoir d’hydrogène liquide', 'transfert thermique et hydrogène').includes('climat'));
  assert.ok(top('Hydrogène vert : l’Allemagne accélère son programme').includes('climat'));
  assert.ok(top('Le nucléaire redevient la première source d’électricité en France').includes('climat'));
  // une source dédiée au climat garde son secteur de base : l’exclusion ne vaut que pour les secteurs ajoutés par mots-clés
  const src = { sectors: ['climat'] };
  assert.equal(sectorsFor({ title: 'Les glaciers fondent plus vite', snippet: '' }, src, rules).sectors[0], 'climat');
});

// ---------------------------------------------------------------- tri des secteurs (règles « refine »)
const SOURCES = JSON.parse(readFileSync('data-src/sources.json', 'utf8')) as { id: string; sectors: string[]; mode?: string }[];
const SECTOR_IDS = new Set((JSON.parse(readFileSync('data-src/sectors.json', 'utf8')) as { id: string }[]).map((s) => s.id));
const source = (id: string) => SOURCES.find((s) => s.id === id)!;

test('le secteur Europe n’existe plus : aucune source ni règle n’y renvoie', () => {
  assert.ok(!SECTOR_IDS.has('europe'));
  for (const s of SOURCES) assert.ok(!s.sectors.includes('europe'), s.id);
  assert.ok(source('politico-eu').sectors.includes('international'));
});

test('politique étrangère : des législatives israéliennes ne sont pas de la politique française', () => {
  const src = source('france24');
  for (const title of ['Législatives en Israël : Nétanyahou face aux électeurs', 'Élections au Brésil : Lula l’emporte', 'Serbie : les étudiants remportent les législatives']) {
    const r = sectorsFor({ title, snippet: '' }, src, rules).sectors;
    assert.ok(!r.includes('politique'), title + ' → ' + r.join('+'));
    assert.equal(r[0], 'international');
  }
});

test('politique étrangère relayée par la presse politique française : passe en International, sauf repère français', () => {
  const src = source('lemonde-politique');
  assert.deepEqual(sectorsFor({ title: 'Midterms : la cote de Donald Trump remonte', snippet: '' }, src, rules).sectors.slice(0, 1), ['international']);
  const both = sectorsFor({ title: 'Emmanuel Macron et Donald Trump se parlent au téléphone', snippet: '' }, src, rules).sectors;
  assert.ok(both.includes('politique'), both.join('+'));
});

test('politique française relayée par un média européen : Politique en premier', () => {
  const r = sectorsFor({ title: 'Lecornu promet des réponses aux lycéens reçus à Matignon', snippet: '' }, source('euractiv-fr'), rules).sectors;
  assert.equal(r[0], 'politique');
});

test('mots trop larges : « gouvernement » et « président » ne suffisent plus à ajouter l’International', () => {
  const r = sectorsFor({ title: 'Rénovation des lycées : le gouvernement promet 4 milliards, selon un président de région', snippet: '' }, source('liberation-politique'), rules).sectors;
  assert.deepEqual(r, ['politique']);
});

test('sport : la presse sportive reste en Sport, jamais en International', () => {
  const r = sectorsFor({ title: 'Tout comprendre à la controverse entre la Chine et Kylian Mbappé', snippet: '' }, source('sport-lequipe'), rules).sectors;
  assert.deepEqual(r, ['sport']);
});

test('sport : un titre sportif d’un journal généraliste, ou sa rubrique sport, prend le Sport', () => {
  const src = source('france24');
  assert.equal(sectorsFor({ title: 'Ligue des champions : le PSG s’impose face à Barcelone', snippet: '' }, src, rules).sectors[0], 'sport');
  const byUrl = sectorsFor({ title: 'Carrick given chance to save job', snippet: '', url: 'https://www.bbc.com/sport/football/articles/abc' }, source('bbc-world'), rules).sectors;
  assert.equal(byUrl[0], 'sport');
  assert.ok(!byUrl.includes('international'));
  assert.ok(sectorsFor({ title: 'Guerre en Ukraine : nouvelle offensive russe', snippet: '' }, src, rules).sectors.every((s) => s !== 'sport'));
});

test('reclassement d’un sujet déjà publié : Europe disparaît, le sport quitte l’International', () => {
  const sm = new Map(SOURCES.map((s) => [s.id, s]));
  const st = {
    title: 'Kiev dénonce les Mondiaux d’haltérophilie', sectors: ['international', 'europe', 'sport'], votes: { international: 1, europe: 0.6, sport: 0.6 },
    items: [{ u: 'https://www.lequipe.fr/Haltero/a', t: 'Kiev dénonce les Mondiaux d’haltérophilie', d: '2026-10-28T10:00:00Z', l: 'fr', s: 'sport-lequipe' }],
  };
  reclassifyStory(st, sm, rules, SECTOR_IDS);
  assert.deepEqual(st.sectors, ['sport']);
  const old = { title: 'Réforme de la PAC', sectors: ['europe', 'economie'], items: [{ u: 'https://x/y', t: 'Réforme de la PAC', d: '2026-10-28T10:00:00Z', l: 'fr', s: 'unknown-source' }] };
  reclassifyStory(old, sm, rules, SECTOR_IDS);
  assert.deepEqual(old.sectors, ['economie']);
});
