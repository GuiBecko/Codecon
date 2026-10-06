// Estado de sessão compartilhado. Sem acesso ao DOM no import (testável em Node).

export const session = { user: null };

/** Hash inicial de acordo com o usuário logado. */
export function homeFor(user) {
  if (!user) return '#/login';
  return user.role === 'company' ? '#/empresa/vagas' : '#/vagas';
}

/** Navega para um hash; se já estamos nele, força nova renderização. */
export function go(hash) {
  if (location.hash === hash) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = hash;
  }
}
