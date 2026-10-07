import { escapeHtml } from './ui.js';

/** Normaliza uma tag: minúsculas, trim e espaços colapsados. */
export function normalizeTag(value) {
  return String(value ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/** HTML do input de tags. Use mountTagInput(container) depois. */
export function tagInputHtml(placeholder = 'Digite e pressione Enter', { id = '' } = {}) {
  return `<div class="tag-input" data-tag-input>
    <div class="tags"></div>
    <input type="text" ${id ? `id="${escapeHtml(id)}"` : ''} placeholder="${escapeHtml(placeholder)}" autocomplete="off" enterkeyhint="done" aria-label="${escapeHtml(placeholder)}">
  </div>`;
}

/**
 * Ativa o input de tags.
 * @param root elemento .tag-input (ou um ancestral que o contenha)
 * @param initial lista inicial de tags
 * @returns {{ values: () => string[] }}
 */
export function mountTagInput(root, initial = []) {
  const box = root.matches && root.matches('[data-tag-input]') ? root : root.querySelector('[data-tag-input]');
  const tagsEl = box.querySelector('.tags');
  const input = box.querySelector('input');
  let tags = [];

  const render = () => {
    tagsEl.innerHTML = tags.map((t, i) => `<span class="chip">${escapeHtml(t)}<button type="button" class="tag-remove" data-tag-remove="${i}" aria-label="Remover ${escapeHtml(t)}">×</button></span>`).join('');
  };

  const add = (raw) => {
    let added = 0;
    for (const part of String(raw).split(',')) {
      const tag = normalizeTag(part);
      if (tag && !tags.includes(tag)) { tags.push(tag); added++; }
    }
    if (added) render();
    return added;
  };

  const commit = () => {
    if (input.value.trim()) add(input.value);
    input.value = '';
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && input.value === '' && tags.length) {
      tags.pop();
      render();
    }
  });
  // cobre colagem de "a, b, c" e teclados móveis que não emitem keydown de vírgula
  input.addEventListener('input', () => {
    if (input.value.includes(',')) commit();
  });
  input.addEventListener('blur', commit);

  box.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tag-remove]');
    if (btn) {
      e.stopPropagation();
      tags.splice(Number(btn.dataset.tagRemove), 1);
      render();
      input.focus();
      return;
    }
    if (e.target === box || e.target === tagsEl) input.focus();
  });

  add((initial || []).join(','));
  render();

  return {
    values() {
      commit();
      return [...tags];
    },
    /** Adiciona tags (lista ou string separada por vírgulas). Retorna quantas eram novas. */
    add(list) {
      return add(Array.isArray(list) ? list.join(',') : String(list ?? ''));
    },
  };
}
