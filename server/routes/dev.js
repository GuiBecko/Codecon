import { Router } from 'express';

// Rotas de apoio à demonstração. Só montadas fora de produção.
export function devRouter(db) {
  const router = Router();

  router.get('/emails', (req, res) => {
    const rows = db.prepare('SELECT * FROM emails ORDER BY created_at DESC, id DESC LIMIT 50').all();
    res.json(rows.map((r) => ({
      id: r.id,
      toEmail: r.to_email,
      subject: r.subject,
      reason: r.reason,
      jobId: r.job_id,
      status: r.status,
      error: r.error,
      html: r.html,
      text: r.text,
      createdAt: r.created_at,
    })));
  });

  return router;
}
