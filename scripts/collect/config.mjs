// Chargement de la configuration (data-src/*.json) partagé par le robot, l'outil de test des sources et les tests.
import { readFileSync } from 'node:fs';
import { jobsUrl } from './jobs.mjs';

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));

/** Sources avec leur adresse de lecture complète (offres d'emploi : calculée d'après le service et l'identifiant). */
export function loadSources(path = 'data-src/sources.json') {
  return read(path).map((s) => (s.type && !s.url ? { ...s, url: jobsUrl(s.type, s.board) } : s));
}
export const loadSectors = (path = 'data-src/sectors.json') => read(path);
export const loadRules = (path = 'data-src/rules.json') => read(path);
