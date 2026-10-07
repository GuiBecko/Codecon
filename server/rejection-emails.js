// Monta os e-mails de retorno para candidatos não selecionados (função pura).

export const REJECTION_REASONS = ['outro_candidato', 'vaga_encerrada'];

const SENIORITY_LABEL = {
  estagio: 'Estágio',
  junior: 'Júnior',
  pleno: 'Pleno',
  senior: 'Sênior',
  especialista: 'Especialista',
};

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function firstName(fullName) {
  const first = String(fullName ?? '').trim().split(/\s+/)[0];
  return first || 'candidato(a)';
}

const list = (items) => items.join(', ');
const htmlList = (items) => `<ul>${items.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`;

function layout(bodyHtml) {
  return `<!doctype html><html lang="pt-BR"><body style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.5;max-width:600px;margin:0 auto;padding:16px">${bodyHtml}<p style="color:#6b7280;font-size:12px;margin-top:32px">Este é um e-mail automático enviado pela Conecta Vagas. Por favor, não responda.</p></body></html>`;
}

function outroCandidato({ name, job, companyName, match, candidate }) {
  const techs = match ?? { matchScore: 0, matchedTechnologies: [], missingTechnologies: [] };
  const text = [];
  const html = [];
  const t = escapeHtml(job.title);
  const c = escapeHtml(companyName);

  text.push(`Olá, ${name}!`, '');
  html.push(`<p>Olá, ${escapeHtml(name)}!</p>`);

  const intro = `Agradecemos muito o seu interesse na vaga ${job.title} da ${companyName} e o tempo dedicado ao processo seletivo.`;
  const decision = 'Após avaliar as candidaturas, a empresa selecionou outra pessoa cujo perfil estava mais alinhado aos requisitos desta posição. Por isso, desta vez sua candidatura não seguirá adiante.';
  text.push(intro, '', decision, '');
  html.push(
    `<p>Agradecemos muito o seu interesse na vaga <strong>${t}</strong> da <strong>${c}</strong> e o tempo dedicado ao processo seletivo.</p>`,
    `<p>${escapeHtml(decision)}</p>`,
  );

  text.push('Um retorno sobre o seu perfil para esta vaga:');
  html.push('<h3>Um retorno sobre o seu perfil para esta vaga</h3>');

  const total = techs.matchedTechnologies.length + techs.missingTechnologies.length;
  const scoreLine = `Você atende ${techs.matchScore}% das tecnologias pedidas (${techs.matchedTechnologies.length} de ${total}).`;
  text.push(`- ${scoreLine}`);
  html.push(`<p>${escapeHtml(scoreLine)}</p>`);

  if (techs.matchedTechnologies.length) {
    text.push(`- Tecnologias em que você já se destaca: ${list(techs.matchedTechnologies)}`);
    html.push('<p>Tecnologias em que você já se destaca:</p>', htmlList(techs.matchedTechnologies));
  }
  if (techs.missingTechnologies.length) {
    text.push(`- Tecnologias que fortaleceriam seu perfil para vagas como esta: ${list(techs.missingTechnologies)}`);
    html.push('<p>Tecnologias que fortaleceriam seu perfil para vagas como esta:</p>', htmlList(techs.missingTechnologies));
  } else if (total > 0) {
    const all = 'Você atende a todas as tecnologias pedidas — a decisão se deu por outros fatores do processo, como experiência e aderência ao momento da equipe.';
    text.push(`- ${all}`);
    html.push(`<p>${escapeHtml(all)}</p>`);
  }

  const cs = candidate?.seniority;
  if (cs && job.seniority && cs !== job.seniority) {
    const note = `A vaga era para nível ${SENIORITY_LABEL[job.seniority] ?? job.seniority}, e seu perfil está cadastrado como ${SENIORITY_LABEL[cs] ?? cs}. Vale priorizar vagas do seu nível atual — ou mirar este nível à medida que ganhar experiência.`;
    text.push(`- ${note}`);
    html.push(`<p>${escapeHtml(note)}</p>`);
  }

  const close = 'Seu currículo continua na Conecta Vagas e você pode se candidatar a outras oportunidades quando quiser. Desejamos muito sucesso na sua jornada!';
  text.push('', close, '', 'Equipe Conecta Vagas');
  html.push(`<p>${escapeHtml(close)}</p>`, '<p>Equipe Conecta Vagas</p>');

  return {
    subject: `Atualização sobre a vaga ${job.title} — ${companyName}`,
    text: text.join('\n'),
    html: layout(html.join('')),
  };
}

function vagaEncerrada({ name, job, companyName, recommendations }) {
  const recs = (recommendations ?? []).slice(0, 3);
  const text = [];
  const html = [];
  const t = escapeHtml(job.title);
  const c = escapeHtml(companyName);

  text.push(`Olá, ${name}!`, '');
  html.push(`<p>Olá, ${escapeHtml(name)}!</p>`);

  const info = `Queremos avisar que a vaga ${job.title} da ${companyName}, para a qual você se candidatou, foi encerrada pela empresa sem contratação.`;
  const notYou = 'Essa decisão não tem relação com o seu perfil: a posição deixou de existir neste momento. Agradecemos muito o seu interesse e o tempo dedicado.';
  text.push(info, '', notYou, '');
  html.push(
    `<p>Queremos avisar que a vaga <strong>${t}</strong> da <strong>${c}</strong>, para a qual você se candidatou, foi encerrada pela empresa sem contratação.</p>`,
    `<p>${escapeHtml(notYou)}</p>`,
  );

  if (recs.length) {
    text.push('Separamos algumas vagas abertas compatíveis com o seu perfil:');
    html.push('<p>Separamos algumas vagas abertas compatíveis com o seu perfil:</p><ul>');
    for (const r of recs) {
      text.push(`- ${r.title} — ${r.companyName} (${r.matchScore}% de compatibilidade)`);
      html.push(`<li><strong>${escapeHtml(r.title)}</strong> — ${escapeHtml(r.companyName)} (${escapeHtml(r.matchScore)}% de compatibilidade)</li>`);
    }
    html.push('</ul>');
  } else {
    const generic = 'Veja as vagas abertas na Conecta Vagas — novas oportunidades são publicadas o tempo todo.';
    text.push(generic);
    html.push(`<p>${escapeHtml(generic)}</p>`);
  }

  const close = 'Não desanime: continue se candidatando. Desejamos muito sucesso na sua jornada!';
  text.push('', close, '', 'Equipe Conecta Vagas');
  html.push(`<p>${escapeHtml(close)}</p>`, '<p>Equipe Conecta Vagas</p>');

  return {
    subject: `A vaga ${job.title} — ${companyName} foi encerrada`,
    text: text.join('\n'),
    html: layout(html.join('')),
  };
}

export function buildRejectionEmail({ reason, candidate, job, companyName, match, recommendations }) {
  const name = firstName(candidate?.fullName);
  const company = companyName ?? job.companyName ?? '';
  if (reason === 'outro_candidato') return outroCandidato({ name, job, companyName: company, match, candidate });
  if (reason === 'vaga_encerrada') return vagaEncerrada({ name, job, companyName: company, recommendations });
  throw new Error(`Motivo de e-mail desconhecido: ${reason}`);
}
