import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalUrl, clip, decodeEntities, detectLang, norm, sentences, stripHtml, tokens } from '../scripts/collect/text.mjs';

test('stripHtml : balises, entités et HTML échappé deux fois', () => {
  assert.equal(stripHtml('<p>Bonjour&nbsp;<b>le</b> monde &amp; tous</p><script>x()</script>'), 'Bonjour le monde & tous');
  assert.equal(stripHtml('&lt;p&gt;Texte &amp;eacute; ok&lt;/p&gt;'), 'Texte é ok');
  assert.equal(stripHtml('a<br>b</p>c'), 'a b c');
});

test('decodeEntities : numériques et nommées', () => {
  assert.equal(decodeEntities('l&#8217;été &#x2014; &eacute;&euro;'), 'l’été — é€');
  assert.equal(decodeEntities('&inconnue; &#99999999;'), '&inconnue; &#99999999;');
});

test('norm : minuscules sans accents ni ponctuation', () => {
  assert.equal(norm('Éléphant : L’œuvre d’Ariane-6 !'), 'elephant l oeuvre d ariane 6');
});

test('tokens : mots significatifs, pluriels rapprochés, mots vides et dates ignorés', () => {
  const a = tokens('Le satellite Galileo lancé vendredi 23 octobre');
  assert.ok(a.has('satellite') && a.has('galileo') && a.has('lance'));
  assert.ok(!a.has('vendredi') && !a.has('octobre') && !a.has('le'));
  assert.deepEqual([...tokens('satellites')], [...tokens('satellite')]);
  assert.equal(tokens('Émission du 23 octobre 2026').size <= 2, true);
});

test('canonicalUrl : retire le suivi, le fragment et normalise', () => {
  assert.equal(canonicalUrl('https://Example.com/a/b/?utm_source=x&id=3&fbclid=zz#haut'), 'https://example.com/a/b?id=3');
  assert.equal(canonicalUrl('https://example.com/'), 'https://example.com/');
  assert.equal(canonicalUrl('javascript:alert(1)'), null);
  assert.equal(canonicalUrl('pas une url'), null);
});

test('clip : coupe au mot entier avec une ellipse', () => {
  assert.equal(clip('court', 20), 'court');
  const c = clip('Un texte beaucoup trop long pour tenir dans la limite fixée', 30);
  assert.ok(c.length <= 30 && c.endsWith('…') && !c.includes('  '));
});

test('sentences : découpe FR/EN sans couper les sigles ni les nombres décimaux', () => {
  const s = sentences('La fusée a décollé à 3,5 s du temps prévu. Elle atteint 12.4 km/s ! « Très bien », dit-il. Fin.');
  assert.equal(s.length, 4);
  assert.ok(s[0].includes('3,5'));
});

test('detectLang', () => {
  assert.equal(detectLang('Le gouvernement a annoncé que les mesures sont prévues pour la semaine prochaine dans le pays'), 'fr');
  assert.equal(detectLang('The government said that the measures are planned for next week in the country and that it has'), 'en');
});
