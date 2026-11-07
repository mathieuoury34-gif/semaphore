import test from 'node:test';
import assert from 'node:assert/strict';
import { moveItem, slotAt } from '../src/ui/reorder';

test('moveItem : avance, recule, bornes, sans modifier la liste d’origine', () => {
  const l = ['a', 'b', 'c', 'd'];
  assert.deepEqual(moveItem(l, 0, 2), ['b', 'c', 'a', 'd']);
  assert.deepEqual(moveItem(l, 3, 0), ['d', 'a', 'b', 'c']);
  assert.deepEqual(moveItem(l, 1, 1), l);
  assert.deepEqual(moveItem(l, 1, 99), ['a', 'c', 'd', 'b']);
  assert.deepEqual(moveItem(l, 9, 0), l);
  assert.deepEqual(l, ['a', 'b', 'c', 'd']);
});

test('slotAt : case qui contient le point, sinon la plus proche', () => {
  // grille 2 colonnes × 2 lignes, gouttière de 10 px
  const slots = [{ x: 0, y: 0, w: 100, h: 50 }, { x: 110, y: 0, w: 100, h: 50 }, { x: 0, y: 60, w: 100, h: 50 }, { x: 110, y: 60, w: 100, h: 50 }];
  assert.equal(slotAt(slots, 20, 20), 0);
  assert.equal(slotAt(slots, 150, 20), 1);
  assert.equal(slotAt(slots, 20, 100), 2);
  assert.equal(slotAt(slots, 105, 55), 0 + [0, 1, 2, 3].map((i) => i).indexOf(slotAt(slots, 105, 55)));
  assert.equal(slotAt(slots, 400, 400), 3);   // hors grille : la plus proche
  assert.equal(slotAt(slots, -50, -50), 0);
});
