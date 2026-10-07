import { api } from '../api.js';
import { escapeHtml, emptyState, loading } from '../ui.js';
import { jobCard, ICONS } from '../components.js';

export async function render(view, { query }) {
  const status = query.status === 'closed' ? 'closed' : 'open';

  view.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Minhas vagas</h1>
        <p class="subtitle">Gerencie suas vagas e avalie os candidatos.</p>
      </div>
      <a class="btn btn-primary" href="#/empresa/vagas/nova">+ Nova vaga</a>
    </div>
    <nav class="tabs" aria-label="Status das vagas">
      <a class="tab${status === 'open' ? ' active' : ''}" href="#/empresa/vagas"${status === 'open' ? ' aria-current="page"' : ''}>Abertas</a>
      <a class="tab${status === 'closed' ? ' active' : ''}" href="#/empresa/vagas?status=closed"${status === 'closed' ? ' aria-current="page"' : ''}>Fechadas</a>
    </nav>
    <div data-list>${loading('Carregando vagas…')}</div>`;

  const list = view.querySelector('[data-list]');
  const jobs = (await api(`/company/jobs?status=${status}`)) || [];
  if (!view.isConnected) return;

  if (!jobs.length) {
    list.innerHTML = status === 'open'
      ? emptyState('Publique sua primeira vaga e comece a receber candidatos.', {
        icon: '📢', title: 'Nenhuma vaga aberta',
        actionHtml: '<a class="btn btn-primary" href="#/empresa/vagas/nova">+ Nova vaga</a>',
      })
      : emptyState('Quando você contratar alguém ou encerrar uma vaga, ela aparece aqui.', { icon: '🗂️', title: 'Nenhuma vaga fechada' });
    return;
  }

  list.innerHTML = `<div class="job-list">${jobs.map((job) => {
    const n = Number(job.applicationsCount) || 0;
    const href = `#/empresa/vagas/${encodeURIComponent(job.id)}`;
    const footer = `<span class="meta-info">
      <span>${ICONS.users}&nbsp;<strong>${n}</strong>&nbsp;${n === 1 ? 'candidato' : 'candidatos'}</span>
      ${job.status === 'closed' ? (job.hiredCandidateName
        ? `<span style="color:var(--success-ink)">✓ Contratado(a): <strong>${escapeHtml(job.hiredCandidateName)}</strong></span>`
        : '<span>Encerrada sem contratação</span>') : ''}
    </span>`;
    return jobCard(job, {
      href,
      showCompany: false,
      footer,
      actions: `<a class="btn btn-sm" href="${escapeHtml(href)}">${job.status === 'open' ? 'Ver candidatos' : 'Ver detalhes'}</a>`,
    });
  }).join('')}</div>`;
}
