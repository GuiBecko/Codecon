import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterJobs, parseJobFilters } from '../server/job-model.js';
import { HttpError } from '../server/validation.js';

const jobs = [
  { id: 1, title: 'Engenheira de Segurança', seniority: 'senior', salaryMax: 15000, companyId: 1, technologies: ['python', 'aws'] },
  { id: 2, title: 'Dev Frontend', seniority: 'pleno', salaryMax: 9000, companyId: 2, technologies: ['javascript', 'react'] },
  { id: 3, title: 'Dev Java', seniority: 'junior', salaryMax: 5000, companyId: 1, technologies: ['java', 'spring'] },
];
const none = { q: '', seniority: null, salaryMin: null, tech: [], company: null };
const ids = (f) => filterJobs(jobs, { ...none, ...f }).map((j) => j.id);

test('filterJobs: sem filtros retorna tudo', () => {
  assert.deepEqual(ids({}), [1, 2, 3]);
});

test('filterJobs: q ignora acentos e caixa', () => {
  assert.deepEqual(ids({ q: 'seguranca' }), [1]);
  assert.deepEqual(ids({ q: 'SEGURANÇA' }), [1]);
  assert.deepEqual(ids({ q: 'dev' }), [2, 3]);
});

test('filterJobs: tech exige match exato e todas as tags', () => {
  assert.deepEqual(ids({ tech: ['java'] }), [3]);
  assert.deepEqual(ids({ tech: ['javascript', 'react'] }), [2]);
  assert.deepEqual(ids({ tech: ['javascript', 'spring'] }), []);
});

test('filterJobs: seniority, salaryMin, company', () => {
  assert.deepEqual(ids({ seniority: 'pleno' }), [2]);
  assert.deepEqual(ids({ salaryMin: 9000 }), [1, 2]);
  assert.deepEqual(ids({ company: 1 }), [1, 3]);
  assert.deepEqual(ids({ company: 1, salaryMin: 6000 }), [1]);
});

test('parseJobFilters', () => {
  assert.deepEqual(parseJobFilters({}), none);
  assert.deepEqual(parseJobFilters({ q: ' dev ', seniority: '', salaryMin: '', tech: 'React, node', company: '' }),
    { ...none, q: 'dev', tech: ['react', 'node'] });
  assert.deepEqual(parseJobFilters({ seniority: 'pleno', salaryMin: '3000', company: '2', tech: ['a', 'b,c'] }),
    { q: '', seniority: 'pleno', salaryMin: 3000, tech: ['a', 'b', 'c'], company: 2 });
  for (const bad of [{ seniority: 'x' }, { salaryMin: 'abc' }, { salaryMin: '-5' }, { company: 'abc' }, { company: '0' }]) {
    assert.throws(() => parseJobFilters(bad), (e) => e instanceof HttpError && e.status === 400, JSON.stringify(bad));
  }
  // parâmetros repetidos viram arrays e não podem estourar
  assert.throws(() => parseJobFilters({ q: ['a', 'b'] }), HttpError);
  assert.throws(() => parseJobFilters({ seniority: ['pleno', 'senior'] }), HttpError);
  assert.throws(() => parseJobFilters({ salaryMin: ['1', '2'] }), HttpError);
});
