import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setup, register, createJob, JOB } from './helpers.js';

test('empresa cria vaga', async () => {
  const { app } = setup();
  const company = await register(app, 'company', { name: 'ACME' });
  const job = await createJob(company, { technologies: 'Node, SQL, node' });
  assert.equal(job.companyId, company.user.id);
  assert.equal(job.companyName, 'ACME');
  assert.equal(job.title, JOB.title);
  assert.equal(job.status, 'open');
  assert.equal(job.hiredApplicationId, null);
  assert.deepEqual(job.technologies, ['node', 'sql']);
  assert.equal(job.workModel, 'remoto');
  assert.equal(job.salaryMin, 5000);
  assert.equal(typeof job.createdAt, 'string');
});

test('salários como string numérica são aceitos', async () => {
  const { app } = setup();
  const company = await register(app, 'company');
  const job = await createJob(company, { salaryMin: '5000', salaryMax: '7000' });
  assert.equal(job.salaryMin, 5000);
  assert.equal(job.salaryMax, 7000);
});

test('validação da vaga', async () => {
  const { app } = setup();
  const company = await register(app, 'company');
  for (const bad of [
    { title: '' },
    { title: 'x'.repeat(121) },
    { seniority: 'mestre' },
    { seniority: undefined },
    { workModel: 'lua' },
    { workModel: undefined },
    { technologies: [] },
    { technologies: undefined },
    { salaryMin: '50.5' },
    { salaryMin: -1 },
    { salaryMin: '' },
    { salaryMax: 'abc' },
    { salaryMin: 9000, salaryMax: 8000 },
    { description: 'x'.repeat(5001) },
  ]) {
    const res = await company.post('/api/company/jobs').send({ ...JOB, ...bad });
    assert.equal(res.status, 400, JSON.stringify(bad));
    assert.equal(typeof res.body.error, 'string');
  }
  const inverted = await company.post('/api/company/jobs').send({ ...JOB, salaryMin: 9000, salaryMax: 8000 });
  assert.equal(inverted.body.error, 'O salário mínimo não pode ser maior que o máximo');
  assert.equal((await company.post('/api/company/jobs')).status, 400);
});

test('lista vagas da empresa por status com contagem', async () => {
  const { app, db } = setup();
  const company = await register(app, 'company');
  const other = await register(app, 'company');
  const j1 = await createJob(company, { title: 'Primeira' });
  const j2 = await createJob(company, { title: 'Segunda' });
  await createJob(other, { title: 'Da outra' });
  db.prepare("UPDATE jobs SET status = 'closed' WHERE id = ?").run(j1.id);

  const open = await company.get('/api/company/jobs');
  assert.equal(open.status, 200);
  assert.deepEqual(open.body.map((j) => j.id), [j2.id]);
  assert.equal(open.body[0].applicationsCount, 0);
  assert.equal(open.body[0].hiredCandidateName, null);

  const closed = await company.get('/api/company/jobs?status=closed');
  assert.deepEqual(closed.body.map((j) => j.id), [j1.id]);

  assert.equal((await company.get('/api/company/jobs?status=xyz')).status, 400);
});

test('vagas da empresa vêm das mais novas para as mais antigas', async () => {
  const { app } = setup();
  const company = await register(app, 'company');
  const a = await createJob(company, { title: 'A' });
  const b = await createJob(company, { title: 'B' });
  const res = await company.get('/api/company/jobs');
  assert.deepEqual(res.body.map((j) => j.id), [b.id, a.id]);
});

test('guardas de role em /api/company', async () => {
  const { app } = setup();
  assert.equal((await request(app).get('/api/company/jobs')).status, 401);
  assert.equal((await request(app).post('/api/company/jobs').send(JOB)).status, 401);
  const candidate = await register(app, 'candidate');
  assert.equal((await candidate.get('/api/company/jobs')).status, 403);
  assert.equal((await candidate.post('/api/company/jobs').send(JOB)).status, 403);
  assert.equal((await candidate.get('/api/company/jobs/1/applications')).status, 403);
  assert.equal((await candidate.post('/api/company/jobs/1/close').send({ applicationId: 1 })).status, 403);
});
