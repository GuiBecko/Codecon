import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { csvToTechs } from '../validation.js';

export function metaRouter(db) {
  const router = Router();
  router.use(requireAuth(db));

  router.get('/filters', (req, res) => {
    const companies = db.prepare(`
      SELECT c.user_id AS id, c.name
      FROM companies c
      WHERE EXISTS (SELECT 1 FROM jobs j WHERE j.company_id = c.user_id AND j.status = 'open')
      ORDER BY c.name COLLATE NOCASE, c.user_id
    `).all();
    const techs = new Set();
    for (const row of db.prepare("SELECT technologies FROM jobs WHERE status = 'open'").all()) {
      for (const t of csvToTechs(row.technologies)) techs.add(t);
    }
    const technologies = [...techs].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    res.json({ companies, technologies });
  });

  return router;
}
