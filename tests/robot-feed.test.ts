import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeItems, parseFeed } from '../scripts/collect/feed.mjs';

const RSS = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>T</title>
<item><title><![CDATA[Ariane 6 : un deuxième lancement réussi]]></title><link>https://exemple.fr/a?utm_source=rss</link><pubDate>Fri, 23 Oct 2026 08:15:00 GMT</pubDate>
<description><![CDATA[<p>Le lanceur européen a placé <b>deux satellites</b> en orbite.&nbsp;Lire la suite</p>]]></description></item>
<item><title>Titre sans lien</title><description>x</description></item>
<item><title>Futur lointain article de test</title><link>https://exemple.fr/futur</link><pubDate>Wed, 01 Jan 2031 00:00:00 GMT</pubDate></item>
<item><title>Ariane 6 : un deuxième lancement réussi</title><link>https://exemple.fr/a?utm_source=autre</link></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>A</title>
<entry><title type="html">Le CNES publie son rapport annuel</title><link rel="alternate" href="https://cnes.example/rapport"/><link rel="enclosure" href="https://cnes.example/x.pdf"/><id>urn:1</id><updated>2026-10-22T10:00:00Z</updated><summary>Résumé du rapport.</summary></entry></feed>`;

const RDF = `<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-r-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel rdf:about="x"><title>S</title></channel>
<item rdf:about="https://sci.example/1"><title>Une découverte en physique des particules</title><link>https://sci.example/1</link><dc:date>2026-10-21T09:30:00Z</dc:date><description>Des chercheurs annoncent un résultat.</description></item></rdf:RDF>`;

const ARXIV = `<?xml version="1.0"?><rss version="2.0" xmlns:arxiv="http://arxiv.org/schemas/atom"><channel><title>physics.flu-dyn</title>
<item><title>Large-eddy simulation of a jet (arXiv:2610.01234v1 [physics.flu-dyn])</title><link>https://arxiv.org/abs/2610.01234</link><description>arXiv:2610.01234v1 Announce Type: new
Abstract: We study the noise radiated by a turbulent jet.</description><pubDate>Fri, 23 Oct 2026 00:00:00 -0400</pubDate></item>
<item><title>Un article remplacé de plus long titre</title><link>https://arxiv.org/abs/2610.00001</link><description>arXiv:2610.00001v2 Announce Type: replace
Abstract: Ancien.</description></item></channel></rss>`;

test('RSS 2.0 : titre CDATA, lien nettoyé, extrait sans HTML, éléments invalides écartés', () => {
  const now = new Date('2026-10-24T00:00:00Z');
  const items = normalizeItems(parseFeed(RSS, { id: 's' }), { id: 's', lang: 'fr' }, now);
  assert.equal(items.length, 2, 'le doublon (même lien canonique) et l’élément sans lien sont écartés');
  assert.equal(items[0].url, 'https://exemple.fr/a');
  assert.equal(items[0].title, 'Ariane 6 : un deuxième lancement réussi');
  assert.ok(items[0].snippet.startsWith('Le lanceur européen a placé deux satellites en orbite.'));
  assert.equal(items[0].date, '2026-10-23T08:15:00.000Z');
  assert.ok(Date.parse(items[1].date) <= now.getTime() + 2 * 3600 * 1000, 'une date future est ramenée à maintenant');
});

test('Atom : lien alternatif choisi, date de mise à jour', () => {
  const items = normalizeItems(parseFeed(ATOM, {}), { id: 'c', lang: 'fr' });
  assert.equal(items[0].url, 'https://cnes.example/rapport');
  assert.equal(items[0].date, '2026-10-22T10:00:00.000Z');
  assert.equal(items[0].snippet, 'Résumé du rapport.');
});

test('RDF (RSS 1.0) : dc:date', () => {
  const items = normalizeItems(parseFeed(RDF, {}), { id: 'r', lang: 'en' });
  assert.equal(items.length, 1);
  assert.equal(items[0].date, '2026-10-21T09:30:00.000Z');
});

test('arXiv : préfixe retiré, version et catégorie ôtées du titre, « replace » ignoré', () => {
  const items = normalizeItems(parseFeed(ARXIV, {}), { id: 'a', lang: 'en', skipAnnounce: ['replace'] });
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Large-eddy simulation of a jet');
  assert.equal(items[0].snippet, 'We study the noise radiated by a turbulent jet.');
});

test('flux invalide', () => {
  assert.throws(() => parseFeed('<html><body>Just a moment...</body></html>', {}), /non reconnu/);
});
