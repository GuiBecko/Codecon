import { session, go } from './session.js';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Chama a API JSON em /api. Lança ApiError em falha. */
export async function api(path, { method = 'GET', body } = {}) {
  const init = { method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`/api${path}`, init);
  } catch {
    throw new ApiError(0, 'Sem conexão com o servidor');
  }

  let data = null;
  if (res.status !== 204) {
    const text = await res.text();
    if (text) {
      try { data = JSON.parse(text); } catch { data = null; }
    }
  }

  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) {
      session.user = null;
      go('#/login');
    }
    const message = (data && data.error) || defaultMessage(res.status);
    throw new ApiError(res.status, message);
  }
  return data;
}

function defaultMessage(status) {
  if (status === 401) return 'Sua sessão expirou. Entre novamente.';
  if (status === 403) return 'Você não tem permissão para isso.';
  if (status === 404) return 'Não encontrado.';
  if (status >= 500) return 'Erro no servidor. Tente novamente.';
  return 'Não foi possível concluir a operação.';
}

/** Monta query string ignorando valores vazios; arrays viram listas separadas por vírgula. */
export function qs(params = {}) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (value.length) sp.set(key, value.join(','));
      continue;
    }
    const str = String(value).trim();
    if (str === '') continue;
    sp.set(key, str);
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}
