import { api } from './api.js';
import { session, homeFor, go } from './session.js';
import { escapeHtml, emptyState, loading, initials, toast, withButton } from './ui.js';

const app = document.getElementById('app');
const topbar = document.getElementById('topbar');

/** role: null = só anônimo; 'candidate' | 'company' = exige o role. */
const routes = [
  { pattern: '/login', role: null, load: () => import('./pages/login.js') },
  { pattern: '/vagas', role: 'candidate', load: () => import('./pages/jobs.js') },
  { pattern: '/vagas/:id', role: 'candidate', load: () => import('./pages/job-detail.js') },
  { pattern: '/curriculo', role: 'candidate', load: () => import('./pages/resume.js') },
  { pattern: '/perfil', role: 'candidate', load: () => import('./pages/profile.js') },
  { pattern: '/minhas-candidaturas', role: 'candidate', load: () => import('./pages/my-applications.js') },
  { pattern: '/empresa/vagas', role: 'company', load: () => import('./pages/company-jobs.js') },
  { pattern: '/empresa/vagas/nova', role: 'company', load: () => import('./pages/job-new.js') },
  { pattern: '/empresa/vagas/:id', role: 'company', load: () => import('./pages/company-job-detail.js') },
].map((r) => ({
  ...r,
  regex: new RegExp('^' + r.pattern.replace(/:(\w+)/g, '(?<$1>\\d+)') + '/?$'),
}));

const NAV = {
  candidate: [
    { href: '#/vagas', label: 'Vagas' },
    { href: '#/minhas-candidaturas', label: 'Minhas candidaturas' },
    { href: '#/curriculo', label: 'Meu currículo' },
  ],
  company: [
    { href: '#/empresa/vagas', label: 'Minhas vagas' },
    { href: '#/empresa/vagas/nova', label: 'Nova vaga' },
  ],
};

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [pathPart, queryPart = ''] = raw.split('?');
  const path = pathPart || '/';
  const query = Object.fromEntries(new URLSearchParams(queryPart));
  return { path, query };
}

function match(path) {
  for (const route of routes) {
    const m = route.regex.exec(path);
    if (m) return { route, params: { ...(m.groups || {}) } };
  }
  return null;
}

/** Avatar + nome. Para candidatos é o atalho para "Meu perfil". */
function userChip(user, path) {
  const inner = `<span class="avatar" aria-hidden="true">${escapeHtml(initials(user.name || user.email))}</span>
        <span id="user-name">${escapeHtml(user.name || user.email || '')}</span>`;
  if (user.role !== 'candidate') {
    return `<span class="user-chip" title="${escapeHtml(user.email || '')}">${inner}</span>`;
  }
  const active = path === '/perfil';
  return `<a class="user-chip user-link${active ? ' active' : ''}" href="#/perfil" title="Meu perfil (${escapeHtml(user.email || '')})" aria-label="Meu perfil: ${escapeHtml(user.name || user.email || '')}"${active ? ' aria-current="page"' : ''}>${inner}</a>`;
}

function renderTopbar(path) {
  const user = session.user;
  document.body.classList.toggle('auth-mode', !user);
  if (!user) {
    topbar.hidden = true;
    topbar.innerHTML = '';
    return;
  }
  const links = NAV[user.role] || [];
  // link ativo = maior prefixo que casa com o path atual
  let active = null;
  for (const l of links) {
    const p = l.href.slice(1);
    if ((path === p || path.startsWith(p + '/')) && (!active || p.length > active.length)) active = p;
  }
  topbar.hidden = false;
  topbar.innerHTML = `<div class="topbar-inner">
    <a class="brand" href="${escapeHtml(homeFor(user))}"><span class="brand-mark" aria-hidden="true">C</span><span>Conecta<strong>Vagas</strong></span></a>
    <nav class="nav" aria-label="Principal">
      ${links.map((l) => `<a href="${escapeHtml(l.href)}"${l.href.slice(1) === active ? ' class="active" aria-current="page"' : ''}>${escapeHtml(l.label)}</a>`).join('')}
    </nav>
    <div class="user-box">
      ${userChip(user, path)}
      <button type="button" class="btn btn-ghost btn-sm" id="logout-btn">Sair</button>
    </div>
  </div>`;
  topbar.querySelector('#logout-btn').addEventListener('click', (e) => {
    withButton(e.currentTarget, async () => {
      try { await api('/auth/logout', { method: 'POST' }); } catch { /* sai mesmo assim */ }
      session.user = null;
      toast('Você saiu da sua conta.', 'info');
      go('#/login');
    });
  });
}

let navId = 0;

async function router() {
  const current = ++navId;
  const { path, query } = parseHash();
  const user = session.user;
  const found = match(path);

  // Guardas
  if (!found) return redirect(homeFor(user));
  const { route, params } = found;
  if (route.role === null && user) return redirect(homeFor(user));
  if (route.role && (!user || user.role !== route.role)) return redirect(homeFor(user));

  renderTopbar(path);

  // Container novo a cada navegação: renders assíncronos antigos escrevem em nós desanexados.
  const view = document.createElement('div');
  view.className = 'view';
  view.innerHTML = loading();
  app.replaceChildren(view);
  window.scrollTo(0, 0);

  try {
    const mod = await route.load();
    if (current !== navId) return;
    view.innerHTML = '';
    await mod.render(view, { params, query });
  } catch (err) {
    console.error(err);
    if (current !== navId) return;
    view.innerHTML = emptyState(err && err.message ? err.message : 'Algo deu errado.', {
      icon: '⚠️',
      title: 'Não foi possível carregar esta página',
      actionHtml: `<a class="btn btn-primary" href="${escapeHtml(homeFor(session.user))}">Voltar ao início</a>`,
    });
  }
}

function redirect(hash) {
  if (location.hash === hash) {
    // evita loop: já estamos no destino, então renderiza direto
    return router();
  }
  location.replace(hash);
  return undefined;
}

async function boot() {
  try {
    session.user = await api('/auth/me');
  } catch (err) {
    session.user = null;
    if (err.status === 0) toast(err.message, 'error');
  }
  window.addEventListener('hashchange', router);
  router();
}

boot();
