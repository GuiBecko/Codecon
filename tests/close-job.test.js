import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, register, candidateWithProfile, createJob, COMPLETE_PROFILE } from './helpers.js';

async function scenario() {
  const ctx = setup();
  const company = await register(ctx.app, 'company', { name: 'ACME' });
  const other = await register(ctx.app, 'company', { name: 'Outra' });
  const job = await createJob(company);
  const otherJob = await createJob(company, { title: 'Outra vaga' });
  const alice = await candidateWithProfile(ctx.app, { fullName: 'Alice' });
  const bob = await candidateWithProfile(ctx.app, { fullName: 'Bob' });
  const appA = (await alice.post(`/api/jobs/${job.id}/apply`)).body;
  const appB = (await bob.post(`/api/jobs/${job.id}/apply`)).body;
  const appOther = (await alice.post(`/api/jobs/${otherJob.id}/apply`)).body;
  return { ...ctx, company, other, job, otherJob, alice, bob, appA, appB, appOther };
}

test('GET /company/jobs/:id/applications traz currículo completo, mais antigas primeiro', async () => {
  const s = await scenario();
  const res = await s.company.get(`/api/company/jobs/${s.job.id}/applications`);
  assert.equal(res.status, 200);
  assert.equal(res.body.job.id, s.job.id);
  assert.deepEqual(res.body.applications.map((a) => a.id), [s.appA.id, s.appB.id]);
  const first = res.body.applications[0];
  assert.equal(first.status, 'em_analise');
  assert.equal(typeof first.createdAt, 'string');
  assert.equal(first.candidate.fullName, 'Alice');
  assert.equal(first.candidate.complete, true);
  assert.deepEqual(first.candidate.experiences, COMPLETE_PROFILE.experiences);

  const list = await s.company.get('/api/company/jobs');
  assert.equal(list.body.find((j) => j.id === s.job.id).applicationsCount, 2);
});

test('applications: 404 inexistente, 403 de outra empresa', async () => {
  const s = await scenario();
  assert.equal((await s.company.get('/api/company/jobs/9999/applications')).status, 404);
  assert.equal((await s.company.get('/api/company/jobs/abc/applications')).status, 404);
  const forbidden = await s.other.get(`/api/company/jobs/${s.job.id}/applications`);
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.body.error, 'Esta vaga pertence a outra empresa');
});

test('fechar vaga atualiza tudo em transação', async () => {
  const s = await scenario();
  const res = await s.company.post(`/api/company/jobs/${s.job.id}/close`).send({ applicationId: s.appB.id });
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'closed');
  assert.equal(res.body.hiredApplicationId, s.appB.id);

  const statusOf = (id) => s.db.prepare('SELECT status FROM applications WHERE id = ?').get(id).status;
  assert.equal(statusOf(s.appB.id), 'aprovado');
  assert.equal(statusOf(s.appA.id), 'nao_selecionado');
  assert.equal(statusOf(s.appOther.id), 'em_analise');

  const bobApps = await s.bob.get('/api/candidate/applications');
  assert.equal(bobApps.body[0].status, 'aprovado');
  assert.equal(bobApps.body[0].job.status, 'closed');

  const closed = await s.company.get('/api/company/jobs?status=closed');
  assert.equal(closed.body[0].id, s.job.id);
  assert.equal(closed.body[0].hiredCandidateName, 'Bob');

  assert.equal((await s.alice.get('/api/jobs')).body.some((j) => j.id === s.job.id), false);
});

test('aceita applicationId como string numérica', async () => {
  const s = await scenario();
  const res = await s.company.post(`/api/company/jobs/${s.job.id}/close`).send({ applicationId: String(s.appA.id) });
  assert.equal(res.status, 200);
});

test('fechar vaga: erros', async () => {
  const s = await scenario();
  const url = `/api/company/jobs/${s.job.id}/close`;
  assert.equal((await s.company.post('/api/company/jobs/9999/close').send({ applicationId: s.appA.id })).status, 404);
  assert.equal((await s.company.post('/api/company/jobs/abc/close').send({ applicationId: s.appA.id })).status, 404);

  const forbidden = await s.other.post(url).send({ applicationId: s.appA.id });
  assert.equal(forbidden.status, 403);

  assert.equal((await s.company.post(url).send({})).status, 400);
  assert.equal((await s.company.post(url)).status, 400);
  assert.equal((await s.company.post(url).send({ applicationId: 'abc' })).status, 400);
  assert.equal((await s.company.post(url).send({ applicationId: 1.5 })).status, 400);
  assert.equal((await s.company.post(url).send({ applicationId: 99999 })).status, 400);
  const wrongJob = await s.company.post(url).send({ applicationId: s.appOther.id });
  assert.equal(wrongJob.status, 400);

  // nada mudou após as tentativas
  assert.equal(s.db.prepare('SELECT status FROM jobs WHERE id = ?').get(s.job.id).status, 'open');

  assert.equal((await s.company.post(url).send({ applicationId: s.appA.id })).status, 200);
  const again = await s.company.post(url).send({ applicationId: s.appB.id });
  assert.equal(again.status, 400);
  assert.equal(s.db.prepare('SELECT status FROM applications WHERE id = ?').get(s.appA.id).status, 'aprovado');
});
