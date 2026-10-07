import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('company', 'candidate')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS companies (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS candidates (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'Brasil',
  linkedin TEXT NOT NULL DEFAULT '',
  seniority TEXT CHECK (seniority IS NULL OR seniority IN ('estagio', 'junior', 'pleno', 'senior', 'especialista')),
  technologies TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  experiences TEXT NOT NULL DEFAULT '[]',
  education TEXT NOT NULL DEFAULT '[]',
  resume_pdf_path TEXT,
  resume_pdf_name TEXT,
  resume_pdf_size INTEGER,
  resume_pdf_uploaded_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  seniority TEXT NOT NULL CHECK (seniority IN ('estagio', 'junior', 'pleno', 'senior', 'especialista')),
  salary_min INTEGER NOT NULL CHECK (salary_min >= 0),
  salary_max INTEGER NOT NULL CHECK (salary_max >= salary_min),
  technologies TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  work_model TEXT NOT NULL CHECK (work_model IN ('remoto', 'hibrido', 'presencial')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  hired_application_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id INTEGER NOT NULL REFERENCES candidates(user_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'em_analise' CHECK (status IN ('em_analise', 'aprovado', 'nao_selecionado')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (job_id, candidate_id)
);

CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_applications_candidate ON applications(candidate_id);
`;

// Colunas adicionadas depois da primeira versão: bancos antigos ganham via ALTER TABLE.
const CANDIDATE_MIGRATIONS = {
  state: "TEXT NOT NULL DEFAULT ''",
  country: "TEXT NOT NULL DEFAULT 'Brasil'",
  resume_pdf_path: 'TEXT',
  resume_pdf_name: 'TEXT',
  resume_pdf_size: 'INTEGER',
  resume_pdf_uploaded_at: 'TEXT',
};

function migrate(db) {
  const existing = new Set(db.prepare('PRAGMA table_info(candidates)').all().map((c) => c.name));
  db.transaction(() => {
    for (const [column, type] of Object.entries(CANDIDATE_MIGRATIONS)) {
      if (!existing.has(column)) db.exec(`ALTER TABLE candidates ADD COLUMN ${column} ${type}`);
    }
  })();
}

export function createDb(dbPath = process.env.DB_PATH || 'data/app.db') {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  migrate(db);
  return db;
}
