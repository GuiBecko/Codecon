import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { HttpError, text, oneOf } from '../validation.js';
import { findUserById, requireAuth } from '../middleware/auth.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_COST = 10;

function parseEmail(value) {
  const email = text(value, 'E-mail', { required: true, max: 254 }).toLowerCase();
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Informe um e-mail válido');
  return email;
}

function parsePassword(value) {
  if (typeof value !== 'string' || value.length < 6 || value.length > 72) {
    throw new HttpError(400, 'A senha deve ter entre 6 e 72 caracteres');
  }
  return value;
}

function startSession(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = userId;
      resolve();
    });
  });
}

export function authRouter(db) {
  const router = Router();

  router.post('/register', async (req, res) => {
    const body = req.body ?? {};
    const email = parseEmail(body.email);
    const password = parsePassword(body.password);
    const role = oneOf(body.role, ['company', 'candidate'], 'Perfil');
    const name = text(body.name, 'Nome', { required: true, max: 120 });

    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
      throw new HttpError(409, 'Este e-mail já está cadastrado');
    }
    const hash = await bcrypt.hash(password, BCRYPT_COST);

    let userId;
    try {
      userId = db.transaction(() => {
        const { lastInsertRowid } = db
          .prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)')
          .run(email, hash, role);
        const id = Number(lastInsertRowid);
        if (role === 'company') {
          db.prepare('INSERT INTO companies (user_id, name) VALUES (?, ?)').run(id, name);
        } else {
          db.prepare('INSERT INTO candidates (user_id, full_name) VALUES (?, ?)').run(id, name);
        }
        return id;
      })();
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new HttpError(409, 'Este e-mail já está cadastrado');
      throw err;
    }

    await startSession(req, userId);
    res.status(201).json(findUserById(db, userId));
  });

  router.post('/login', async (req, res) => {
    const body = req.body ?? {};
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const row = email && db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(email);
    const ok = row && password && (await bcrypt.compare(password, row.password_hash));
    if (!ok) throw new HttpError(401, 'E-mail ou senha incorretos');
    await startSession(req, row.id);
    res.json(findUserById(db, row.id));
  });

  router.post('/logout', (req, res, next) => {
    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie('connect.sid');
      res.status(204).end();
    });
  });

  router.get('/me', requireAuth(db), (req, res) => {
    res.json(req.user);
  });

  return router;
}
