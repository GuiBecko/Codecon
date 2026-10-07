import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { setup, register, candidateWithProfile, createJob } from './helpers.js';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');

const binaryParser = (res, cb) => {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};

const upload = (agent, buf = PDF, filename = 'curriculo.pdf') =>
  agent.put('/api/candidate/resume-pdf').attach('file', buf, { filename, contentType: 'application/pdf' });

const listUploads = (dir) => fs.readdirSync(dir).filter((f) => f.endsWith('.pdf'));

test('upload, download e remoção do PDF do currículo', async () => {
  const { app, uploadsDir, cleanup } = setup();
  try {
    const agent = await candidateWithProfile(app);
    const res = await upload(agent, PDF, 'Meu "CV".pdf');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.fullName, 'Maria Teste');
    assert.equal(res.body.resumePdf.name, 'Meu CV.pdf');
    assert.equal(res.body.resumePdf.size, PDF.length);
    assert.equal(typeof res.body.resumePdf.uploadedAt, 'string');
    const files = listUploads(uploadsDir);
    assert.equal(files.length, 1);
    assert.match(files[0], /^[0-9a-f-]{36}\.pdf$/);

    const profile = await agent.get('/api/candidate/profile');
    assert.deepEqual(profile.body.resumePdf, res.body.resumePdf);

    const dl = await agent.get('/api/candidate/resume-pdf').buffer(true).parse(binaryParser);
    assert.equal(dl.status, 200);
    assert.match(dl.headers['content-type'], /^application\/pdf/);
    assert.match(dl.headers['content-disposition'], /^attachment; filename="Meu CV\.pdf"/);
    assert.ok(Buffer.compare(dl.body, PDF) === 0);

    // substituir apaga o arquivo anterior
    const second = await upload(agent, Buffer.concat([PDF, Buffer.from('x')]), 'novo');
    assert.equal(second.status, 200);
    assert.equal(second.body.resumePdf.name, 'novo.pdf');
    const after = listUploads(uploadsDir);
    assert.equal(after.length, 1);
    assert.notEqual(after[0], files[0]);

    const del = await agent.delete('/api/candidate/resume-pdf');
    assert.equal(del.status, 204);
    assert.equal(listUploads(uploadsDir).length, 0);
    assert.equal((await agent.get('/api/candidate/profile')).body.resumePdf, null);
    const missing = await agent.get('/api/candidate/resume-pdf');
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error, 'Nenhum PDF anexado');
  } finally {
    cleanup();
  }
});

test('upload rejeita não-PDF, ausência de arquivo e arquivo > 5 MB', async () => {
  const { app, uploadsDir, cleanup } = setup();
  try {
    const agent = await register(app, 'candidate');
    const notPdf = await upload(agent, Buffer.from('<html>oi</html>'), 'x.pdf');
    assert.equal(notPdf.status, 400);
    assert.equal(notPdf.body.error, 'Envie um arquivo PDF válido');

    const none = await agent.put('/api/candidate/resume-pdf').field('outro', 'x');
    assert.equal(none.status, 400);
    assert.equal(none.body.error, 'Envie um arquivo PDF válido');

    const big = Buffer.alloc(5 * 1024 * 1024 + 1, 0x20);
    PDF.copy(big);
    const tooBig = await upload(agent, big);
    assert.equal(tooBig.status, 413);
    assert.equal(tooBig.body.error, 'O PDF deve ter no máximo 5 MB');
    assert.equal(listUploads(uploadsDir).length, 0);
  } finally {
    cleanup();
  }
});

test('GET responde 404 se o arquivo sumiu do disco', async () => {
  const { app, uploadsDir, cleanup } = setup();
  try {
    const agent = await register(app, 'candidate');
    await upload(agent);
    for (const f of listUploads(uploadsDir)) fs.rmSync(path.join(uploadsDir, f));
    assert.equal((await agent.get('/api/candidate/resume-pdf')).status, 404);
  } finally {
    cleanup();
  }
});

test('empresa baixa o PDF do candidato apenas das próprias vagas', async () => {
  const { app, cleanup } = setup();
  try {
    const company = await register(app, 'company');
    const other = await register(app, 'company');
    const job = await createJob(company);
    const withPdf = await candidateWithProfile(app, { fullName: 'Com PDF' });
    const withoutPdf = await candidateWithProfile(app);
    await upload(withPdf, PDF, 'cv.pdf');
    const a1 = (await withPdf.post(`/api/jobs/${job.id}/apply`)).body;
    const a2 = (await withoutPdf.post(`/api/jobs/${job.id}/apply`)).body;

    const ok = await company.get(`/api/company/applications/${a1.id}/resume-pdf`).buffer(true).parse(binaryParser);
    assert.equal(ok.status, 200);
    assert.match(ok.headers['content-type'], /^application\/pdf/);
    assert.match(ok.headers['content-disposition'], /^attachment; filename="cv\.pdf"/);
    assert.ok(Buffer.compare(ok.body, PDF) === 0);

    const forbidden = await other.get(`/api/company/applications/${a1.id}/resume-pdf`);
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.error, 'Esta vaga pertence a outra empresa');

    const noPdf = await company.get(`/api/company/applications/${a2.id}/resume-pdf`);
    assert.equal(noPdf.status, 404);
    assert.equal(noPdf.body.error, 'Nenhum PDF anexado');
    assert.equal((await company.get('/api/company/applications/9999/resume-pdf')).status, 404);
    assert.equal((await company.get('/api/company/applications/abc/resume-pdf')).status, 404);

    assert.equal((await withPdf.get(`/api/company/applications/${a1.id}/resume-pdf`)).status, 403);
    assert.equal((await request(app).get(`/api/company/applications/${a1.id}/resume-pdf`)).status, 401);

    const list = await company.get(`/api/company/jobs/${job.id}/applications`);
    const cand = list.body.applications.find((a) => a.id === a1.id).candidate;
    assert.equal(cand.resumePdf.name, 'cv.pdf');
    assert.equal(cand.email, withPdf.user.email);
    assert.equal(list.body.applications.find((a) => a.id === a2.id).candidate.resumePdf, null);
  } finally {
    cleanup();
  }
});

test('rotas de PDF do candidato exigem perfil de candidato', async () => {
  const { app, cleanup } = setup();
  try {
    const company = await register(app, 'company');
    assert.equal((await upload(company)).status, 403);
    assert.equal((await company.get('/api/candidate/resume-pdf')).status, 403);
    assert.equal((await company.delete('/api/candidate/resume-pdf')).status, 403);
    assert.equal((await request(app).get('/api/candidate/resume-pdf')).status, 401);
  } finally {
    cleanup();
  }
});
