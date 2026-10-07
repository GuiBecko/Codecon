import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setup } from './helpers.js';

test('serve pdf.js e jsPDF como JavaScript em /vendor', async () => {
  const { app, cleanup } = setup();
  try {
    const pdf = await request(app).get('/vendor/pdfjs/pdf.min.mjs');
    assert.equal(pdf.status, 200);
    assert.match(pdf.headers['content-type'], /^text\/javascript/);
    const worker = await request(app).get('/vendor/pdfjs/pdf.worker.min.mjs');
    assert.equal(worker.status, 200);
    assert.match(worker.headers['content-type'], /^text\/javascript/);
    const jspdf = await request(app).get('/vendor/jspdf/jspdf.umd.min.js');
    assert.equal(jspdf.status, 200);
    assert.match(jspdf.headers['content-type'], /javascript/);
  } finally {
    cleanup();
  }
});
