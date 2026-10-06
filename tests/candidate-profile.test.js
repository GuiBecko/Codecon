import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setup, register, COMPLETE_PROFILE } from './helpers.js';

test('perfil inicial vem incompleto com nome do cadastro', async () => {
  const { app } = setup();
  const agent = await register(app, 'candidate', { name: 'Ana' });
  const res = await agent.get('/api/candidate/profile');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {
    fullName: 'Ana', phone: '', city: '', linkedin: '', seniority: null,
    technologies: [], summary: '', experiences: [], education: [], complete: false,
  });
});

test('PUT salva, normaliza tecnologias e marca completo', async () => {
  const { app } = setup();
  const agent = await register(app, 'candidate');
  const res = await agent.put('/api/candidate/profile').send({
    ...COMPLETE_PROFILE,
    technologies: ['  React ', 'node, React', 'Type  Script'],
    experiences: [...COMPLETE_PROFILE.experiences, { empresa: '', cargo: ' ', inicio: '', fim: '', descricao: '' }],
  });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.technologies, ['react', 'node', 'type script']);
  assert.equal(res.body.complete, true);
  assert.equal(res.body.experiences.length, 1);
  assert.deepEqual(res.body.education, COMPLETE_PROFILE.education);
  const again = await agent.get('/api/candidate/profile');
  assert.deepEqual(again.body, res.body);
});

test('/auth/me reflete o nome atualizado no perfil', async () => {
  const { app } = setup();
  const agent = await register(app, 'candidate', { name: 'Antigo' });
  await agent.put('/api/candidate/profile').send({ ...COMPLETE_PROFILE, fullName: 'Nome Novo' });
  const me = await agent.get('/api/auth/me');
  assert.equal(me.body.name, 'Nome Novo');
});

test('perfil sem senioridade ou tecnologias é incompleto', async () => {
  const { app } = setup();
  const agent = await register(app, 'candidate');
  let res = await agent.put('/api/candidate/profile').send({ ...COMPLETE_PROFILE, seniority: '' });
  assert.equal(res.status, 200);
  assert.equal(res.body.seniority, null);
  assert.equal(res.body.complete, false);
  res = await agent.put('/api/candidate/profile').send({ ...COMPLETE_PROFILE, technologies: [] });
  assert.equal(res.body.complete, false);
});

test('PUT valida tipos e enums', async () => {
  const { app } = setup();
  const agent = await register(app, 'candidate');
  for (const bad of [
    { fullName: '' },
    { fullName: 42 },
    { seniority: 'mestre' },
    { technologies: 5 },
    { technologies: [1, 2] },
    { experiences: 'texto' },
    { experiences: ['x'] },
    { experiences: [{ empresa: 1 }] },
    { experiences: Array.from({ length: 21 }, () => ({ empresa: 'a' })) },
    { education: {} },
    { education: [{ curso: 'x'.repeat(121) }] },
    { summary: 'x'.repeat(2001) },
    { phone: 'x'.repeat(31) },
  ]) {
    const res = await agent.put('/api/candidate/profile').send({ ...COMPLETE_PROFILE, ...bad });
    assert.equal(res.status, 400, JSON.stringify(bad));
  }
  const noBody = await agent.put('/api/candidate/profile');
  assert.equal(noBody.status, 400);
});

test('guardas de role em /api/candidate', async () => {
  const { app } = setup();
  assert.equal((await request(app).get('/api/candidate/profile')).status, 401);
  const company = await register(app, 'company');
  const res = await company.get('/api/candidate/profile');
  assert.equal(res.status, 403);
  assert.equal(res.body.error, 'Acesso não permitido para este perfil');
  assert.equal((await company.put('/api/candidate/profile').send(COMPLETE_PROFILE)).status, 403);
  assert.equal((await company.get('/api/candidate/applications')).status, 403);
});
