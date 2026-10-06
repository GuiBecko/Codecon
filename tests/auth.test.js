import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setup, register } from './helpers.js';

test('register candidato loga e /me retorna usuário', async () => {
  const { app } = setup();
  const agent = await register(app, 'candidate', { name: 'Ana', email: 'ana@x.com' });
  assert.deepEqual(Object.keys(agent.user).sort(), ['email', 'id', 'name', 'role']);
  assert.equal(agent.user.role, 'candidate');
  assert.equal(agent.user.name, 'Ana');
  const me = await agent.get('/api/auth/me');
  assert.equal(me.status, 200);
  assert.deepEqual(me.body, agent.user);
});

test('register empresa cria nome da empresa', async () => {
  const { app, db } = setup();
  const agent = await register(app, 'company', { name: 'ACME' });
  assert.equal(agent.user.name, 'ACME');
  assert.equal(db.prepare('SELECT name FROM companies WHERE user_id = ?').get(agent.user.id).name, 'ACME');
  assert.equal(db.prepare('SELECT password_hash FROM users WHERE id = ?').get(agent.user.id).password_hash.startsWith('$2'), true);
});

test('register valida campos', async () => {
  const { app } = setup();
  const base = { email: 'a@b.com', password: '123456', role: 'candidate', name: 'A' };
  for (const bad of [
    { email: 'invalido' },
    { password: '12345' },
    { password: 'x'.repeat(73) },
    { role: 'admin' },
    { name: '' },
    { name: 'x'.repeat(121) },
  ]) {
    const res = await request(app).post('/api/auth/register').send({ ...base, ...bad });
    assert.equal(res.status, 400, JSON.stringify(bad));
    assert.equal(typeof res.body.error, 'string');
  }
});

test('register sem corpo → 400', async () => {
  const { app } = setup();
  const res = await request(app).post('/api/auth/register');
  assert.equal(res.status, 400);
});

test('JSON malformado → 400', async () => {
  const { app } = setup();
  const res = await request(app).post('/api/auth/register')
    .set('Content-Type', 'application/json').send('{"email": ');
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'JSON inválido');
});

test('e-mail com maiúsculas/espaços é normalizado; duplicado → 409', async () => {
  const { app } = setup();
  await register(app, 'candidate', { email: '  Fulano@Exemplo.COM ', password: 'abcdef' });
  const login = await request(app).post('/api/auth/login').send({ email: 'fulano@exemplo.com', password: 'abcdef' });
  assert.equal(login.status, 200);
  assert.equal(login.body.email, 'fulano@exemplo.com');
  const dup = await request(app).post('/api/auth/register')
    .send({ email: 'FULANO@exemplo.com', password: 'abcdef', role: 'company', name: 'X' });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error, 'Este e-mail já está cadastrado');
});

test('login com e-mail em caixa diferente funciona', async () => {
  const { app } = setup();
  await register(app, 'company', { email: 'rh@acme.com', password: 'abcdef' });
  const res = await request(app).post('/api/auth/login').send({ email: ' RH@ACME.com', password: 'abcdef' });
  assert.equal(res.status, 200);
});

test('login inválido → 401', async () => {
  const { app } = setup();
  await register(app, 'company', { email: 'rh@acme.com', password: 'abcdef' });
  const wrong = await request(app).post('/api/auth/login').send({ email: 'rh@acme.com', password: 'errada' });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.body.error, 'E-mail ou senha incorretos');
  const unknown = await request(app).post('/api/auth/login').send({ email: 'nao@existe.com', password: 'abcdef' });
  assert.equal(unknown.status, 401);
  const empty = await request(app).post('/api/auth/login');
  assert.ok([400, 401].includes(empty.status));
});

test('login + logout', async () => {
  const { app } = setup();
  await register(app, 'candidate', { email: 'c@c.com', password: 'abcdef' });
  const agent = request.agent(app);
  const login = await agent.post('/api/auth/login').send({ email: 'c@c.com', password: 'abcdef' });
  assert.equal(login.status, 200);
  assert.equal(login.body.role, 'candidate');
  assert.equal((await agent.get('/api/auth/me')).status, 200);
  const out = await agent.post('/api/auth/logout');
  assert.equal(out.status, 204);
  const me = await agent.get('/api/auth/me');
  assert.equal(me.status, 401);
  assert.equal(me.body.error, 'Faça login para continuar');
});

test('/api/rota-inexistente → 404 JSON', async () => {
  const { app } = setup();
  const res = await request(app).get('/api/nada');
  assert.equal(res.status, 404);
  assert.equal(res.body.error, 'Rota não encontrada');
});
