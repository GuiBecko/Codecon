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

/**
 * Base dos modais: monta o diálogo, prende o foco e fecha com Esc/fundo.
 * `buttons`: [{ text, className, value }]; resolve com o `value` do botão (ou `dismissValue`).
 */
function openModal({ title, message, lines = [], buttons, dismissValue, closeOnNav = true }) {
  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal" role="${buttons.length > 1 ? 'dialog' : 'alertdialog'}" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-desc">
        <h2 id="modal-title">${escapeHtml(title)}</h2>
        <div id="modal-desc" class="modal-body">
          ${message ? `<p>${escapeHtml(message)}</p>` : ''}
          ${lines.length ? `<ul class="modal-list">${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>` : ''}
        </div>
        <div class="form-actions">
          ${buttons.map((b, i) => `<button type="button" class="btn ${escapeHtml(b.className || '')}" data-modal-btn="${i}">${escapeHtml(b.text)}</button>`).join('')}
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
      if (e.key === 'Escape') { e.preventDefault(); close(dismissValue); }
      if (e.key === 'Tab') {
        const focusables = backdrop.querySelectorAll('button');
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    const onNav = () => close(dismissValue);

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) { close(dismissValue); return; }
      const btn = e.target.closest('[data-modal-btn]');
      if (btn) close(buttons[Number(btn.dataset.modalBtn)].value);
    });
    document.addEventListener('keydown', onKey, true);
    if (closeOnNav) window.addEventListener('hashchange', onNav);
    document.body.appendChild(backdrop);
    const all = backdrop.querySelectorAll('[data-modal-btn]');
    all[all.length - 1].focus();
  });
}

/** Modal de confirmação. Resolve true (confirmar) ou false (cancelar/Esc/fundo). */
export function confirmModal({ title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', confirmClass = 'btn-primary' } = {}) {
  return openModal({
    title,
    message,
    dismissValue: false,
    buttons: [
      { text: cancelText, className: 'btn-ghost', value: false },
      { text: confirmText, className: confirmClass, value: true },
    ],
  });
}

/**
 * Modal informativo com um único botão OK. `lines` vira uma lista abaixo da mensagem.
 * Não fecha ao navegar (pode ser aberto logo após um go()).
 */
export function alertModal({ title, message = '', lines = [], okText = 'OK' } = {}) {
  return openModal({
    title,
    message,
    lines,
    dismissValue: undefined,
    closeOnNav: false,
    buttons: [{ text: okText, className: 'btn-primary', value: undefined }],
  });
}

/** Tamanho de arquivo legível ("820 KB", "1,2 MB"). */
export function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

function isBrazilCountry(country) {
  const c = String(country ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  return c === '' || c === 'brasil' || c === 'brazil';
}

/** Localização legível: "São Paulo - SP" (Brasil) ou "Lisboa, Portugal". */
export function formatLocation({ city, state, country } = {}) {
  const c = String(city || '').trim();
  const s = String(state || '').trim();
  if (isBrazilCountry(country)) {
    if (c && s) {
      const already = /^[a-z]{2}$/i.test(s) && new RegExp(`[-/,]\\s*${s}$`, 'i').test(c);
      return already ? c : `${c} - ${s}`;
    }
    return c || s;
  }
  return [c, s, String(country || '').trim()].filter(Boolean).join(', ');
}

/** O que falta para o perfil ser considerado completo (nome, senioridade, 1+ tecnologia). */
export function missingProfileFields(p = {}) {
  const missing = [];
  if (!String(p.fullName || '').trim()) missing.push('Nome completo');
  if (!p.seniority) missing.push('Senioridade');
  if (!Array.isArray(p.technologies) || !p.technologies.length) missing.push('Pelo menos uma tecnologia');
  return missing;
}

/** Slug ASCII para nomes de arquivo. */
export function slugify(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

/** Debounce simples. */
export function debounce(fn, wait = 300) {
  let timer;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}
