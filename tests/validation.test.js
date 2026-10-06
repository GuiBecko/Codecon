import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HttpError, text, oneOf, nonNegativeInt, parseId, normalizeTechs,
  techsToCsv, csvToTechs, SENIORITIES, WORK_MODELS,
} from '../server/validation.js';

function throwsHttp(fn, status = 400) {
  assert.throws(fn, (err) => err instanceof HttpError && err.status === status);
}

test('enums', () => {
  assert.deepEqual(SENIORITIES, ['estagio', 'junior', 'pleno', 'senior', 'especialista']);
  assert.deepEqual(WORK_MODELS, ['remoto', 'hibrido', 'presencial']);
});

test('text: trims, defaults and limits', () => {
  assert.equal(text('  oi  ', 'Campo'), 'oi');
  assert.equal(text(undefined, 'Campo'), '');
  assert.equal(text(null, 'Campo'), '');
  throwsHttp(() => text(123, 'Campo'));
  throwsHttp(() => text('   ', 'Campo', { required: true }));
  throwsHttp(() => text('abcdef', 'Campo', { max: 5 }));
  assert.equal(text('abcde', 'Campo', { max: 5 }), 'abcde');
});

test('oneOf', () => {
  assert.equal(oneOf('pleno', SENIORITIES, 'Senioridade'), 'pleno');
  throwsHttp(() => oneOf('master', SENIORITIES, 'Senioridade'));
  throwsHttp(() => oneOf(undefined, SENIORITIES, 'Senioridade'));
  assert.equal(oneOf('', SENIORITIES, 'Senioridade', { required: false }), null);
  assert.equal(oneOf(null, SENIORITIES, 'Senioridade', { required: false }), null);
  assert.equal(oneOf(undefined, SENIORITIES, 'Senioridade', { required: false }), null);
  throwsHttp(() => oneOf('x', SENIORITIES, 'Senioridade', { required: false }));
});

test('nonNegativeInt', () => {
  assert.equal(nonNegativeInt(5000, 'Salário'), 5000);
  assert.equal(nonNegativeInt('5000', 'Salário'), 5000);
  assert.equal(nonNegativeInt(0, 'Salário'), 0);
  for (const bad of ['', null, undefined, 'abc', '50.5', 50.5, -1, '-1', [], {}, true, ' ', '1e3']) {
    throwsHttp(() => nonNegativeInt(bad, 'Salário'));
  }
});

test('parseId', () => {
  assert.equal(parseId('12'), 12);
  for (const bad of ['abc', '0', '-1', '1.5', '', '12abc']) throwsHttp(() => parseId(bad), 404);
});

test('normalizeTechs', () => {
  assert.deepEqual(normalizeTechs(undefined), []);
  assert.deepEqual(normalizeTechs(null), []);
  assert.deepEqual(normalizeTechs(' React ,Node.js, react'), ['react', 'node.js']);
  assert.deepEqual(normalizeTechs(['React  Native', 'TypeScript, SQL', '']), ['react native', 'typescript', 'sql']);
  throwsHttp(() => normalizeTechs(42));
  throwsHttp(() => normalizeTechs([1]));
  throwsHttp(() => normalizeTechs(['a'.repeat(41)]));
  throwsHttp(() => normalizeTechs(Array.from({ length: 31 }, (_, i) => `t${i}`)));
  assert.equal(normalizeTechs(Array.from({ length: 30 }, (_, i) => `t${i}`)).length, 30);
});

test('csv helpers', () => {
  assert.equal(techsToCsv(['a', 'b c']), 'a,b c');
  assert.deepEqual(csvToTechs('a,b c'), ['a', 'b c']);
  assert.deepEqual(csvToTechs(''), []);
  assert.deepEqual(csvToTechs(null), []);
});
