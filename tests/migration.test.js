import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { createDb } from '../server/db.js';

const NEW_COLUMNS = ['state', 'country', 'resume_pdf_path', 'resume_pdf_name', 'resume_pdf_size', 'resume_pdf_uploaded_at'];

test('createDb migra a tabela candidates antiga sem perder dados', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conecta-vagas-db-'));
  try {
    const file = path.join(dir, 'old.db');
    const old = new Database(file);
    old.exec(`
      CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL, role TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE candidates (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        full_name TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '',
        linkedin TEXT NOT NULL DEFAULT '', seniority TEXT, technologies TEXT NOT NULL DEFAULT '',
        summary TEXT NOT NULL DEFAULT '', experiences TEXT NOT NULL DEFAULT '[]',
        education TEXT NOT NULL DEFAULT '[]', updated_at TEXT NOT NULL DEFAULT (datetime('now')));
      INSERT INTO users (email, password_hash, role) VALUES ('a@a.com', 'x', 'candidate');
      INSERT INTO candidates (user_id, full_name) VALUES (1, 'Antiga');
    `);
    old.close();

    const db = createDb(file);
    const cols = db.prepare('PRAGMA table_info(candidates)').all().map((c) => c.name);
    for (const c of NEW_COLUMNS) assert.ok(cols.includes(c), c);
    const row = db.prepare('SELECT * FROM candidates WHERE user_id = 1').get();
    assert.equal(row.full_name, 'Antiga');
    assert.equal(row.state, '');
    assert.equal(row.country, 'Brasil');
    assert.equal(row.resume_pdf_path, null);
    db.close();

    // idempotente: rodar de novo não falha
    createDb(file).close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('banco novo já nasce com as colunas novas', () => {
  const db = createDb(':memory:');
  const cols = db.prepare('PRAGMA table_info(candidates)').all().map((c) => c.name);
  for (const c of NEW_COLUMNS) assert.ok(cols.includes(c), c);
});
