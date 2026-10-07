import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreMatch, matchJobs, rankApplications } from '../server/match.js';
import { setup, register, candidateWithProfile, createJob } from './helpers.js';

test('scoreMatch: percentual, tecnologias atendidas e faltantes', () => {
  assert.deepEqual(scoreMatch(['node', 'react'], ['node', 'sql', 'docker']), {
    matchScore: 33, matchedTechnologies: ['node'], missingTechnologies: ['sql', 'docker'],
  });
  assert.equal(scoreMatch(['node', 'sql'], ['node', 'sql']).matchScore, 100);
  assert.equal(scoreMatch([], ['node']).matchScore, 0);
});

test('scoreMatch: vaga sem tecnologias → 0, sem NaN/Infinity', () => {
  const r = scoreMatch(['node'], []);
  assert.deepEqual(r, { matchScore: 0, matchedTechnologies: [], missingTechnologies: [] });
  assert.equal(scoreMatch([], []).matchScore, 0);
});

const job = (id, technologies) => ({ id, title: `Vaga ${id}`, technologies });

test('matchJobs: só vagas com ao menos uma tecnologia em comum, ordenadas', () => {
  const jobs = [
    job(1, ['node', 'sql']), // 50%, 1 match
    job(2, ['python']), // nenhuma em comum
    job(3, ['node']), // 100%, 1 match
    job(4, ['node', 'react']), // 100%, 2 matches
    job(5, ['node', 'go']), // 50%, 1 match, mais nova que 1
    job(6, []),
  ];
  const result = matchJobs(['node', 'react'], jobs);
  assert.deepEqual(result.map((j) => j.id), [4, 3, 5, 1]);
  assert.deepEqual(result[0].matchedTechnologies, ['node', 'react']);
  assert.deepEqual(result[3].missingTechnologies, ['sql']);
});

test('matchJobs: minScore e candidato sem tecnologias', () => {
  const jobs = [job(1, ['node', 'sql', 'go']), job(2, ['node'])];
  assert.deepEqual(matchJobs(['node'], jobs, { minScore: 50 }).map((j) => j.id), [2]);
  assert.deepEqual(matchJobs([], jobs), []);
  assert.deepEqual(matchJobs(['node', 'node'], [job(1, ['node'])]).length, 1);
});

test('rankApplications: score desc, depois mais antiga primeiro', () => {
  const apps = [
    { id: 1, createdAt: '2026-01-02 10:00:00', candidate: { technologies: ['node'] } },
    { id: 2, createdAt: '2026-01-01 10:00:00', candidate: { technologies: ['node'] } },
    { id: 3, createdAt: '2026-01-03 10:00:00', candidate: { technologies: ['node', 'sql'] } },
    { id: 4, createdAt: '2026-01-01 10:00:00', candidate: { technologies: [] } },
  ];
  const ranked = rankApplications(apps, { technologies: ['node', 'sql'] });
  assert.deepEqual(ranked.map((a) => a.id), [3, 2, 1, 4]);
  assert.equal(ranked[0].matchScore, 100);
  assert.deepEqual(ranked[1].missingTechnologies, ['sql']);
});

test('GET /api/jobs/matches: só vagas abertas, com campos de match', async () => {
  const { app } = setup();
  const company = await register(app, 'company');
  const full = await createJob(company, { technologies: ['javascript', 'node'] });
  const half = await createJob(company, { technologies: ['node', 'sql'] });
  await createJob(company, { technologies: ['python'] });
  const closed = await createJob(company, { technologies: ['node'] });
  await company.post(`/api/company/jobs/${closed.id}/cancel`).expect(200);

  const maria = await candidateWithProfile(app); // javascript, node
  await maria.post(`/api/jobs/${half.id}/apply`).expect(201);

  const res = await maria.get('/api/jobs/matches');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.map((j) => j.id), [full.id, half.id]);
  assert.equal(res.body[0].matchScore, 100);
  assert.equal(res.body[0].alreadyApplied, false);
  assert.equal(res.body[1].matchScore, 50);
  assert.deepEqual(res.body[1].matchedTechnologies, ['node']);
  assert.deepEqual(res.body[1].missingTechnologies, ['sql']);
  assert.equal(res.body[1].alreadyApplied, true);
});

test('GET /api/jobs/matches: candidato sem tecnologias → [], empresa → 403', async () => {
  const { app } = setup();
  const company = await register(app, 'company');
  await createJob(company);
  const empty = await register(app, 'candidate');
  const res = await empty.get('/api/jobs/matches');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, []);
  assert.equal((await company.get('/api/jobs/matches')).status, 403);
});

test('applications da empresa ordenadas por matchScore', async () => {
  const { app } = setup();
  const company = await register(app, 'company');
  const job = await createJob(company, { technologies: ['node', 'sql'] });
  const low = await candidateWithProfile(app, { technologies: ['react'] });
  const mid = await candidateWithProfile(app, { technologies: ['node'] });
  const top = await candidateWithProfile(app, { technologies: ['node', 'sql'] });
  for (const c of [low, mid, top]) await c.post(`/api/jobs/${job.id}/apply`).expect(201);

  const res = await company.get(`/api/company/jobs/${job.id}/applications`);
  assert.equal(res.status, 200);
  const apps = res.body.applications;
  assert.deepEqual(apps.map((a) => a.candidate.email), [top, mid, low].map((c) => c.user.email));
  assert.deepEqual(apps.map((a) => a.matchScore), [100, 50, 0]);
  assert.deepEqual(apps[1].matchedTechnologies, ['node']);
  assert.deepEqual(apps[1].missingTechnologies, ['sql']);
});
