import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import session from 'express-session';
import multer from 'multer';
import { HttpError } from './validation.js';
import { authRouter } from './routes/auth.js';
import { candidateRouter } from './routes/candidate.js';
import { jobsRouter } from './routes/jobs.js';
import { companyRouter } from './routes/company.js';
import { metaRouter } from './routes/meta.js';
import { devRouter } from './routes/dev.js';
import { createMailer } from './mailer.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const VENDOR = {
  '/vendor/pdfjs': path.join(ROOT_DIR, 'node_modules', 'pdfjs-dist', 'build'),
  '/vendor/jspdf': path.join(ROOT_DIR, 'node_modules', 'jspdf', 'dist'),
};

function setJsContentType(res, filePath) {
  if (/\.m?js$/.test(filePath)) res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
}
const DEV_SECRET = 'conecta-vagas-dev-secret';
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

export function createApp({
  db,
  sessionSecret = process.env.SESSION_SECRET,
  uploadsDir = process.env.UPLOADS_DIR || 'data/uploads',
  mailer,
  mailTransport,
} = {}) {
  const isProd = process.env.NODE_ENV === 'production';
  if (!sessionSecret) {
    if (isProd) throw new Error('SESSION_SECRET é obrigatório em produção');
    sessionSecret = DEV_SECRET;
  }

  uploadsDir = path.resolve(uploadsDir);
  fs.mkdirSync(uploadsDir, { recursive: true });

  mailer = mailer ?? createMailer({ db, transport: mailTransport });

  const app = express();
  app.locals.mailer = mailer;
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '100kb' }));
  app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: isProd, maxAge: SEVEN_DAYS },
  }));

  app.use('/api/auth', authRouter(db));
  app.use('/api/candidate', candidateRouter(db, uploadsDir));
  app.use('/api/jobs', jobsRouter(db));
  app.use('/api/company', companyRouter(db, uploadsDir, mailer));
  app.use('/api/meta', metaRouter(db));
  if (!isProd) app.use('/api/dev', devRouter(db));
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
  });

  for (const [route, dir] of Object.entries(VENDOR)) {
    app.use(route, express.static(dir, { setHeaders: setJsContentType, maxAge: '1d' }));
  }
  app.use(express.static(PUBLIC_DIR));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'O PDF deve ter no máximo 5 MB' });
      return res.status(400).json({ error: 'Envie um arquivo PDF válido' });
    }
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Requisição muito grande' });
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  });

  return app;
}
