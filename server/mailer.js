import nodemailer from 'nodemailer';

const DEFAULT_USER = 'guilherme2becker@gmail.com';
const DEFAULT_FROM = `Conecta Vagas <${DEFAULT_USER}>`;

let warnedJson = false;

// Escolhe o transporte a partir do ambiente. Sem SMTP_PASS/SMTP_URL, nada sai da máquina:
// o jsonTransport só "simula" o envio e o e-mail fica registrado na caixa de demonstração.
export function transportFromEnv(env = process.env) {
  if (env.SMTP_URL) return nodemailer.createTransport(env.SMTP_URL);
  if (env.SMTP_PASS) {
    const port = Number(env.SMTP_PORT) || 465;
    return nodemailer.createTransport({
      host: env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: { user: env.SMTP_USER || DEFAULT_USER, pass: env.SMTP_PASS },
    });
  }
  if (!warnedJson) {
    warnedJson = true;
    console.warn('SMTP_PASS/SMTP_URL não configurados: e-mails apenas registrados na caixa de demonstração (/emails.html).');
  }
  return nodemailer.createTransport({ jsonTransport: true });
}

export function createMailer({ db, transport, env = process.env } = {}) {
  const tx = transport ?? transportFromEnv(env);
  const from = env.MAIL_FROM || DEFAULT_FROM;
  const redirectTo = env.MAIL_REDIRECT_TO || '';
  const pending = new Set();

  const insert = db.prepare(`
    INSERT INTO emails (to_email, to_user_id, subject, text, html, reason, job_id, status, error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  async function deliver(mail) {
    let status = 'sent';
    let error = null;
    try {
      const to = redirectTo || mail.to;
      const subject = redirectTo ? `[para: ${mail.to}] ${mail.subject}` : mail.subject;
      await tx.sendMail({ from, to, subject, text: mail.text, html: mail.html });
    } catch (err) {
      status = 'failed';
      error = String(err?.message ?? err);
      console.error(`Falha ao enviar e-mail para ${mail.to}:`, error);
    }
    insert.run(mail.to, mail.toUserId ?? null, mail.subject, mail.text, mail.html,
      mail.reason ?? null, mail.jobId ?? null, status, error);
  }

  // Executa `work` fora do ciclo da requisição; nunca lança e nunca atrasa a resposta.
  // `work` devolve a lista de e-mails a enviar.
  function defer(work) {
    const p = new Promise((resolve) => setImmediate(resolve))
      .then(work)
      .then((mails) => Promise.all((mails ?? []).map(deliver)))
      .catch((err) => console.error('Erro ao preparar e-mails:', err))
      .finally(() => pending.delete(p));
    pending.add(p);
    return p;
  }

  return {
    defer,
    send: (mail) => defer(() => [mail]),
    // Para testes: aguarda todos os envios pendentes.
    async idle() {
      while (pending.size) await Promise.all([...pending]);
    },
  };
}
