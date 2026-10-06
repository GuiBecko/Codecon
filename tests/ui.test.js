import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml, formatMoney, formatDate, formatSalaryRange, formatMonth, options, initials,
} from '../public/js/ui.js';
import { homeFor } from '../public/js/session.js';

test('escapeHtml escapa caracteres especiais de HTML', () => {
  assert.equal(escapeHtml('<a href="x">\'&'), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(42), '42');
});

test('formatMoney formata em BRL sem centavos', () => {
  const out = formatMoney(5000);
  assert.ok(out.includes('5.000'), out);
  assert.ok(out.includes('R$'), out);
  assert.ok(!out.includes(','), out);
  assert.equal(formatMoney(null), '');
});

test('formatSalaryRange monta a faixa', () => {
  const out = formatSalaryRange(5000, 8000);
  assert.ok(out.includes('5.000') && out.includes('8.000'), out);
});

test('formatDate converte data UTC do SQLite para dd/mm/aaaa', () => {
  assert.equal(formatDate('2026-10-06 12:00:00'), '06/10/2026');
  assert.equal(formatDate(''), '');
  assert.equal(formatDate('lixo'), '');
});

test('formatMonth converte AAAA-MM', () => {
  assert.equal(formatMonth('2024-03'), 'mar/2024');
});

test('options escapa valores e marca o selecionado', () => {
  const html = options({ a: 'A', '"x': '<b>' }, 'a', { placeholder: 'Todas' });
  assert.ok(html.includes('<option value="a" selected>A</option>'), html);
  assert.ok(html.includes('&quot;x') && html.includes('&lt;b&gt;'), html);
  assert.ok(html.startsWith('<option value="">Todas</option>'), html);
});

test('initials', () => {
  assert.equal(initials('Ana Maria Souza'), 'AS');
  assert.equal(initials(''), '?');
});

test('homeFor devolve a home de cada perfil', () => {
  assert.equal(homeFor(null), '#/login');
  assert.equal(homeFor({ role: 'company' }), '#/empresa/vagas');
  assert.equal(homeFor({ role: 'candidate' }), '#/vagas');
});
