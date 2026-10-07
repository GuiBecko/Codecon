import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  UFS, isBrazil, formatBrPhone, validatePhone, normalizeLinkedin, normalizeUf,
} from '../public/js/validators.js';

test('UFS tem as 27 unidades federativas', () => {
  assert.equal(UFS.length, 27);
  assert.equal(new Set(UFS).size, 27);
  assert.ok(UFS.includes('SP') && UFS.includes('DF') && UFS.includes('TO'));
});

test('isBrazil', () => {
  for (const c of ['', '  ', null, undefined, 'Brasil', 'brasil', 'BRAZIL', ' Brasil ']) assert.equal(isBrazil(c), true, String(c));
  for (const c of ['Portugal', 'Estados Unidos', 'Argentina']) assert.equal(isBrazil(c), false, c);
});

test('formatBrPhone aplica a máscara de forma progressiva', () => {
  const steps = {
    '': '',
    1: '(1',
    11: '(11',
    119: '(11) 9',
    11988: '(11) 988',
    119888: '(11) 9888',
    1198888: '(11) 9888-8',
    1138881111: '(11) 3888-1111',
    11988881111: '(11) 98888-1111',
    119888811112: '(11) 98888-1111',
  };
  for (const [input, expected] of Object.entries(steps)) assert.equal(formatBrPhone(input), expected, input);
  assert.equal(formatBrPhone('(11) 98888-1111'), '(11) 98888-1111');
  assert.equal(formatBrPhone('+55 11 98888-1111'), '(11) 98888-1111');
  assert.equal(formatBrPhone('abc'), '');
});

test('validatePhone para Brasil', () => {
  assert.equal(validatePhone('', 'Brasil'), null);
  assert.equal(validatePhone('(11) 98888-1111', 'Brasil'), null);
  assert.equal(validatePhone('(11) 3888-1111', ''), null);
  assert.equal(validatePhone('+55 11 98888-1111', 'Brasil'), null);
  assert.ok(validatePhone('(11) 9888', 'Brasil'));
  assert.ok(validatePhone('119888811112', 'Brasil'));
  assert.ok(validatePhone('11 9888x1111', 'Brasil'));
  assert.ok(validatePhone('+11988881111', 'Brasil'), '"+" só com DDI 55');
});

test('validatePhone para outros países', () => {
  assert.equal(validatePhone('+1 555 123 4567', 'Estados Unidos'), null);
  assert.equal(validatePhone('+351 912 345 678', 'Portugal'), null);
  assert.ok(validatePhone('+1 555', 'Estados Unidos'));
  assert.ok(validatePhone('+1234567890123456', 'Portugal'));
  assert.ok(validatePhone('ligue 555-1234', 'Portugal'));
  assert.ok(validatePhone('912+345+678', 'Portugal'), '"+" só no início');
});

test('normalizeLinkedin', () => {
  const url = 'https://www.linkedin.com/in/ana-souza';
  assert.equal(normalizeLinkedin(''), '');
  assert.equal(normalizeLinkedin('   '), '');
  assert.equal(normalizeLinkedin('ana-souza'), url);
  assert.equal(normalizeLinkedin('linkedin.com/in/ana-souza'), url);
  assert.equal(normalizeLinkedin('www.linkedin.com/in/ana-souza/'), url);
  assert.equal(normalizeLinkedin('https://br.linkedin.com/in/ana-souza/?a=1'), url);
  assert.equal(normalizeLinkedin('http://linkedin.com/in/ana-souza#x'), url);
  assert.equal(normalizeLinkedin('linkedin.com/in/abc'), 'https://www.linkedin.com/in/abc');
  // o backend exige slug de 3 a 100 caracteres também na URL
  assert.equal(normalizeLinkedin('linkedin.com/in/x'), null);
  assert.equal(normalizeLinkedin('javascript:alert(1)'), null);
  assert.equal(normalizeLinkedin('https://evil.com/in/x'), null);
  assert.equal(normalizeLinkedin('https://linkedin.com.evil.com/in/x'), null);
  assert.equal(normalizeLinkedin('https://linkedin.com/company/acme'), null);
  assert.equal(normalizeLinkedin('ab'), null);
  assert.equal(normalizeLinkedin('ana souza'), null);
});

test('normalizeUf', () => {
  assert.equal(normalizeUf('sp'), 'SP');
  assert.equal(normalizeUf('XX'), '');
  assert.equal(normalizeUf(''), '');
});
