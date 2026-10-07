import { api } from '../api.js';
import { go } from '../session.js';
import {
  escapeHtml, label, formatDate, formatLocation, initials, toast, withButton, confirmModal, emptyState, SENIORITY_LABELS,
} from '../ui.js';
import { jobMeta, techChips, statusBadge, resumeHtml, attachedPdfHtml, matchBadge, matchChips, ICONS } from '../components.js';
import { downloadResumePdf } from '../resume-pdf.js';

export async function render(view, { params }) {
  const data = await api(`/company/jobs/${params.id}/applications`);
  if (!view.isConnected) return;
  const job = data.job || {};
  const apps = Array.isArray(data.applications) ? data.applications : [];
  const open = job.status === 'open';
  const hired = apps.find((a) => a.id === job.hiredApplicationId) || apps.find((a) => a.status === 'aprovado');
  const nameOf = (a) => (a.candidate && a.candidate.fullName) || 'Candidato(a) sem nome';

  // Contratado primeiro; depois na ordem da API (maior compatibilidade primeiro).
  const ordered = [...apps].sort((a, b) => (b === hired) - (a === hired));

  view.innerHTML = `
    <a class="link-back" href="#/empresa/vagas${open ? '' : '?status=closed'}">← Voltar para minhas vagas</a>
    <div class="card card-lg stack" style="gap:16px">
      <div class="row" style="justify-content:space-between; align-items:flex-start; gap:12px">
        <div style="min-width:0">
          <h1>${escapeHtml(job.title)}</h1>
          <div class="muted small" style="margin-top:4px">Publicada em ${escapeHtml(formatDate(job.createdAt))}</div>
        </div>
        <div class="row" style="gap:8px; flex-wrap:wrap; justify-content:flex-end">
          ${statusBadge(job.status)}
          ${open ? '<button type="button" class="btn btn-sm btn-danger-ghost" data-cancel-job>Encerrar vaga sem contratar</button>' : ''}
        </div>
      </div>
      ${jobMeta(job)}
      ${techChips(job.technologies)}
      ${job.description ? `<details class="collapsible"><summary>Ver descrição da vaga</summary><div class="description">${escapeHtml(job.description)}</div></details>` : ''}
    </div>
    ${!open && hired ? `<div class="hired-banner">
      <span aria-hidden="true" style="font-size:1.3rem">🎉</span>
      <div>Vaga encerrada. Contratado(a): <strong>${escapeHtml(nameOf(hired))}</strong></div>
    </div>` : ''}
    ${!open && !hired ? `<div class="hired-banner" style="background:var(--neutral-soft); border-color:var(--border); color:var(--neutral-ink)">
      <span aria-hidden="true" style="font-size:1.3rem">🗂️</span>
      <div>Vaga encerrada sem contratação.</div>
    </div>` : ''}
    ${!open ? '<a class="demo-link" href="/emails.html" target="_blank" rel="noopener">✉️ Ver e-mails enviados aos candidatos — Caixa de e-mails (demo)</a>' : ''}
    <div class="page-header">
      <h2>Candidatos (${apps.length})</h2>
      ${apps.length ? `<span class="match-hint">↓ Ordenado por compatibilidade${open ? ' · clique em um candidato para ver o currículo completo' : ''}</span>` : ''}
    </div>
    <div class="stack" data-list>
      ${apps.length ? ordered.map((a) => applicantHtml(a, { open, isHired: a === hired, nameOf })).join('')
        : emptyState(open ? 'Assim que alguém se candidatar, o currículo aparece aqui.' : 'Esta vaga foi encerrada sem candidaturas.', { icon: '👥', title: 'Nenhum candidato ainda' })}
    </div>`;

  const cancelBtn = view.querySelector('[data-cancel-job]');
  if (cancelBtn) cancelBtn.addEventListener('click', async () => {
    const pending = apps.filter((a) => a.status === 'em_analise').length;
    const ok = await confirmModal({
      title: 'Encerrar vaga sem contratar?',
      message: `A vaga "${job.title}" será encerrada sem contratação.`
        + (pending > 0 ? ` ${pending === 1 ? 'O candidato em análise será marcado' : `Os ${pending} candidatos em análise serão marcados`} como "Não selecionado" e ${pending === 1 ? 'receberá' : 'receberão'} um e-mail informando que a vaga foi encerrada.` : '')
        + ' Esta ação não pode ser desfeita.',
      confirmText: 'Encerrar vaga',
      confirmClass: 'btn-danger',
    });
    if (!ok || !view.isConnected) return;
    await withButton(cancelBtn, async () => {
      await api(`/company/jobs/${job.id}/cancel`, { method: 'POST' });
      toast('Vaga encerrada. Candidatos notificados por e-mail.', 'success');
      go(location.hash);
    });
  });

  view.querySelector('[data-list]').addEventListener('click', async (e) => {
    const gen = e.target.closest('[data-gen-pdf]');
    if (gen) {
      const a = apps.find((x) => x.id === Number(gen.dataset.genPdf));
      if (a) withButton(gen, () => downloadResumePdf({ ...(a.candidate || {}), fullName: nameOf(a) }, a.candidate && a.candidate.email));
      return;
    }
    const btn = e.target.closest('[data-hire]');
    if (!btn) return;
    const appId = Number(btn.dataset.hire);
    const app = apps.find((a) => a.id === appId);
    const others = apps.length - 1;
    const ok = await confirmModal({
      title: 'Contratar e fechar vaga?',
      message: `${nameOf(app)} será marcado(a) como Aprovado(a) e a vaga "${job.title}" será fechada.`
        + (others > 0 ? ` ${others === 1 ? 'O outro candidato será marcado' : `Os outros ${others} candidatos serão marcados`} como "Não selecionado" e ${others === 1 ? 'receberá' : 'receberão'} um e-mail de retorno.` : '')
        + ' Esta ação não pode ser desfeita.',
      confirmText: 'Contratar e fechar',
      confirmClass: 'btn-success',
    });
    if (!ok || !view.isConnected) return;
    await withButton(btn, async () => {
      await api(`/company/jobs/${job.id}/close`, { method: 'POST', body: { applicationId: appId } });
      toast('Vaga fechada. Os demais candidatos foram notificados por e-mail.', 'success');
      go(location.hash);
    });
  });
}

