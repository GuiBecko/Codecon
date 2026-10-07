// Componentes de UI que retornam strings HTML. Todo dado dinâmico passa por escapeHtml.
import {
  escapeHtml, label, formatSalaryRange, formatRelative, formatMonth, initials, formatLocation, formatBytes, formatDate,
  SENIORITY_LABELS, WORK_MODEL_LABELS, APPLICATION_STATUS_LABELS, JOB_STATUS_LABELS,
} from './ui.js';

const ICONS = {
  level: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 20h4V14H3zM10 20h4V9h-4zM17 20h4V4h-4z"/></svg>',
  pin: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  money: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg>',
  clock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  mail: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  phone: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>',
  link: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
  users: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></svg>',
  file: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg>',
  download: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/></svg>',
  upload: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/></svg>',
  chevron: '<svg class="caret" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
};

export { ICONS };

/** Paleta determinística para o "logo" da empresa. */
const LOGO_GRADIENTS = [
  ['#818cf8', '#4f46e5'], ['#34d399', '#059669'], ['#f472b6', '#db2777'],
  ['#fbbf24', '#d97706'], ['#38bdf8', '#0284c7'], ['#a78bfa', '#7c3aed'],
];

export function companyLogo(name, id, extraClass = '') {
  const key = Number(id) || String(name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const [a, b] = LOGO_GRADIENTS[Math.abs(key) % LOGO_GRADIENTS.length];
  return `<div class="company-logo ${escapeHtml(extraClass)}" style="background:linear-gradient(135deg, ${a}, ${b})" aria-hidden="true">${escapeHtml(initials(name))}</div>`;
}

/** Chips de tecnologias; `max` limita e mostra "+N". */
export function techChips(techs, { max } = {}) {
  const list = Array.isArray(techs) ? techs.filter(Boolean) : [];
  if (!list.length) return '';
  const shown = max && list.length > max ? list.slice(0, max) : list;
  const rest = list.length - shown.length;
  return `<div class="chips">${shown.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join('')}${
    rest > 0 ? `<span class="chip chip-more">+${rest}</span>` : ''}</div>`;
}

/** Badge de status de candidatura (em_analise...) ou de vaga (open/closed). */
export function statusBadge(status) {
  const text = APPLICATION_STATUS_LABELS[status] || JOB_STATUS_LABELS[status] || status || '';
  return `<span class="badge badge-${escapeHtml(status)}">${escapeHtml(text)}</span>`;
}

/** Linha de metadados: senioridade, modelo + local, faixa salarial. */
export function jobMeta(job) {
  const place = [label(WORK_MODEL_LABELS, job.workModel), job.location].filter(Boolean).join(' · ');
  return `<div class="job-meta">
    ${job.seniority ? `<span>${ICONS.level}${escapeHtml(label(SENIORITY_LABELS, job.seniority))}</span>` : ''}
    ${place ? `<span>${ICONS.pin}${escapeHtml(place)}</span>` : ''}
    <span class="salary">${ICONS.money}${escapeHtml(formatSalaryRange(job.salaryMin, job.salaryMax))}</span>
  </div>`;
}

/** Botão de candidatura. */
export function applyButton(job, { size = '' } = {}) {
  const cls = size ? ` btn-${escapeHtml(size)}` : '';
  if (job.alreadyApplied) {
    return `<button type="button" class="btn btn-applied${cls}" disabled data-done>✓ Candidatado</button>`;
  }
  return `<button type="button" class="btn btn-primary${cls}" data-apply="${escapeHtml(job.id)}">Candidatar-se</button>`;
}

/**
 * Card de vaga.
 * @param job
 * @param opts.href     link do título (default: '#/vagas/:id')
 * @param opts.actions  HTML (já seguro) à direita do rodapé
 * @param opts.footer   HTML (já seguro) à esquerda do rodapé (default: data de publicação)
 * @param opts.showCompany
 */
export function jobCard(job, { href, actions = '', footer, showCompany = true } = {}) {
  const link = href || `#/vagas/${encodeURIComponent(job.id)}`;
  const foot = footer !== undefined
    ? footer
    : `<span class="meta-info"><span>${ICONS.clock}&nbsp;Publicada ${escapeHtml(formatRelative(job.createdAt))}</span></span>`;
  return `<article class="card job-card">
    <div class="job-card-head">
      ${showCompany ? companyLogo(job.companyName, job.companyId) : ''}
      <div class="job-card-title">
        <h3><a href="${escapeHtml(link)}">${escapeHtml(job.title)}</a></h3>
        ${showCompany ? `<div class="company-name">${escapeHtml(job.companyName)}</div>` : ''}
      </div>
      ${job.status === 'closed' ? statusBadge('closed') : ''}
    </div>
    ${jobMeta(job)}
    ${techChips(job.technologies, { max: 6 })}
    ${(foot || actions) ? `<div class="job-card-foot"><div>${foot || ''}</div><div class="row">${actions}</div></div>` : ''}
  </article>`;
}

/** Período de uma experiência: "mar/2022 → atual" / "mar/2020 → dez/2021". */
export function experiencePeriod(e = {}) {
  const a = formatMonth(e.inicio);
  // legado: sem o campo `atual`, fim vazio significava emprego atual
  const current = e.atual === true || (e.atual === undefined && !e.fim && Boolean(e.inicio));
  const b = current ? 'atual' : formatMonth(e.fim);
  if (a && b) return `${a} → ${b}`;
  if (a) return `desde ${a}`;
  return b && !current ? `até ${b}` : (current ? 'atual' : '');
}

/** Situação de uma formação: "Concluído em dez/2021" / "Em andamento · previsão jun/2027". */
export function educationStatus(e = {}) {
  const when = formatMonth(e.conclusao);
  if (e.situacao === 'em_andamento') return when ? `Em andamento · previsão ${when}` : 'Em andamento';
  if (e.situacao === 'concluido') return when ? `Concluído em ${when}` : 'Concluído';
  return when ? `Conclusão: ${when}` : '';
}

/** Currículo completo (visão da empresa e "Meu perfil"). */
export function resumeHtml(p = {}) {
  const contact = [];
  if (p.email) contact.push(`<a href="mailto:${escapeHtml(p.email)}">${ICONS.mail}${escapeHtml(p.email)}</a>`);
  if (p.phone) contact.push(`<span>${ICONS.phone}${escapeHtml(p.phone)}</span>`);
  const place = formatLocation(p);
  if (place) contact.push(`<span>${ICONS.pin}${escapeHtml(place)}</span>`);
  if (p.linkedin) {
    const li = String(p.linkedin);
    contact.push(/^https?:\/\//i.test(li)
      ? `<a href="${escapeHtml(li)}" target="_blank" rel="noopener noreferrer">${ICONS.link}${escapeHtml(li.replace(/^https?:\/\/(www\.)?/i, ''))}</a>`
      : `<span>${ICONS.link}${escapeHtml(li)}</span>`);
  }

  const exps = Array.isArray(p.experiences) ? p.experiences : [];
  const edus = Array.isArray(p.education) ? p.education : [];

  return `<div class="resume">
    ${contact.length ? `<div class="resume-contact">${contact.join('')}</div>` : ''}
    ${p.technologies && p.technologies.length ? `<div class="resume-section"><div class="section-title">Tecnologias</div>${techChips(p.technologies)}</div>` : ''}
    ${p.summary ? `<div class="resume-section"><div class="section-title">Resumo</div><p class="resume-summary">${escapeHtml(p.summary)}</p></div>` : ''}
    <div class="resume-section">
      <div class="section-title">Experiências</div>
      ${exps.length ? `<ul class="timeline">${exps.map((e) => `<li>
        <div class="t-title">${escapeHtml(e.cargo || 'Cargo não informado')}${e.empresa ? ` · ${escapeHtml(e.empresa)}` : ''}</div>
        <div class="t-sub">${escapeHtml(experiencePeriod(e))}</div>
        ${e.descricao ? `<div class="t-desc">${escapeHtml(e.descricao)}</div>` : ''}
      </li>`).join('')}</ul>` : '<p class="muted small">Nenhuma experiência informada.</p>'}
    </div>
    <div class="resume-section">
      <div class="section-title">Formação</div>
      ${edus.length ? `<ul class="timeline">${edus.map((e) => `<li>
        <div class="t-title">${escapeHtml(e.curso || 'Curso não informado')}</div>
        <div class="t-sub">${escapeHtml([e.instituicao, educationStatus(e)].filter(Boolean).join(' · '))}</div>
      </li>`).join('')}</ul>` : '<p class="muted small">Nenhuma formação informada.</p>'}
    </div>
  </div>`;
}

/**
 * Linha do PDF anexado. `pdf` = {name, size, uploadedAt}.
 * @param opts.href link de download
 * @param opts.downloadText texto do link
 * @param opts.removable mostra o botão "Remover" (data-pdf-remove)
 */
export function attachedPdfHtml(pdf, { href, downloadText = 'Baixar', removable = false } = {}) {
  if (!pdf) return '';
  const meta = [formatBytes(pdf.size), pdf.uploadedAt ? `enviado em ${formatDate(pdf.uploadedAt)}` : ''].filter(Boolean).join(' · ');
  return `<div class="file-row">
    <span class="file-icon">${ICONS.file}</span>
    <div class="file-info">
      <strong title="${escapeHtml(pdf.name)}">${escapeHtml(pdf.name || 'curriculo.pdf')}</strong>
      ${meta ? `<span>${escapeHtml(meta)}</span>` : ''}
    </div>
    <div class="row">
      <a class="btn btn-sm" href="${escapeHtml(href)}" download>${ICONS.download}${escapeHtml(downloadText)}</a>
      ${removable ? '<button type="button" class="btn btn-sm btn-danger-ghost" data-pdf-remove>Remover</button>' : ''}
    </div>
  </div>`;
}
