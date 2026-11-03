import test from 'node:test';
import assert from 'node:assert/strict';
import { NOTIF_DEFAULT, activeTimes, normalizeNotif, validTime } from '../src/domain/notif';

test('réglages par défaut : désactivées, 2 par jour à 7 h et 19 h', () => {
  assert.deepEqual(normalizeNotif(undefined), NOTIF_DEFAULT);
  assert.deepEqual(normalizeNotif('x'), NOTIF_DEFAULT);
  assert.equal(NOTIF_DEFAULT.on, false);
  assert.deepEqual(activeTimes(NOTIF_DEFAULT), []);
});

test('heures valides seulement, sinon valeur par défaut', () => {
  assert.ok(validTime('07:05') && validTime('23:59') && validTime('00:00'));
  assert.ok(!validTime('24:00') && !validTime('7:05') && !validTime('07:60') && !validTime(null));
  const n = normalizeNotif({ on: true, count: 2, times: ['06:30', 'bad'] });
  assert.deepEqual(n.times, ['06:30', '19:00']);
});

test('1 ou 2 notifications par jour, triées, sans doublon', () => {
  assert.deepEqual(activeTimes({ on: true, count: 1, times: ['08:00', '20:00'] }), ['08:00']);
  assert.deepEqual(activeTimes({ on: true, count: 2, times: ['20:00', '08:00'] }), ['08:00', '20:00']);
  assert.deepEqual(activeTimes({ on: true, count: 2, times: ['08:00', '08:00'] }), ['08:00']);
  assert.deepEqual(activeTimes({ on: false, count: 2, times: ['08:00', '20:00'] }), []);
  assert.equal(normalizeNotif({ on: true, count: 3 }).count, 2);
  assert.equal(normalizeNotif({ count: 1 }).count, 1);
});
