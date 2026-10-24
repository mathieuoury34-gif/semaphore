import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileRules, matchSectors, sectorsFor } from '../scripts/collect/classify.mjs';

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
