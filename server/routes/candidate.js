import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { profileFromRow, parseProfileInput } from '../profile-model.js';
import { techsToCsv } from '../validation.js';

export function candidateRouter(db) {
  const router = Router();
  router.use(requireRole(db, 'candidate'));

  const getProfile = (userId) =>
    profileFromRow(db.prepare('SELECT * FROM candidates WHERE user_id = ?').get(userId));

  router.get('/profile', (req, res) => {
    res.json(getProfile(req.user.id));
  });

  router.put('/profile', (req, res) => {
    const p = parseProfileInput(req.body);
    db.prepare(`
      UPDATE candidates SET full_name = ?, phone = ?, city = ?, linkedin = ?, seniority = ?,
        technologies = ?, summary = ?, experiences = ?, education = ?, updated_at = datetime('now')
      WHERE user_id = ?
    `).run(
      p.fullName, p.phone, p.city, p.linkedin, p.seniority, techsToCsv(p.technologies),
      p.summary, JSON.stringify(p.experiences), JSON.stringify(p.education), req.user.id,
    );
    res.json(getProfile(req.user.id));
  });

  router.get('/applications', (req, res) => {
    const rows = db.prepare(`
      SELECT a.id, a.status, a.created_at, j.id AS job_id, j.title, j.status AS job_status,
        c.name AS company_name
      FROM applications a
      JOIN jobs j ON j.id = a.job_id
      JOIN companies c ON c.user_id = j.company_id
      WHERE a.candidate_id = ?
      ORDER BY a.created_at DESC, a.id DESC
    `).all(req.user.id);
    res.json(rows.map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.created_at,
      job: { id: r.job_id, title: r.title, companyName: r.company_name, status: r.job_status },
    })));
  });

  return router;
}
