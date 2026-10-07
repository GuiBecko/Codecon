import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchLevel, matchBadge, matchChips } from '../public/js/components.js';

test('matchLevel aplica a escala de cores (≥75 verde, ≥40 âmbar, senão cinza)', () => {
  assert.equal(matchLevel(87).level, 'high');
  assert.equal(matchLevel(75).level, 'high');
  assert.equal(matchLevel(74).level, 'mid');
  assert.equal(matchLevel(40).level, 'mid');
  assert.equal(matchLevel(39).level, 'low');
  assert.equal(matchLevel(0).level, 'low');
  assert.equal(matchLevel(87).label, '87% compatível');
  assert.equal(matchLevel(87).className, 'match-badge match-high');
});

test('matchLevel normaliza valores inválidos e fora da faixa', () => {
  assert.equal(matchLevel(null).score, 0);
  assert.equal(matchLevel('abc').score, 0);
  assert.equal(matchLevel(150).score, 100);
  assert.equal(matchLevel(-5).score, 0);
  assert.equal(matchLevel(66.6).label, '67% compatível');
});

test('matchBadge e matchChips escapam HTML', () => {
  assert.ok(matchBadge(50).includes('match-mid'));
  const html = matchChips(['<b>Node</b>'], ['Go&']);
  assert.ok(html.includes('&lt;b&gt;Node&lt;/b&gt;'));
  assert.ok(html.includes('Falta: Go&amp;'));
  assert.ok(html.includes('chip-match') && html.includes('chip-missing'));
  assert.equal(matchChips([], []), '');
  assert.equal(matchChips(undefined, null), '');
});
