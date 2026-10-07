import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { HttpError, parseId, techsToCsv } from '../validation.js';
import { profileFromRow } from '../profile-model.js';
import { JOB_SELECT, jobFromRow, parseJobInput } from '../job-model.js';
import { rankApplications, scoreMatch, matchJobs } from '../match.js';
import { buildRejectionEmail } from '../rejection-emails.js';
import { sendPdf } from '../resume-pdf.js';

export function companyRouter(db, uploadsDir, mailer) {
  const router = Router();
  router.use(requireRole(db, 'company'));

  const getJob = (id) => {
    const row = db.prepare(`${JOB_SELECT} WHERE j.id = ?`).get(id);
    return row ? jobFromRow(row) : null;
  };

  const pendingApplicationIds = (jobId) => db
    .prepare("SELECT id FROM applications WHERE job_id = ? AND status = 'em_analise'")
    .all(jobId).map((r) => r.id);

  // E-mails de retorno: montados e enviados depois do commit, fora do ciclo da resposta.
  const notifyRejections = (applicationIds, reason, jobId) => {
    if (!applicationIds.length || !mailer) return;
    mailer.defer(() => {
      const job = getJob(jobId);
      const openJobs = reason === 'vaga_encerrada'
        ? db.prepare(`${JOB_SELECT} WHERE j.status = 'open'`).all().map(jobFromRow)
        : [];
      return applicationIds.map((applicationId) => {
        const row = db.prepare(`
          SELECT u.id AS user_id, u.email, k.*
          FROM applications a
          JOIN users u ON u.id = a.candidate_id
          JOIN candidates k ON k.user_id = a.candidate_id
          WHERE a.id = ?
        `).get(applicationId);
        const candidate = profileFromRow(row);
        let recommendations = [];
        if (reason === 'vaga_encerrada') {
          const applied = new Set(db.prepare('SELECT job_id FROM applications WHERE candidate_id = ?')
            .all(row.user_id).map((r) => r.job_id));
          recommendations = matchJobs(candidate.technologies, openJobs.filter((j) => !applied.has(j.id)))
            .slice(0, 3);
        }
        const email = buildRejectionEmail({
          reason,
          candidate,
          job,
          companyName: job.companyName,
          match: scoreMatch(candidate.technologies, job.technologies),
          recommendations,
        });
        return { ...email, to: row.email, toUserId: row.user_id, reason, jobId: job.id };
      });
    });
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

  const findOwnJob = (rawId, companyId) => {
    let id;
    try {
      id = parseId(rawId);
    } catch {
      throw new HttpError(404, 'Vaga não encontrada');
    }
    const job = getJob(id);
    if (!job) throw new HttpError(404, 'Vaga não encontrada');
    if (job.companyId !== companyId) throw new HttpError(403, 'Esta vaga pertence a outra empresa');
    return job;
  };

  router.get('/jobs/:id/applications', (req, res) => {
    const job = findOwnJob(req.params.id, req.user.id);
    const rows = db.prepare(`
      SELECT a.id AS application_id, a.status AS application_status, a.created_at AS application_created_at,
        u.email AS candidate_email, k.*
      FROM applications a
      JOIN candidates k ON k.user_id = a.candidate_id
      JOIN users u ON u.id = a.candidate_id
      WHERE a.job_id = ?
      ORDER BY a.created_at ASC, a.id ASC
    `).all(job.id);
    const applications = rows.map((r) => ({
      id: r.application_id,
      status: r.application_status,
      createdAt: r.application_created_at,
      candidate: { ...profileFromRow(r), email: r.candidate_email },
    }));
    res.json({
      job,
      applications: rankApplications(applications, job),
    });
  });

  router.get('/applications/:id/resume-pdf', (req, res) => {
    let id;
    try {
      id = parseId(req.params.id);
    } catch {
      throw new HttpError(404, 'Candidatura não encontrada');
    }
    const row = db.prepare(`
      SELECT j.company_id, k.resume_pdf_path, k.resume_pdf_name
      FROM applications a
      JOIN jobs j ON j.id = a.job_id
      JOIN candidates k ON k.user_id = a.candidate_id
      WHERE a.id = ?
    `).get(id);
    if (!row) throw new HttpError(404, 'Candidatura não encontrada');
    if (row.company_id !== req.user.id) throw new HttpError(403, 'Esta vaga pertence a outra empresa');
    sendPdf(res, uploadsDir, row);
  });

  router.post('/jobs/:id/close', (req, res) => {
    const job = findOwnJob(req.params.id, req.user.id);
    if (job.status !== 'open') throw new HttpError(400, 'Esta vaga já está fechada');

    const raw = (req.body ?? {}).applicationId;
    const applicationId = typeof raw === 'number' ? raw
      : typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isSafeInteger(applicationId) || applicationId <= 0) {
      throw new HttpError(400, 'Selecione a candidatura a ser aprovada');
    }
    const application = db.prepare('SELECT id FROM applications WHERE id = ? AND job_id = ?')
      .get(applicationId, job.id);
    if (!application) throw new HttpError(400, 'Esta candidatura não pertence a esta vaga');

    const rejected = db.transaction(() => {
      const updated = db.prepare(`
        UPDATE jobs SET status = 'closed', hired_application_id = ? WHERE id = ? AND status = 'open'
      `).run(applicationId, job.id);
      if (updated.changes !== 1) throw new HttpError(400, 'Esta vaga já está fechada');
      const ids = pendingApplicationIds(job.id).filter((id) => id !== applicationId);
      db.prepare("UPDATE applications SET status = 'aprovado' WHERE id = ?").run(applicationId);
      db.prepare("UPDATE applications SET status = 'nao_selecionado' WHERE job_id = ? AND id <> ?")
        .run(job.id, applicationId);
      return ids;
    })();

    notifyRejections(rejected, 'outro_candidato', job.id);
    res.json(getJob(job.id));
  });

  router.post('/jobs/:id/cancel', (req, res) => {
    const job = findOwnJob(req.params.id, req.user.id);
    if (job.status !== 'open') throw new HttpError(400, 'Esta vaga já está fechada');

    const rejected = db.transaction(() => {
      const updated = db.prepare(`
        UPDATE jobs SET status = 'closed', hired_application_id = NULL WHERE id = ? AND status = 'open'
      `).run(job.id);
      if (updated.changes !== 1) throw new HttpError(400, 'Esta vaga já está fechada');
      const ids = pendingApplicationIds(job.id);
      db.prepare("UPDATE applications SET status = 'nao_selecionado' WHERE job_id = ? AND status = 'em_analise'")
        .run(job.id);
      return ids;
    })();

    notifyRejections(rejected, 'vaga_encerrada', job.id);
    res.json(getJob(job.id));
  });

  return router;
}
