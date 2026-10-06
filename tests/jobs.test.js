import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setup, register, createJob } from './helpers.js';

async function scenario() {
  const ctx = setup();
  const acme = await register(ctx.app, 'company', { name: 'ACME' });
  const beta = await register(ctx.app, 'company', { name: 'Beta' });
  const sec = await createJob(acme, {
    title: 'Engenheira de Segurança', seniority: 'senior', salaryMin: 12000, salaryMax: 15000, technologies: ['python', 'aws'],
  });
  const front = await createJob(beta, {
    title: 'Dev Frontend', seniority: 'pleno', salaryMin: 6000, salaryMax: 9000, technologies: ['javascript', 'react'],
  });
  const java = await createJob(acme, {
    title: 'Dev Java', seniority: 'junior', salaryMin: 3000, salaryMax: 5000, technologies: ['java', 'spring'],
  });
  const closed = await createJob(beta, { title: 'Vaga Fechada', technologies: ['python'] });
  ctx.db.prepare("UPDATE jobs SET status = 'closed' WHERE id = ?").run(closed.id);
  const candidate = await register(ctx.app, 'candidate');
  return { ...ctx, acme, beta, candidate, sec, front, java, closed };
}

const ids = (res) => res.body.map((j) => j.id);

test('GET /api/jobs lista só abertas, mais recentes primeiro', async () => {
  const s = await scenario();
  const res = await s.candidate.get('/api/jobs');
  assert.equal(res.status, 200);
  assert.deepEqual(ids(res), [s.java.id, s.front.id, s.sec.id]);
  assert.equal(res.body[0].companyName, 'ACME');
  assert.equal(res.body[0].alreadyApplied, false);
});

test('filtros isolados', async () => {
  const s = await scenario();
  const get = (qs) => s.candidate.get(`/api/jobs?${qs}`);
  assert.deepEqual(ids(await get('q=dev')), [s.java.id, s.front.id]);
  assert.deepEqual(ids(await get('q=seguranca')), [s.sec.id]);
  assert.deepEqual(ids(await get(`q=${encodeURIComponent('SEGURANÇA')}`)), [s.sec.id]);
  assert.deepEqual(ids(await get('seniority=pleno')), [s.front.id]);
  assert.deepEqual(ids(await get('salaryMin=9000')), [s.front.id, s.sec.id]);
  assert.deepEqual(ids(await get('tech=java')), [s.java.id]);
  assert.deepEqual(ids(await get('tech=python')), [s.sec.id]);
  assert.deepEqual(ids(await get(`company=${s.acme.user.id}`)), [s.java.id, s.sec.id]);
});

test('tecnologias combinadas com AND', async () => {
  const s = await scenario();
  assert.deepEqual(ids(await s.candidate.get('/api/jobs?tech=javascript,react')), [s.front.id]);
  assert.deepEqual(ids(await s.candidate.get('/api/jobs?tech=javascript&tech=react')), [s.front.id]);
  assert.deepEqual(ids(await s.candidate.get('/api/jobs?tech=javascript,python')), []);
});

test('combinação de filtros', async () => {
  const s = await scenario();
  const res = await s.candidate.get(`/api/jobs?company=${s.acme.user.id}&salaryMin=6000&tech=aws&q=eng`);
  assert.deepEqual(ids(res), [s.sec.id]);
});

test('parâmetros inválidos → 400, nunca 500', async () => {
  const s = await scenario();
  for (const qs of ['salaryMin=abc', 'company=abc', 'seniority=mestre', 'salaryMin=-1', 'q=a&q=b', 'seniority=pleno&seniority=senior']) {
    const res = await s.candidate.get(`/api/jobs?${qs}`);
    assert.equal(res.status, 400, qs);
  }
  const empty = await s.candidate.get('/api/jobs?q=&seniority=&salaryMin=&company=&tech=');
  assert.equal(empty.status, 200);
  assert.equal(empty.body.length, 3);
});

test('GET /api/jobs/:id', async () => {
  const s = await scenario();
  const res = await s.candidate.get(`/api/jobs/${s.front.id}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.title, 'Dev Frontend');
  assert.equal(res.body.alreadyApplied, false);
  const closed = await s.candidate.get(`/api/jobs/${s.closed.id}`);
  assert.equal(closed.status, 200);
  assert.equal(closed.body.status, 'closed');
  const missing = await s.candidate.get('/api/jobs/9999');
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error, 'Vaga não encontrada');
  assert.equal((await s.candidate.get('/api/jobs/abc')).status, 404);
});

test('guardas de role em /api/jobs', async () => {
  const s = await scenario();
  assert.equal((await request(s.app).get('/api/jobs')).status, 401);
  assert.equal((await s.acme.get('/api/jobs')).status, 403);
  assert.equal((await s.acme.get(`/api/jobs/${s.sec.id}`)).status, 403);
  assert.equal((await s.acme.post(`/api/jobs/${s.sec.id}/apply`)).status, 403);
});

test('GET /api/meta/filters', async () => {
  const s = await scenario();
  const res = await s.candidate.get('/api/meta/filters');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.companies, [
    { id: s.acme.user.id, name: 'ACME' },
    { id: s.beta.user.id, name: 'Beta' },
  ]);
  assert.deepEqual(res.body.technologies, ['aws', 'java', 'javascript', 'python', 'react', 'spring']);
  const company = await s.acme.get('/api/meta/filters');
  assert.equal(company.status, 200);
  assert.equal((await request(s.app).get('/api/meta/filters')).status, 401);
});

test('meta/filters ignora empresas sem vagas abertas', async () => {
  const s = await scenario();
  await register(s.app, 'company', { name: 'Sem Vagas' });
  s.db.prepare("UPDATE jobs SET status = 'closed' WHERE id = ?").run(s.front.id);
  const res = await s.candidate.get('/api/meta/filters');
  assert.deepEqual(res.body.companies.map((c) => c.name), ['ACME']);
  assert.ok(!res.body.technologies.includes('react'));
});