function applicantHtml(a, { open, isHired, nameOf }) {
  const c = a.candidate || {};
  const sub = [label(SENIORITY_LABELS, c.seniority), formatLocation(c), `candidatou-se em ${formatDate(a.createdAt)}`].filter(Boolean).join(' · ');
  return `<details class="card applicant${isHired ? ' hired' : ''}"${isHired ? ' open' : ''}>
    <summary>
      <div class="avatar" aria-hidden="true">${escapeHtml(initials(nameOf(a)))}</div>
      <div class="who">
        <strong>${escapeHtml(nameOf(a))}</strong>
        <span>${escapeHtml(sub)}</span>
      </div>
      ${a.matchScore !== undefined && a.matchScore !== null ? matchBadge(a.matchScore) : ''}
      ${statusBadge(a.status)}
      ${ICONS.chevron}
    </summary>
    <div class="applicant-body">
      ${matchChips(a.matchedTechnologies, a.missingTechnologies)}
      ${c.resumePdf ? attachedPdfHtml(c.resumePdf, {
        href: `/api/company/applications/${encodeURIComponent(a.id)}/resume-pdf`,
        downloadText: 'Baixar PDF',
      }) : ''}
      ${resumeHtml(c)}
      <div class="form-actions">
        <button type="button" class="btn" data-gen-pdf="${escapeHtml(a.id)}">Gerar PDF</button>
        ${open ? `<button type="button" class="btn btn-success" data-hire="${escapeHtml(a.id)}">Contratar e fechar vaga</button>` : ''}
      </div>
    </div>
  </details>`;
}

