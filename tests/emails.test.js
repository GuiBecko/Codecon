import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { buildRejectionEmail } from '../server/rejection-emails.js';
import { createMailer } from '../server/mailer.js';
import { createDb } from '../server/db.js';
import { createApp } from '../server/app.js';
import { setup, register, candidateWithProfile, createJob, fakeTransport } from './helpers.js';

const JOB = { id: 1, title: 'Dev Backend', seniority: 'senior', technologies: ['node', 'sql', 'docker'] };
const CANDIDATE = { fullName: 'Ana Souza Lima', seniority: 'junior', technologies: ['node'] };

test('outro_candidato: feedback com % e tecnologias, nota de senioridade', () => {
  const e = buildRejectionEmail({
    reason: 'outro_candidato', candidate: CANDIDATE, job: JOB, companyName: 'ACME',
    match: { matchScore: 33, matchedTechnologies: ['node'], missingTechnologies: ['sql', 'docker'] },
  });
  assert.equal(e.subject, 'Atualização sobre a vaga Dev Backend — ACME');
  for (const part of [e.text, e.html]) {
    assert.match(part, /Olá, Ana!/);
    assert.match(part, /Dev Backend/);
    assert.match(part, /ACME/);
    assert.match(part, /33%/);
    assert.match(part, /sql/);
    assert.match(part, /docker/);
    assert.match(part, /fortaleceriam seu perfil/);
    assert.match(part, /Sênior/);
    assert.match(part, /Júnior/);
  }
  assert.match(e.text, /selecionou outra pessoa/);
  assert.doesNotMatch(e.text, /outros fatores/);
});

test('outro_candidato: 100% das tecnologias → decisão por outros fatores, sem nota de senioridade', () => {
  const e = buildRejectionEmail({
    reason: 'outro_candidato', candidate: { ...CANDIDATE, seniority: 'senior' }, job: JOB, companyName: 'ACME',
    match: { matchScore: 100, matchedTechnologies: JOB.technologies, missingTechnologies: [] },
  });
  assert.match(e.text, /100%/);
  assert.match(e.text, /outros fatores/);
  assert.doesNotMatch(e.text, /fortaleceriam/);
  assert.doesNotMatch(e.text, /cadastrado como/);
});

test('vaga_encerrada: não é sobre o perfil, com recomendações (máx. 3) ou mensagem genérica', () => {
  const recs = [1, 2, 3, 4].map((i) => ({ title: `Vaga ${i}`, companyName: `Emp ${i}`, matchScore: 90 - i }));
  const e = buildRejectionEmail({
    reason: 'vaga_encerrada', candidate: CANDIDATE, job: JOB, companyName: 'ACME', recommendations: recs,
  });
  assert.match(e.subject, /Dev Backend/);
  assert.match(e.text, /encerrada pela empresa sem contratação/);
  assert.match(e.text, /não tem relação com o seu perfil/);
  assert.match(e.text, /Vaga 1 — Emp 1 \(89% de compatibilidade\)/);
  assert.match(e.html, /Vaga 3/);
  assert.doesNotMatch(e.text, /Vaga 4/);

  const none = buildRejectionEmail({ reason: 'vaga_encerrada', candidate: CANDIDATE, job: JOB, companyName: 'ACME' });
  assert.match(none.text, /Veja as vagas abertas/);
});

test('HTML escapa valores interpolados', () => {
  const evil = { ...JOB, title: '<script>alert(1)</script>' };
  for (const reason of ['outro_candidato', 'vaga_encerrada']) {
    const e = buildRejectionEmail({
      reason, candidate: { fullName: '<b>Eva</b>' }, job: evil, companyName: 'A&B',
      match: { matchScore: 0, matchedTechnologies: [], missingTechnologies: ['<img>'] },
      recommendations: [{ title: '<i>x</i>', companyName: 'C', matchScore: 50 }],
    });
    assert.doesNotMatch(e.html, /<script>|<b>Eva|<img>|<i>x/);
    assert.match(e.html, /&lt;script&gt;/);
    assert.match(e.html, /A&amp;B/);
  }
});

async function scenario(opts) {
  const ctx = setup(opts);
  const company = await register(ctx.app, 'company', { name: 'ACME' });
  const job = await createJob(company, { title: 'Dev Node', seniority: 'senior', technologies: ['node', 'sql'] });
  const other = await createJob(company, { title: 'Vaga Aberta', technologies: ['javascript'] });
  const ana = await candidateWithProfile(ctx.app, { fullName: 'Ana Lima', technologies: ['node'], seniority: 'junior' });
  const bia = await candidateWithProfile(ctx.app, { fullName: 'Bia Costa' });
  const caio = await candidateWithProfile(ctx.app, { fullName: 'Caio Reis' });
  const apps = {};
  for (const [k, c] of Object.entries({ ana, bia, caio })) {
    apps[k] = (await c.post(`/api/jobs/${job.id}/apply`)).body;
  }
  return { ...ctx, company, job, other, ana, bia, caio, apps };
}

const emailsRows = (db) => db.prepare('SELECT * FROM emails ORDER BY id').all();

