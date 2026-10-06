// Helpers de UI. IMPORTANTE: nenhum acesso ao DOM no momento do import
// (este módulo é testado em Node). O DOM só é tocado dentro das funções.

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapa texto para uso seguro em innerHTML (conteúdo e atributos). */
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

export const SENIORITY_LABELS = {
  estagio: 'Estágio',
  junior: 'Júnior',
  pleno: 'Pleno',
  senior: 'Sênior',
  especialista: 'Especialista',
};

export const WORK_MODEL_LABELS = {
  remoto: 'Remoto',
  hibrido: 'Híbrido',
  presencial: 'Presencial',
};

export const APPLICATION_STATUS_LABELS = {
  em_analise: 'Em análise',
  aprovado: 'Aprovado',
  nao_selecionado: 'Não selecionado',
};

export const JOB_STATUS_LABELS = {
  open: 'Aberta',
  closed: 'Encerrada',
};

/** Rótulo de um enum, com fallback para o próprio valor. */
export function label(map, value) {
  return (value && map[value]) || value || '';
}

const moneyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Formata número como R$ sem centavos (ex.: "R$ 5.000"). */
export function formatMoney(value) {
  const n = Number(value);
  if (value === null || value === undefined || value === '' || !Number.isFinite(n)) return '';
  return moneyFormatter.format(n);
}

/** Faixa salarial legível. */
export function formatSalaryRange(min, max) {
  const a = formatMoney(min);
  const b = formatMoney(max);
  if (a && b) return a === b ? a : `${a} – ${b}`;
  if (a) return `A partir de ${a}`;
  if (b) return `Até ${b}`;
  return 'A combinar';
}

/** Converte data do SQLite ('YYYY-MM-DD HH:MM:SS', UTC) ou ISO em Date. */
export function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  let s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s)) s = s.replace(' ', 'T') + 'Z';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Data no formato dd/mm/aaaa. */
export function formatDate(value) {
  const d = parseDate(value);
  if (!d) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Texto relativo curto ("hoje", "há 3 dias") com fallback para a data. */
export function formatRelative(value, now = new Date()) {
  const d = parseDate(value);
  if (!d) return '';
  const days = Math.floor((now - d) / 86400000);
  if (days <= 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 30) return `há ${days} dias`;
  return formatDate(d);
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** 'YYYY-MM' → 'out/2026'; outros formatos são devolvidos como estão. */
export function formatMonth(value) {
  if (!value) return '';
  const m = /^(\d{4})-(\d{2})/.exec(String(value));
  if (!m) return String(value);
  const idx = Number(m[2]) - 1;
  return idx >= 0 && idx < 12 ? `${MONTHS[idx]}/${m[1]}` : String(value);
}

/** Iniciais para avatares/logos. */
export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/** Gera <option>s a partir de um mapa {valor: rótulo} ou lista [{value,label}]. */
export function options(labels, selected, { placeholder } = {}) {
  const entries = Array.isArray(labels)
    ? labels.map((o) => [o.value, o.label])
    : Object.entries(labels || {});
  const sel = selected === null || selected === undefined ? '' : String(selected);
  let html = '';
  if (placeholder !== undefined) {
    html += `<option value=""${sel === '' ? ' selected' : ''}>${escapeHtml(placeholder)}</option>`;
  }
  for (const [value, text] of entries) {
    const v = String(value);
    html += `<option value="${escapeHtml(v)}"${v === sel ? ' selected' : ''}>${escapeHtml(text)}</option>`;
  }
  return html;
}

/** HTML de carregamento. */
export function loading(text = 'Carregando…') {
  return `<div class="loading" role="status"><span class="spinner" aria-hidden="true"></span><span>${escapeHtml(text)}</span></div>`;
}

/** HTML de estado vazio. `actionHtml` deve ser HTML já seguro. */
export function emptyState(text, { icon = '🔍', title = '', actionHtml = '' } = {}) {
  return `<div class="empty">
    <div class="empty-icon" aria-hidden="true">${escapeHtml(icon)}</div>
    ${title ? `<h3>${escapeHtml(title)}</h3>` : ''}
    <p>${escapeHtml(text)}</p>
    ${actionHtml}
  </div>`;
}

const TOAST_ICONS = { success: '✓', error: '!', info: 'i' };

/** Mostra um toast (success | error | info). Aceita string ou Error. */
export function toast(message, type = 'error') {
  if (typeof document === 'undefined') return;
  const text = message instanceof Error ? message.message : String(message ?? '');
  let host = document.getElementById('toasts');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toasts';
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML = `<span class="toast-icon" aria-hidden="true">${escapeHtml(TOAST_ICONS[type] || 'i')}</span><span>${escapeHtml(text)}</span>`;
  host.appendChild(el);
  const remove = () => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 200);
  };
  const timer = setTimeout(remove, type === 'error' ? 5000 : 3500);
  el.addEventListener('click', () => { clearTimeout(timer); remove(); });
}

/**
 * Executa asyncFn com o botão desabilitado. Erros vão para onError (toast por padrão;
 * passe null para relançar). Retorna o resultado de asyncFn (ou undefined em erro).
 */
export async function withButton(button, asyncFn, onError = toast) {
  if (button && button.disabled) return undefined;
  if (button) {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
  }
  try {
    return await asyncFn();
  } catch (err) {
    if (!onError) throw err;
    onError(err);
    return undefined;
  } finally {
    if (button) {
      button.removeAttribute('aria-busy');
      // data-done mantém o botão desabilitado (ex.: "✓ Candidatado").
      if (button.dataset.done === undefined) button.disabled = false;
    }
  }
}

/** Modal de confirmação. Resolve true (confirmar) ou false (cancelar/Esc/fundo). */
export function confirmModal({ title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', confirmClass = 'btn-primary' } = {}) {
  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 id="modal-title">${escapeHtml(title)}</h2>
        <p>${escapeHtml(message)}</p>
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" data-cancel>${escapeHtml(cancelText)}</button>
          <button type="button" class="btn ${escapeHtml(confirmClass)}" data-confirm>${escapeHtml(confirmText)}</button>
        </div>
      </div>`;

    const close = (result) => {
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('hashchange', onNav);
      backdrop.remove();
      if (previousFocus && typeof previousFocus.focus === 'function' && previousFocus.isConnected) previousFocus.focus();
      resolve(result);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(false); }
      if (e.key === 'Tab') {
        const focusables = backdrop.querySelectorAll('button');
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    const onNav = () => close(false);

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close(false);
      else if (e.target.closest('[data-cancel]')) close(false);
      else if (e.target.closest('[data-confirm]')) close(true);
    });
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('hashchange', onNav);
    document.body.appendChild(backdrop);
    backdrop.querySelector('[data-confirm]').focus();
  });
}

/** Debounce simples. */
export function debounce(fn, wait = 300) {
  let timer;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}
