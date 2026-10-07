import { api } from '../api.js';
import { go } from '../session.js';
import {
  escapeHtml, label, formatDate, formatLocation, initials, toast, withButton, confirmModal, emptyState, SENIORITY_LABELS,
} from '../ui.js';
import { jobMeta, techChips, statusBadge, resumeHtml, attachedPdfHtml, ICONS } from '../components.js';
import { downloadResumePdf } from '../resume-pdf.js';

export async function render(view, { params }) {
  const data = await api(`/company/jobs/${params.id}/applications`);
  if (!view.isConnected) return;
  const job = data.job || {};
  const apps = Array.isArray(data.applications) ? data.applications : [];
  const open = job.status === 'open';
  const hired = apps.find((a) => a.id === job.hiredApplicationId) || apps.find((a) => a.status === 'aprovado');
  const nameOf = (a) => (a.candidate && a.candidate.fullName) || 'Candidato(a) sem nome';

  // Contratado primeiro; depois em ordem de candidatura.
  const ordered = [...apps].sort((a, b) => (b === hired) - (a === hired));

  view.innerHTML = `
    <a class="link-back" href="#/empresa/vagas${open ? '' : '?status=closed'}">← Voltar para minhas vagas</a>
    <div class="card card-lg stack" style="gap:16px">
      <div class="row" style="justify-content:space-between; align-items:flex-start; gap:12px">
        <div style="min-width:0">
          <h1>${escapeHtml(job.title)}</h1>
          <div class="muted small" style="margin-top:4px">Publicada em ${escapeHtml(formatDate(job.createdAt))}</div>
        </div>
        ${statusBadge(job.status)}
      </div>
      ${jobMeta(job)}
      ${techChips(job.technologies)}
      ${job.description ? `<details class="collapsible"><summary>Ver descrição da vaga</summary><div class="description">${escapeHtml(job.description)}</div></details>` : ''}
    </div>
    ${!open && hired ? `<div class="hired-banner">
      <span aria-hidden="true" style="font-size:1.3rem">🎉</span>
      <div>Vaga encerrada. Contratado(a): <strong>${escapeHtml(nameOf(hired))}</strong></div>
    </div>` : ''}
    <div class="page-header">
      <h2>Candidatos (${apps.length})</h2>
      ${open && apps.length ? '<span class="muted small">Clique em um candidato para ver o currículo completo.</span>' : ''}
    </div>
    <div class="stack" data-list>
      ${apps.length ? ordered.map((a) => applicantHtml(a, { open, isHired: a === hired, nameOf })).join('')
        : emptyState(open ? 'Assim que alguém se candidatar, o currículo aparece aqui.' : 'Esta vaga foi encerrada sem candidaturas.', { icon: '👥', title: 'Nenhum candidato ainda' })}
    </div>`;

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
        + (others > 0 ? ` ${others === 1 ? 'O outro candidato será marcado' : `Os outros ${others} candidatos serão marcados`} como "Não selecionado".` : '')
        + ' Esta ação não pode ser desfeita.',
      confirmText: 'Contratar e fechar',
      confirmClass: 'btn-success',
    });
    if (!ok || !view.isConnected) return;
    await withButton(btn, async () => {
      await api(`/company/jobs/${job.id}/close`, { method: 'POST', body: { applicationId: appId } });
      toast(`${nameOf(app)} contratado(a)! Vaga fechada.`, 'success');
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
      ${statusBadge(a.status)}
      ${ICONS.chevron}
    </summary>
    <div class="applicant-body">
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

