import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml, formatMoney, formatDate, formatSalaryRange, formatMonth, options, initials,
  formatBytes, formatLocation, missingProfileFields, slugify,
} from '../public/js/ui.js';
import { resumeHtml, experiencePeriod, educationStatus, attachedPdfHtml } from '../public/js/components.js';
import { resumeFileName } from '../public/js/resume-pdf.js';
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

test('formatBytes', () => {
  assert.equal(formatBytes(500), '500 B');
  assert.equal(formatBytes(2048), '2 KB');
  assert.equal(formatBytes(1.5 * 1024 * 1024), '1,5 MB');
  assert.equal(formatBytes(undefined), '');
});

test('formatLocation', () => {
  assert.equal(formatLocation({ city: 'São Paulo', state: 'SP', country: 'Brasil' }), 'São Paulo - SP');
  assert.equal(formatLocation({ city: 'São Paulo - SP', state: 'SP' }), 'São Paulo - SP');
  assert.equal(formatLocation({ city: 'Lisboa', state: '', country: 'Portugal' }), 'Lisboa, Portugal');
  assert.equal(formatLocation({}), '');
  assert.equal(formatLocation({ city: 'X', state: '(' }), 'X - (');
});

test('missingProfileFields', () => {
  assert.deepEqual(missingProfileFields({ fullName: 'Ana', seniority: 'pleno', technologies: ['react'] }), []);
  assert.deepEqual(missingProfileFields({}), ['Nome completo', 'Senioridade', 'Pelo menos uma tecnologia']);
});

test('slugify e nome do arquivo do PDF', () => {
  assert.equal(slugify('Ana Cárolina  Souza!'), 'ana-carolina-souza');
  assert.equal(resumeFileName({ fullName: 'João da Silva' }), 'curriculo-joao-da-silva.pdf');
  assert.equal(resumeFileName({}), 'curriculo.pdf');
});

test('experiencePeriod e educationStatus', () => {
  assert.equal(experiencePeriod({ inicio: '2022-03', fim: '', atual: true }), 'mar/2022 → atual');
  assert.equal(experiencePeriod({ inicio: '2020-03', fim: '2021-12', atual: false }), 'mar/2020 → dez/2021');
  assert.equal(experiencePeriod({ inicio: '2020-03', fim: '' }), 'mar/2020 → atual');
  assert.equal(educationStatus({ situacao: 'concluido', conclusao: '2021-12' }), 'Concluído em dez/2021');
  assert.equal(educationStatus({ situacao: 'em_andamento', conclusao: '2027-06' }), 'Em andamento · previsão jun/2027');
  assert.equal(educationStatus({ situacao: 'em_andamento', conclusao: '' }), 'Em andamento');
});

test('resumeHtml escapa dados e mostra localização, e-mail e situação', () => {
  const html = resumeHtml({
    email: 'a@b.com"><script>',
    city: '<b>Recife</b>', state: 'PE', country: 'Brasil',
    experiences: [{ cargo: '<i>Dev</i>', empresa: 'X', inicio: '2022-03', fim: '', atual: true, descricao: '<img>' }],
    education: [{ curso: 'ADS', instituicao: 'UFPE', situacao: 'em_andamento', conclusao: '2027-06' }],
  });
  assert.ok(!html.includes('<script>') && !html.includes('<img>') && !html.includes('<i>Dev'), html);
  assert.ok(html.includes('&lt;b&gt;Recife&lt;/b&gt; - PE'));
  assert.ok(html.includes('mar/2022 → atual'));
  assert.ok(html.includes('Em andamento · previsão jun/2027'));
  assert.ok(html.includes('href="mailto:a@b.com&quot;&gt;&lt;script&gt;"'));
});

test('attachedPdfHtml escapa o nome do arquivo', () => {
  const html = attachedPdfHtml({ name: '<x>.pdf', size: 2048, uploadedAt: '2026-10-06 12:00:00' }, { href: '/api/x', removable: true });
  assert.ok(html.includes('&lt;x&gt;.pdf') && html.includes('2 KB') && html.includes('data-pdf-remove'));
  assert.equal(attachedPdfHtml(null), '');
});
