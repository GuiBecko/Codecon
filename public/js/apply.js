import { api } from './api.js';
import { toast, withButton } from './ui.js';
import { go } from './session.js';

/**
 * Candidata-se à vaga. Retorna true se o candidato ficou candidatado
 * (sucesso ou 409 "já candidatado"), false caso contrário.
 */
export async function applyToJob(id) {
  try {
    await api(`/jobs/${encodeURIComponent(id)}/apply`, { method: 'POST' });
    toast('Candidatura enviada! Boa sorte 🍀', 'success');
    return true;
  } catch (err) {
    if (err.status === 409) {
      toast('Você já se candidatou a esta vaga.', 'info');
      return true;
    }
    if (err.status === 422) {
      toast(err.message || 'Complete seu currículo para se candidatar.', 'error');
      go('#/curriculo?incompleto=1');
      return false;
    }
    if (err.status !== 401) toast(err.message || 'Não foi possível enviar a candidatura.', 'error');
    return false;
  }
}

/** Marca o botão como "✓ Candidatado". */
export function markApplied(button) {
  button.dataset.done = '';
  button.disabled = true;
  button.removeAttribute('data-apply');
  button.className = button.className.replace(/\bbtn-primary\b/, 'btn-applied');
  button.textContent = '✓ Candidatado';
}

/** Delegação de eventos para todos os [data-apply] dentro de root. */
export function bindApplyButtons(root, { onApplied } = {}) {
  root.addEventListener('click', async (e) => {
    const button = e.target.closest('[data-apply]');
    if (!button || !root.contains(button)) return;
    e.preventDefault();
    const id = button.getAttribute('data-apply');
    const ok = await withButton(button, () => applyToJob(id));
    if (ok) {
      markApplied(button);
      if (onApplied) onApplied(id);
    }
  });
}
