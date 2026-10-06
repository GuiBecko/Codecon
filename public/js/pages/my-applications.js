import { api } from '../api.js';
import { escapeHtml, emptyState, formatDate } from '../ui.js';
import { statusBadge, companyLogo } from '../components.js';

export async function render(view) {
  view.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Minhas candidaturas</h1>
        <p class="subtitle">Acompanhe o andamento de cada processo seletivo.</p>
      </div>
      <a class="btn btn-primary" href="#/vagas">Buscar vagas</a>
    </div>
    <div data-list><div class="loading" role="status"><span class="spinner"></span><span>Carregando candidaturas…</span></div></div>`;

  const list = view.querySelector('[data-list]');
  const apps = (await api('/candidate/applications')) || [];
  if (!view.isConnected) return;

  if (!apps.length) {
    list.innerHTML = emptyState('Você ainda não se candidatou a nenhuma vaga. Que tal começar agora?', {
      icon: '📄',
      title: 'Nenhuma candidatura',
      actionHtml: '<a class="btn btn-primary" href="#/vagas">Ver vagas abertas</a>',
    });
    return;
  }

  const counts = apps.reduce((acc, a) => ({ ...acc, [a.status]: (acc[a.status] || 0) + 1 }), {});
  const summary = [
    ['em_analise', 'em análise'], ['aprovado', counts.aprovado === 1 ? 'aprovada' : 'aprovadas'],
    ['nao_selecionado', 'não selecionadas'],
  ].filter(([k]) => counts[k]).map(([k, t]) => `<strong>${counts[k]}</strong> ${t}`).join(' · ');

  list.innerHTML = `
    <p class="muted small" style="margin-bottom:12px">${apps.length} ${apps.length === 1 ? 'candidatura' : 'candidaturas'}${summary ? ` — ${summary}` : ''}</p>
    <div class="app-list">
      ${apps.map((a) => {
        const job = a.job || {};
        return `<article class="card app-row">
          <div class="row" style="flex-wrap:nowrap; gap:14px; min-width:0">
            ${companyLogo(job.companyName, null)}
            <div style="min-width:0">
              <div class="title"><a href="#/vagas/${encodeURIComponent(job.id)}">${escapeHtml(job.title)}</a></div>
              <div class="sub">${escapeHtml(job.companyName)}${job.status === 'closed' ? ' · vaga encerrada' : ''}</div>
            </div>
          </div>
          <span class="date">Candidatou-se em ${escapeHtml(formatDate(a.createdAt))}</span>
          ${statusBadge(a.status)}
        </article>`;
      }).join('')}
    </div>`;
}
