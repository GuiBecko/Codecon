import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import session from 'express-session';
import { HttpError } from './validation.js';
import { authRouter } from './routes/auth.js';
import { candidateRouter } from './routes/candidate.js';
import { jobsRouter } from './routes/jobs.js';
import { companyRouter } from './routes/company.js';
import { metaRouter } from './routes/meta.js';

const PUBLIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const DEV_SECRET = 'conecta-vagas-dev-secret';
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

export function createApp({ db, sessionSecret = process.env.SESSION_SECRET } = {}) {
  const isProd = process.env.NODE_ENV === 'production';
  if (!sessionSecret) {
    if (isProd) throw new Error('SESSION_SECRET é obrigatório em produção');
    sessionSecret = DEV_SECRET;
  }

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '100kb' }));
  app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: isProd, maxAge: SEVEN_DAYS },
  }));

  app.use('/api/auth', authRouter(db));
  app.use('/api/candidate', candidateRouter(db));
  app.use('/api/jobs', jobsRouter(db));
  app.use('/api/company', companyRouter(db));
  app.use('/api/meta', metaRouter(db));
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
  });

  app.use(express.static(PUBLIC_DIR));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Requisição muito grande' });
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  });

  return app;
}
