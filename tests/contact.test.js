import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isBrazil, normalizeCountry, normalizeState, normalizePhone, normalizeLinkedin, BR_UFS,
} from '../server/contact.js';

const status = (fn) => {
  try {
    fn();
    return null;
  } catch (err) {
    return [err.status, err.message];
  }
};

test('isBrazil ignora acento e caixa', () => {
  for (const v of ['Brasil', 'brasil', ' BRASIL ', 'Brazil', 'brazil', 'Brásil']) assert.equal(isBrazil(v), true, v);
  for (const v of ['Portugal', 'Brasilia', '']) assert.equal(isBrazil(v), false, v);
});

test('normalizeCountry: vazio vira Brasil; máximo 60', () => {
  assert.equal(normalizeCountry(undefined), 'Brasil');
  assert.equal(normalizeCountry('  '), 'Brasil');
  assert.equal(normalizeCountry(' Portugal '), 'Portugal');
  assert.equal(status(() => normalizeCountry('x'.repeat(61)))[0], 400);
  assert.equal(status(() => normalizeCountry(5))[0], 400);
});

test('normalizeState: UF brasileira em maiúsculas', () => {
  assert.equal(BR_UFS.length, 27);
  assert.equal(normalizeState('sp', 'Brasil'), 'SP');
  assert.equal(normalizeState(' Pe ', 'brazil'), 'PE');
  assert.equal(normalizeState('', 'Brasil'), '');
  assert.equal(normalizeState(undefined, 'Brasil'), '');
  assert.deepEqual(status(() => normalizeState('XX', 'Brasil')), [400, 'Estado inválido']);
  assert.deepEqual(status(() => normalizeState('São Paulo', 'Brasil')), [400, 'Estado inválido']);
  assert.equal(normalizeState(' Lisboa ', 'Portugal'), 'Lisboa');
  assert.equal(status(() => normalizeState('x'.repeat(61), 'Portugal'))[0], 400);
});

test('normalizePhone Brasil: 10/11 dígitos formatados, prefixo +55', () => {
  const br = (v) => normalizePhone(v, 'Brasil');
  assert.equal(br(''), '');
  assert.equal(br(undefined), '');
  assert.equal(br('11988881111'), '(11) 98888-1111');
  assert.equal(br('(11) 98888-1111'), '(11) 98888-1111');
  assert.equal(br('1138881111'), '(11) 3888-1111');
  assert.equal(br('+55 11 98888-1111'), '(11) 98888-1111');
  assert.equal(br('55 11 3888-1111'), '(11) 3888-1111');
  const msg = 'Telefone inválido. Use DDD + número, ex.: (11) 98888-1111';
  for (const bad of ['98888-1111', '123', '119888811112', '+1 415 555 1234', 'abc']) {
    assert.deepEqual(status(() => br(bad)), [400, msg], bad);
  }
});

test('normalizePhone exterior: 8–15 dígitos com caracteres permitidos', () => {
  const pt = (v) => normalizePhone(v, 'Portugal');
  assert.equal(pt(' +351 912 345 678 '), '+351 912 345 678');
  assert.equal(pt('(415) 555-1234'), '(415) 555-1234');
  for (const bad of ['1234567', '+1234567890123456', '+351 912a345', '12345678+']) {
    assert.deepEqual(status(() => pt(bad)), [400, 'Telefone inválido'], bad);
  }
});

test('normalizeLinkedin aceita variações e rejeita o resto', () => {
  const url = 'https://www.linkedin.com/in/ana';
  assert.equal(normalizeLinkedin(''), '');
  assert.equal(normalizeLinkedin('linkedin.com/in/ana'), url);
  assert.equal(normalizeLinkedin('https://br.linkedin.com/in/ana/?x=1'), url);
  assert.equal(normalizeLinkedin('http://www.linkedin.com/in/ana/'), url);
  assert.equal(normalizeLinkedin('  ana-souza '), 'https://www.linkedin.com/in/ana-souza');
  const msg = 'LinkedIn inválido. Use linkedin.com/in/seu-perfil';
  for (const bad of ['https://evil.com/in/ana', 'javascript:alert(1)', 'ab', 'https://linkedin.com.evil.com/in/ana',
    'linkedin.com/company/acme', 'ana souza']) {
    assert.deepEqual(status(() => normalizeLinkedin(bad)), [400, msg], bad);
  }
});
