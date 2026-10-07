import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { profileFromRow, parseProfileInput } from '../profile-model.js';
import { techsToCsv } from '../validation.js';
import { pdfUpload, assertPdf, savePdf, removePdf, sendPdf, sanitizePdfName } from '../resume-pdf.js';

export function candidateRouter(db, uploadsDir) {
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
      UPDATE candidates SET full_name = ?, phone = ?, city = ?, state = ?, country = ?, linkedin = ?,
        seniority = ?, technologies = ?, summary = ?, experiences = ?, education = ?, updated_at = datetime('now')
      WHERE user_id = ?
    `).run(
      p.fullName, p.phone, p.city, p.state, p.country, p.linkedin, p.seniority, techsToCsv(p.technologies),
      p.summary, JSON.stringify(p.experiences), JSON.stringify(p.education), req.user.id,
    );
    res.json(getProfile(req.user.id));
  });

  const pdfRow = (userId) => db.prepare(
    'SELECT resume_pdf_path, resume_pdf_name FROM candidates WHERE user_id = ?',
  ).get(userId);

  router.put('/resume-pdf', pdfUpload, (req, res) => {
    assertPdf(req.file);
    const previous = pdfRow(req.user.id)?.resume_pdf_path;
    const filename = savePdf(uploadsDir, req.file.buffer);
    try {
      db.prepare(`
        UPDATE candidates SET resume_pdf_path = ?, resume_pdf_name = ?, resume_pdf_size = ?,
          resume_pdf_uploaded_at = datetime('now'), updated_at = datetime('now')
        WHERE user_id = ?
      `).run(filename, sanitizePdfName(req.file.originalname), req.file.size, req.user.id);
    } catch (err) {
      removePdf(uploadsDir, filename);
      throw err;
    }
    if (previous) removePdf(uploadsDir, previous);
    res.json(getProfile(req.user.id));
  });

  router.get('/resume-pdf', (req, res) => {
    sendPdf(res, uploadsDir, pdfRow(req.user.id));
  });

  router.delete('/resume-pdf', (req, res) => {
    const previous = pdfRow(req.user.id)?.resume_pdf_path;
    db.prepare(`
      UPDATE candidates SET resume_pdf_path = NULL, resume_pdf_name = NULL, resume_pdf_size = NULL,
        resume_pdf_uploaded_at = NULL, updated_at = datetime('now')
      WHERE user_id = ?
    `).run(req.user.id);
    if (previous) removePdf(uploadsDir, previous);
    res.status(204).end();
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
