// Classement des sujets : fraîcheur, poids des sources, nombre de sources distinctes qui en parlent.
export function scoreStory(st, sources, now = Date.now()) {
  const ageH = Math.max(0, (now - Date.parse(st.date)) / 3600000);
  const fresh = Math.exp(-ageH / 30); // demi-vie ≈ 21 h
  const ws = st.items.map((i) => (sources.get(i.s)?.weight ?? 1) + (sources.get(i.s)?.kind === 'institution' ? 0.5 : 0));
  const distinct = new Set(st.items.map((i) => i.s)).size;
  const base = Math.max(...ws);
  const coverage = Math.log2(distinct) * 1.4;
  const kind = st.items.some((i) => sources.get(i.s)?.kind === 'institution') ? 0.4 : 0;
  const rel = 0.75 + 0.5 * (st.rel ?? 0.4); // un titre qui contient des termes forts du secteur passe devant
  return Math.round((base + coverage + kind) * rel * fresh * 100) / 100;
}

export function rankStories(stories, sources, now = Date.now()) {
  for (const st of stories) st.score = scoreStory(st, sources, now);
  return stories;
}

/** Sujets d'un secteur, du plus important au moins important. */
export function bySector(stories, sector) {
  return stories.filter((s) => s.sectors[0] === sector || s.sectors.includes(sector)).sort((a, b) => b.score - a.score || b.date.localeCompare(a.date));
}
