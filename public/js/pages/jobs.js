import { api, qs } from '../api.js';
import { escapeHtml, options, loading, emptyState, debounce, SENIORITY_LABELS } from '../ui.js';
import { jobCard, applyButton } from '../components.js';
import { bindApplyButtons } from '../apply.js';

const SEARCH_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';

function readFilters(query) {
  return {
    q: query.q || '',
    seniority: SENIORITY_LABELS[query.seniority] ? query.seniority : '',
    salaryMin: /^\d+$/.test(query.salaryMin || '') ? query.salaryMin : '',
    company: /^\d+$/.test(query.company || '') ? query.company : '',
    tech: (query.tech || '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
  };
}

export async function render(view, { query }) {
  const filters = readFilters(query);
  let meta = { companies: [], technologies: [] };
  let requestId = 0;

  view.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Encontre sua próxima vaga</h1>
        <p class="subtitle">Oportunidades abertas em empresas que estão contratando agora.</p>
      </div>
    </div>
    <div class="layout-sidebar">
      <aside class="sidebar collapsed" data-sidebar>
        <button type="button" class="btn btn-block filters-toggle" data-toggle-filters aria-expanded="false">Filtros <span data-filter-count></span></button>
        <div class="card form filters-body">
          <div class="field">
            <label for="f-q">Cargo</label>
            <div class="input-icon">${SEARCH_ICON}<input class="input" id="f-q" type="search" placeholder="Ex.: Desenvolvedor" value="${escapeHtml(filters.q)}" autocomplete="off"></div>
          </div>
          <div class="field">
            <label for="f-seniority">Senioridade</label>
            <select class="select" id="f-seniority">${options(SENIORITY_LABELS, filters.seniority, { placeholder: 'Todas' })}</select>
          </div>
          <div class="field">
            <label for="f-salary">Salário mínimo (R$)</label>
            <input class="input" id="f-salary" type="number" min="0" step="500" inputmode="numeric" placeholder="Ex.: 5000" value="${escapeHtml(filters.salaryMin)}">
          </div>
          <div class="field">
            <label for="f-company">Empresa</label>
            <select class="select" id="f-company"><option value="">Todas</option></select>
          </div>
          <div class="field">
            <span class="field-label">Tecnologias</span>
            <div class="chips" data-tech-chips><span class="muted small">Carregando…</span></div>
          </div>
          <button type="button" class="btn btn-ghost btn-block" data-clear>Limpar filtros</button>
        </div>
      </aside>
      <section class="stack" style="gap:16px; min-width:0">
        <div class="results-bar" data-results-bar></div>
        <div data-results>${loading('Buscando vagas…')}</div>
      </section>
    </div>`;

  const $ = (sel) => view.querySelector(sel);
  const results = $('[data-results]');
  const resultsBar = $('[data-results-bar]');
  bindApplyButtons(results);

  function activeCount() {
    return [filters.q, filters.seniority, filters.salaryMin, filters.company].filter(Boolean).length + filters.tech.length;
  }

  function paintCompanySelect() {
    const list = meta.companies.map((c) => ({ value: c.id, label: c.name }));
    $('#f-company').innerHTML = options(list, filters.company, { placeholder: 'Todas' });
  }

  function paintTechChips() {
    const all = [...new Set([...(meta.technologies || []), ...filters.tech])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    $('[data-tech-chips]').innerHTML = all.length
      ? all.map((t) => `<button type="button" class="chip-toggle" data-tech="${escapeHtml(t)}" aria-pressed="${filters.tech.includes(t)}">${escapeHtml(t)}</button>`).join('')
      : '<span class="muted small">Nenhuma tecnologia disponível.</span>';
  }

  function syncUrl() {
    history.replaceState(null, '', `#/vagas${qs({ ...filters })}`);
    const n = activeCount();
    $('[data-filter-count]').textContent = n ? `(${n})` : '';
  }

  async function search() {
    const id = ++requestId;
    syncUrl();
    results.setAttribute('aria-busy', 'true');
    if (!results.querySelector('.job-list')) results.innerHTML = loading('Buscando vagas…');
    else results.style.opacity = '0.6';
    try {
      const jobs = await api(`/jobs${qs(filters)}`);
      if (id !== requestId) return;
      paintResults(jobs || []);
    } catch (err) {
      if (id !== requestId) return;
      resultsBar.innerHTML = '';
      results.innerHTML = emptyState(err.message, { icon: '⚠️', title: 'Erro ao buscar vagas' });
    } finally {
      if (id === requestId) {
        results.style.opacity = '';
        results.removeAttribute('aria-busy');
      }
    }
  }

  function paintResults(jobs) {
    const n = jobs.length;
    resultsBar.innerHTML = `<span><strong>${n}</strong> ${n === 1 ? 'vaga encontrada' : 'vagas encontradas'}</span>
      ${activeCount() ? '<button type="button" class="link-btn small" data-clear>Limpar filtros</button>' : ''}`;
    if (!n) {
      results.innerHTML = emptyState(
        activeCount() ? 'Tente remover alguns filtros ou buscar por outro cargo.' : 'Ainda não há vagas abertas. Volte em breve!',
        { title: 'Nenhuma vaga encontrada', actionHtml: activeCount() ? '<button type="button" class="btn btn-primary" data-clear>Limpar filtros</button>' : '' },
      );
      return;
    }
    results.innerHTML = `<div class="job-list">${jobs.map((job) => jobCard(job, { actions: applyButton(job, { size: 'sm' }) })).join('')}</div>`;
  }

  // ----- eventos -----
  const debouncedSearch = debounce(search, 300);

  $('#f-q').addEventListener('input', (e) => { filters.q = e.target.value.trim(); debouncedSearch(); });
  $('#f-salary').addEventListener('input', (e) => {
    const v = e.target.value.trim();
    filters.salaryMin = /^\d+$/.test(v) ? String(Number(v)) : '';
    debouncedSearch();
  });
  $('#f-seniority').addEventListener('change', (e) => { filters.seniority = e.target.value; search(); });
  $('#f-company').addEventListener('change', (e) => { filters.company = e.target.value; search(); });

  view.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-tech]');
    if (chip) {
      const t = chip.dataset.tech;
      filters.tech = filters.tech.includes(t) ? filters.tech.filter((x) => x !== t) : [...filters.tech, t];
      chip.setAttribute('aria-pressed', String(filters.tech.includes(t)));
      search();
      return;
    }
    if (e.target.closest('[data-clear]')) {
      Object.assign(filters, { q: '', seniority: '', salaryMin: '', company: '', tech: [] });
      $('#f-q').value = '';
      $('#f-salary').value = '';
      $('#f-seniority').value = '';
      $('#f-company').value = '';
      paintTechChips();
      search();
      return;
    }
    const toggle = e.target.closest('[data-toggle-filters]');
    if (toggle) {
      const sidebar = $('[data-sidebar]');
      const collapsed = sidebar.classList.toggle('collapsed');
      toggle.setAttribute('aria-expanded', String(!collapsed));
    }
  });

  // ----- carga inicial -----
  const metaPromise = api('/meta/filters').then((m) => {
    meta = { companies: m?.companies || [], technologies: m?.technologies || [] };
  }).catch(() => {
    $('[data-tech-chips]').innerHTML = '<span class="muted small">Não foi possível carregar.</span>';
  });

  search();
  await metaPromise;
  if (!view.isConnected) return;
  paintCompanySelect();
  paintTechChips();
}
