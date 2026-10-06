import { api } from '../api.js';
import { escapeHtml, label, formatDate, formatSalaryRange, SENIORITY_LABELS, WORK_MODEL_LABELS } from '../ui.js';
import { techChips, jobMeta, applyButton, statusBadge, companyLogo } from '../components.js';
import { bindApplyButtons } from '../apply.js';

export async function render(view, { params }) {
  const job = await api(`/jobs/${params.id}`);
  if (!view.isConnected) return;

  const closed = job.status === 'closed';
  const action = closed
    ? `<div class="stack" style="gap:8px">${statusBadge('closed')}<p class="muted small">Esta vaga foi encerrada e não aceita novas candidaturas.</p></div>`
    : applyButton(job, { size: 'lg' }).replace('class="btn ', 'class="btn btn-block ');

  view.innerHTML = `
    <a class="link-back" href="#/vagas">← Voltar para vagas</a>
    <div class="detail-grid">
      <div class="stack" style="gap:20px; min-width:0">
        <div class="card card-lg stack" style="gap:16px">
          <div class="detail-head">
            ${companyLogo(job.companyName, job.companyId, 'lg')}
            <div style="min-width:0">
              <h1>${escapeHtml(job.title)}</h1>
              <div class="muted" style="margin-top:4px">${escapeHtml(job.companyName)}</div>
            </div>
          </div>
          ${jobMeta(job)}
          ${techChips(job.technologies)}
        </div>
        <div class="card card-lg">
          <h2>Sobre a vaga</h2>
          <div class="description" style="margin-top:12px">${escapeHtml(job.description || 'Sem descrição.')}</div>
        </div>
      </div>
      <aside class="detail-aside">
        <div class="card stack" data-apply-box>
          ${action}
          ${job.alreadyApplied ? '<p class="muted small">Acompanhe o status em <a href="#/minhas-candidaturas">Minhas candidaturas</a>.</p>' : ''}
        </div>
        <div class="card">
          <dl class="kv">
            <div><dt>Senioridade</dt><dd>${escapeHtml(label(SENIORITY_LABELS, job.seniority) || '—')}</dd></div>
            <div><dt>Modelo</dt><dd>${escapeHtml(label(WORK_MODEL_LABELS, job.workModel) || '—')}</dd></div>
            <div><dt>Local</dt><dd>${escapeHtml(job.location || '—')}</dd></div>
            <div><dt>Salário</dt><dd>${escapeHtml(formatSalaryRange(job.salaryMin, job.salaryMax))}</dd></div>
            <div><dt>Publicada em</dt><dd>${escapeHtml(formatDate(job.createdAt) || '—')}</dd></div>
          </dl>
        </div>
      </aside>
    </div>`;

  bindApplyButtons(view.querySelector('[data-apply-box]'), {
    onApplied: () => {
      const box = view.querySelector('[data-apply-box]');
      if (box && !box.querySelector('a[href="#/minhas-candidaturas"]')) {
        box.insertAdjacentHTML('beforeend', '<p class="muted small">Acompanhe o status em <a href="#/minhas-candidaturas">Minhas candidaturas</a>.</p>');
      }
    },
  });
}
