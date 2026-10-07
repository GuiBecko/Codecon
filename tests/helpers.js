import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createDb } from '../server/db.js';
import { createApp } from '../server/app.js';

const tempDirs = new Set();
process.on('exit', () => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

export function setup() {
  const db = createDb(':memory:');
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'conecta-vagas-uploads-'));
  tempDirs.add(uploadsDir);
  const app = createApp({ db, sessionSecret: 'test', uploadsDir });
  const cleanup = () => {
    fs.rmSync(uploadsDir, { recursive: true, force: true });
    tempDirs.delete(uploadsDir);
  };
  return { db, app, uploadsDir, cleanup };
}

let counter = 0;

export async function register(app, role, overrides = {}) {
  counter += 1;
  const agent = request.agent(app);
  const body = {
    email: `${role}${counter}@teste.com`,
    password: 'segredo123',
    role,
    name: role === 'company' ? `Empresa ${counter}` : `Pessoa ${counter}`,
    ...overrides,
  };
  const res = await agent.post('/api/auth/register').send(body);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  agent.user = res.body;
  agent.password = body.password;
  return agent;
}

export const COMPLETE_PROFILE = {
  fullName: 'Maria Teste',
  phone: '(11) 99999-0000',
  city: 'São Paulo',
  linkedin: 'https://linkedin.com/in/maria',
  seniority: 'pleno',
  technologies: ['JavaScript', 'Node'],
  summary: 'Dev full stack',
  experiences: [{ empresa: 'ACME', cargo: 'Dev', inicio: '2020-01', fim: '2023-06', descricao: 'APIs' }],
  education: [{ instituicao: 'USP', curso: 'Computação', conclusao: '2019-12' }],
};

export async function candidateWithProfile(app, profile = {}) {
  const agent = await register(app, 'candidate');
  const res = await agent.put('/api/candidate/profile').send({ ...COMPLETE_PROFILE, ...profile });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return agent;
}

export const JOB = {
  title: 'Desenvolvedor Backend',
  description: 'Vaga para APIs',
  seniority: 'pleno',
  salaryMin: 5000,
  salaryMax: 8000,
  technologies: ['node', 'sql'],
  location: 'São Paulo',
  workModel: 'remoto',
};

export async function createJob(companyAgent, overrides = {}) {
  const res = await companyAgent.post('/api/company/jobs').send({ ...JOB, ...overrides });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
}
