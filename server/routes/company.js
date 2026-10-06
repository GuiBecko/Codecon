import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { HttpError, techsToCsv } from '../validation.js';
import { JOB_SELECT, jobFromRow, parseJobInput } from '../job-model.js';

export function companyRouter(db) {
  const router = Router();
  router.use(requireRole(db, 'company'));

  const getJob = (id) => {
    const row = db.prepare(`${JOB_SELECT} WHERE j.id = ?`).get(id);
    return row ? jobFromRow(row) : null;
  };

  router.post('/jobs', (req, res) => {
    const j = parseJobInput(req.body);
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO jobs (company_id, title, description, seniority, salary_min, salary_max,
        technologies, location, work_model)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id, j.title, j.description, j.seniority, j.salaryMin, j.salaryMax,
      techsToCsv(j.technologies), j.location, j.workModel,
    );
    res.status(201).json(getJob(Number(lastInsertRowid)));
  });

  router.get('/jobs', (req, res) => {
    const status = req.query.status ?? 'open';
    if (status !== 'open' && status !== 'closed') {
      throw new HttpError(400, 'Status inválido. Use open ou closed');
    }
    const rows = db.prepare(`
      SELECT j.*, c.name AS company_name,
        (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS applications_count,
        (SELECT k.full_name FROM applications a JOIN candidates k ON k.user_id = a.candidate_id
          WHERE a.id = j.hired_application_id) AS hired_candidate_name
      FROM jobs j
      JOIN companies c ON c.user_id = j.company_id
      WHERE j.company_id = ? AND j.status = ?
      ORDER BY j.created_at DESC, j.id DESC
    `).all(req.user.id, status);
    res.json(rows.map((r) => ({
      ...jobFromRow(r),
      applicationsCount: r.applications_count,
      hiredCandidateName: r.hired_candidate_name ?? null,
    })));
  });

  return router;
}
