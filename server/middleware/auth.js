import { HttpError } from '../validation.js';

export function findUserById(db, id) {
  const row = db.prepare(`
    SELECT u.id, u.email, u.role, COALESCE(c.name, k.full_name) AS name
    FROM users u
    LEFT JOIN companies c ON c.user_id = u.id
    LEFT JOIN candidates k ON k.user_id = u.id
    WHERE u.id = ?
  `).get(id);
  if (!row) return null;
  return { id: row.id, email: row.email, role: row.role, name: row.name ?? '' };
}

function loadUser(db, req) {
  const userId = req.session?.userId;
  if (!userId) return null;
  return findUserById(db, userId);
}

export function requireAuth(db) {
  return (req, res, next) => {
    const user = loadUser(db, req);
    if (!user) return next(new HttpError(401, 'Faça login para continuar'));
    req.user = user;
    next();
  };
}

export function requireRole(db, role) {
  return (req, res, next) => {
    const user = loadUser(db, req);
    if (!user) return next(new HttpError(401, 'Faça login para continuar'));
    if (user.role !== role) return next(new HttpError(403, 'Acesso não permitido para este perfil'));
    req.user = user;
    next();
  };
}
