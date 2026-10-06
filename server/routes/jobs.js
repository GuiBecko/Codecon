import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { HttpError, parseId } from '../validation.js';
import { profileFromRow } from '../profile-model.js';
import { JOB_SELECT, jobFromRow, parseJobFilters, filterJobs } from '../job-model.js';

export function jobsRouter(db) {
  const router = Router();
  router.use(requireRole(db, 'candidate'));

  const appliedJobIds = (candidateId) => new Set(
    db.prepare('SELECT job_id FROM applications WHERE candidate_id = ?').all(candidateId).map((r) => r.job_id),
  );

  const findJob = (rawId) => {
    let id;
    try {
      id = parseId(rawId);
    } catch {
      throw new HttpError(404, 'Vaga não encontrada');
    }
    const row = db.prepare(`${JOB_SELECT} WHERE j.id = ?`).get(id);
    if (!row) throw new HttpError(404, 'Vaga não encontrada');
    return jobFromRow(row);
  };

  router.get('/', (req, res) => {
    const filters = parseJobFilters(req.query);
    const rows = db.prepare(`${JOB_SELECT} WHERE j.status = 'open' ORDER BY j.created_at DESC, j.id DESC`).all();
    const applied = appliedJobIds(req.user.id);
    const jobs = filterJobs(rows.map(jobFromRow), filters);
    res.json(jobs.map((job) => ({ ...job, alreadyApplied: applied.has(job.id) })));
  });

  router.get('/:id', (req, res) => {
    const job = findJob(req.params.id);
    res.json({ ...job, alreadyApplied: appliedJobIds(req.user.id).has(job.id) });
  });

  router.post('/:id/apply', (req, res) => {
    const job = findJob(req.params.id);
    if (job.status !== 'open') {
      throw new HttpError(400, 'Esta vaga não está mais aceitando candidaturas');
    }
    const profile = profileFromRow(db.prepare('SELECT * FROM candidates WHERE user_id = ?').get(req.user.id));
    if (!profile.complete) {
      throw new HttpError(422, 'Complete seu currículo (nome, senioridade e ao menos uma tecnologia) antes de se candidatar');
    }
    let result;
    try {
      result = db.prepare('INSERT INTO applications (job_id, candidate_id) VALUES (?, ?)').run(job.id, req.user.id);
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new HttpError(409, 'Você já se candidatou a esta vaga');
      throw err;
    }
    res.status(201).json({ id: Number(result.lastInsertRowid), jobId: job.id, status: 'em_analise' });
  });

  return router;
}
