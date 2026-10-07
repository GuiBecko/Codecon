import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createDb } from '../server/db.js';
import { createApp } from '../server/app.js';
import { seed, DEMO_PASSWORD } from '../server/seed.js';
import { profileFromRow, parseProfileInput } from '../server/profile-model.js';
import { fakeTransport } from './helpers.js';

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
  const app = createApp({ db, sessionSecret: 'test', mailTransport: fakeTransport() });
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

test('currículos do seed já estão no formato validado pelo servidor', () => {
  const db = createDb(':memory:');
  seed(db);
  const rows = db.prepare('SELECT * FROM candidates').all();
  assert.equal(rows.length, 2);
  for (const row of rows) {
    const profile = profileFromRow(row);
    const { complete, resumePdf, ...input } = profile;
    assert.equal(complete, true);
    assert.equal(resumePdf, null);
    assert.deepEqual(parseProfileInput(input), input, row.full_name);
  }
  const ana = profileFromRow(rows.find((r) => r.full_name === 'Ana Souza'));
  assert.equal(ana.state, 'SP');
  assert.deepEqual(ana.experiences[0].atual, true);
  assert.equal(ana.experiences[0].fim, '');
  const bruno = profileFromRow(rows.find((r) => r.full_name === 'Bruno Lima'));
  assert.equal(bruno.state, 'PE');
  assert.equal(bruno.education[0].situacao, 'em_andamento');
});
