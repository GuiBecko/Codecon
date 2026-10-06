import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createDb } from '../server/db.js';
import { createApp } from '../server/app.js';
import { seed, DEMO_PASSWORD } from '../server/seed.js';

const count = (db, table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;

test('seed popula dados de demo e é idempotente', () => {
  const db = createDb(':memory:');
  seed(db);
  seed(db);
  assert.equal(count(db, 'users'), 5);
  assert.equal(count(db, 'companies'), 3);
  assert.equal(count(db, 'candidates'), 2);
  assert.equal(count(db, 'jobs'), 10);
  assert.equal(count(db, 'applications'), 3);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE status = 'open'").get().n, 10);
  const seniorities = db.prepare('SELECT DISTINCT seniority FROM jobs').all().map((r) => r.seniority).sort();
  assert.deepEqual(seniorities, ['especialista', 'estagio', 'junior', 'pleno', 'senior']);
  assert.equal(db.prepare('SELECT MIN(id) AS m FROM users').get().m, 1);
});

test('ana loga com a senha demo e tem currículo completo', async () => {
  const db = createDb(':memory:');
  seed(db);
  const app = createApp({ db, sessionSecret: 'test' });
  const agent = request.agent(app);
  const login = await agent.post('/api/auth/login').send({ email: 'ana@demo.com', password: DEMO_PASSWORD });
  assert.equal(login.status, 200);
  assert.equal(login.body.name, 'Ana Souza');
  const profile = await agent.get('/api/candidate/profile');
  assert.equal(profile.body.complete, true);
  assert.equal(profile.body.seniority, 'pleno');
  const apps = await agent.get('/api/candidate/applications');
  assert.equal(apps.body.length, 1);
  const jobs = await agent.get('/api/jobs?q=seguranca');
  assert.equal(jobs.body.length, 1);
  const rn = await agent.get(`/api/jobs?tech=${encodeURIComponent('react native')}`);
  assert.equal(rn.body.length, 1);

  const company = request.agent(app);
  assert.equal((await company.post('/api/auth/login').send({ email: 'rh@technova.com', password: DEMO_PASSWORD })).status, 200);
  const companyJobs = await company.get('/api/company/jobs');
  assert.ok(companyJobs.body.length > 0);
});
