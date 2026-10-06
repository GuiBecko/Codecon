import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, register, candidateWithProfile, createJob } from './helpers.js';

test('candidatura com sucesso e alreadyApplied', async () => {
  const { app } = setup();
  const company = await register(app, 'company', { name: 'ACME' });
  const job = await createJob(company);
  const candidate = await candidateWithProfile(app);
  const res = await candidate.post(`/api/jobs/${job.id}/apply`);
  assert.equal(res.status, 201);
  assert.equal(typeof res.body.id, 'number');
  assert.equal(res.body.jobId, job.id);
  assert.equal(res.body.status, 'em_analise');

  const list = await candidate.get('/api/jobs');
  assert.equal(list.body.find((j) => j.id === job.id).alreadyApplied, true);
  const detail = await candidate.get(`/api/jobs/${job.id}`);
  assert.equal(detail.body.alreadyApplied, true);
});

test('candidatura duplicada → 409', async () => {
  const { app } = setup();
  const company = await register(app, 'company');
  const job = await createJob(company);
  const candidate = await candidateWithProfile(app);
  assert.equal((await candidate.post(`/api/jobs/${job.id}/apply`)).status, 201);
  const dup = await candidate.post(`/api/jobs/${job.id}/apply`);
  assert.equal(dup.status, 409);
  assert.equal(typeof dup.body.error, 'string');
});

test('perfil incompleto → 422', async () => {
  const { app } = setup();
  const company = await register(app, 'company');
  const job = await createJob(company);
  const candidate = await register(app, 'candidate');
  const res = await candidate.post(`/api/jobs/${job.id}/apply`);
  assert.equal(res.status, 422);
  assert.equal(res.body.error, 'Complete seu currículo (nome, senioridade e ao menos uma tecnologia) antes de se candidatar');
  const noTech = await candidateWithProfile(app, { technologies: [] });
  assert.equal((await noTech.post(`/api/jobs/${job.id}/apply`)).status, 422);
});

test('vaga fechada → 400; inexistente → 404', async () => {
  const { app, db } = setup();
  const company = await register(app, 'company');
  const job = await createJob(company);
  db.prepare("UPDATE jobs SET status = 'closed' WHERE id = ?").run(job.id);
  const candidate = await candidateWithProfile(app);
  const closed = await candidate.post(`/api/jobs/${job.id}/apply`);
  assert.equal(closed.status, 400);
  assert.equal(closed.body.error, 'Esta vaga não está mais aceitando candidaturas');
  assert.equal((await candidate.post('/api/jobs/9999/apply')).status, 404);
  assert.equal((await candidate.post('/api/jobs/abc/apply')).status, 404);
});

test('ordem das checagens: vaga fechada vem antes de perfil incompleto', async () => {
  const { app, db } = setup();
  const company = await register(app, 'company');
  const job = await createJob(company);
  db.prepare("UPDATE jobs SET status = 'closed' WHERE id = ?").run(job.id);
  const candidate = await register(app, 'candidate');
  assert.equal((await candidate.post(`/api/jobs/${job.id}/apply`)).status, 400);
});

test('vagas fechadas somem do painel do candidato', async () => {
  const { app, db } = setup();
  const company = await register(app, 'company');
  const job = await createJob(company);
  const candidate = await candidateWithProfile(app);
  assert.equal((await candidate.get('/api/jobs')).body.length, 1);
  db.prepare("UPDATE jobs SET status = 'closed' WHERE id = ?").run(job.id);
  assert.equal((await candidate.get('/api/jobs')).body.length, 0);
});

test('GET /api/candidate/applications lista as candidaturas mais recentes primeiro', async () => {
  const { app } = setup();
  const company = await register(app, 'company', { name: 'ACME' });
  const j1 = await createJob(company, { title: 'Vaga 1' });
  const j2 = await createJob(company, { title: 'Vaga 2' });
  const candidate = await candidateWithProfile(app);
  const other = await candidateWithProfile(app);
  const a1 = (await candidate.post(`/api/jobs/${j1.id}/apply`)).body;
  const a2 = (await candidate.post(`/api/jobs/${j2.id}/apply`)).body;
  await other.post(`/api/jobs/${j1.id}/apply`);

  const res = await candidate.get('/api/candidate/applications');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.map((a) => a.id), [a2.id, a1.id]);
  assert.equal(res.body[0].status, 'em_analise');
  assert.equal(typeof res.body[0].createdAt, 'string');
  assert.deepEqual(res.body[0].job, { id: j2.id, title: 'Vaga 2', companyName: 'ACME', status: 'open' });
});