test('close com contratação: e-mail outro_candidato só para quem estava em análise', async () => {
  const s = await scenario();
  // Caio já estava como não selecionado: não recebe outro e-mail.
  s.db.prepare("UPDATE applications SET status = 'nao_selecionado' WHERE id = ?").run(s.apps.caio.id);

  const res = await s.company.post(`/api/company/jobs/${s.job.id}/close`).send({ applicationId: s.apps.bia.id });
  assert.equal(res.status, 200);
  await s.mailer.idle();

  const rows = emailsRows(s.db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].to_email, s.ana.user.email);
  assert.equal(rows[0].reason, 'outro_candidato');
  assert.equal(rows[0].status, 'sent');
  assert.equal(rows[0].job_id, s.job.id);
  assert.match(rows[0].text, /Olá, Ana!/);
  assert.match(rows[0].text, /50%/);
  assert.match(rows[0].text, /sql/);
  assert.equal(s.mailTransport.sent.length, 1);
  assert.equal(s.mailTransport.sent[0].to, s.ana.user.email);
});

test('cancel: fecha sem contratação e avisa todos em análise com vaga_encerrada', async () => {
  const s = await scenario();
  const res = await s.company.post(`/api/company/jobs/${s.job.id}/cancel`);
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'closed');
  assert.equal(res.body.hiredApplicationId, null);
  const statuses = s.db.prepare('SELECT status FROM applications WHERE job_id = ?').all(s.job.id).map((r) => r.status);
  assert.deepEqual(statuses, ['nao_selecionado', 'nao_selecionado', 'nao_selecionado']);

  const closed = await s.company.get('/api/company/jobs?status=closed');
  assert.equal(closed.body[0].hiredCandidateName, null);

  await s.mailer.idle();
  const rows = emailsRows(s.db);
  assert.deepEqual(rows.map((r) => r.to_email).sort(), [s.ana, s.bia, s.caio].map((c) => c.user.email).sort());
  assert.ok(rows.every((r) => r.reason === 'vaga_encerrada' && r.status === 'sent'));
  const bia = rows.find((r) => r.to_email === s.bia.user.email);
  assert.match(bia.text, /Vaga Aberta — ACME \(100% de compatibilidade\)/);
  const ana = rows.find((r) => r.to_email === s.ana.user.email);
  assert.match(ana.text, /Veja as vagas abertas/);
});

test('cancel: erros 404/403/400', async () => {
  const s = await scenario();
  const outsider = await register(s.app, 'company');
  assert.equal((await s.company.post('/api/company/jobs/9999/cancel')).status, 404);
  assert.equal((await s.company.post('/api/company/jobs/abc/cancel')).status, 404);
  assert.equal((await outsider.post(`/api/company/jobs/${s.job.id}/cancel`)).status, 403);
  assert.equal((await s.ana.post(`/api/company/jobs/${s.job.id}/cancel`)).status, 403);
  assert.equal((await s.company.post(`/api/company/jobs/${s.job.id}/cancel`)).status, 200);
  const again = await s.company.post(`/api/company/jobs/${s.job.id}/cancel`);
  assert.equal(again.status, 400);
  assert.equal(again.body.error, 'Esta vaga já está fechada');
  assert.equal((await s.company.post(`/api/company/jobs/${s.job.id}/close`).send({ applicationId: s.apps.ana.id })).status, 400);
});

test('transporte com erro: resposta 200 e e-mails registrados como failed', async () => {
  const errors = console.error;
  console.error = () => {};
  try {
    const s = await scenario({ mailTransport: { sendMail: async () => { throw new Error('SMTP fora do ar'); } } });
    const res = await s.company.post(`/api/company/jobs/${s.job.id}/cancel`);
    assert.equal(res.status, 200);
    await s.mailer.idle();
    const rows = emailsRows(s.db);
    assert.equal(rows.length, 3);
    assert.ok(rows.every((r) => r.status === 'failed' && r.error === 'SMTP fora do ar'));
  } finally {
    console.error = errors;
  }
});

test('MAIL_REDIRECT_TO entrega no endereço de teste e mantém o destinatário original', async () => {
  const db = createDb(':memory:');
  const transport = fakeTransport();
  const mailer = createMailer({ db, transport, env: { MAIL_REDIRECT_TO: 'eu@teste.com', MAIL_FROM: 'X <x@y.com>' } });
  mailer.send({ to: 'ana@demo.com', subject: 'Oi', text: 't', html: '<p>t</p>', reason: 'vaga_encerrada' });
  await mailer.idle();
  assert.equal(transport.sent[0].to, 'eu@teste.com');
  assert.equal(transport.sent[0].from, 'X <x@y.com>');
  assert.equal(transport.sent[0].subject, '[para: ana@demo.com] Oi');
  const row = db.prepare('SELECT * FROM emails').get();
  assert.equal(row.to_email, 'ana@demo.com');
  assert.equal(row.status, 'sent');
});

test('GET /api/dev/emails lista os mais recentes; não existe em produção', async () => {
  const s = await scenario();
  await s.company.post(`/api/company/jobs/${s.job.id}/cancel`).expect(200);
  await s.mailer.idle();
  const res = await request(s.app).get('/api/dev/emails');
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 3);
  const ids = res.body.map((e) => e.id);
  assert.deepEqual(ids, [...ids].sort((a, b) => b - a));
  const e = res.body[0];
  for (const k of ['id', 'toEmail', 'subject', 'reason', 'jobId', 'status', 'html', 'text', 'createdAt']) {
    assert.ok(k in e, k);
  }

  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const prod = createApp({ db: createDb(':memory:'), sessionSecret: 's', uploadsDir: s.uploadsDir, mailTransport: fakeTransport() });
    assert.equal((await request(prod).get('/api/dev/emails')).status, 404);
  } finally {
    if (prev === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prev;
  }
});
