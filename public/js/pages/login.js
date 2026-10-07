import { api } from '../api.js';
import { session, homeFor, go } from '../session.js';
import { escapeHtml, toast, withButton } from '../ui.js';

const HERO = {
  candidate: {
    title: 'Sua próxima vaga em tecnologia começa aqui.',
    lead: 'Monte seu currículo uma vez e candidate-se com um clique às melhores oportunidades.',
    bullets: [
      'Filtros por cargo, salário, senioridade e tecnologias',
      'Candidatura em um clique',
      'Acompanhe o status de cada processo',
    ],
  },
  company: {
    title: 'Encontre o talento certo, sem complicação.',
    lead: 'Publique vagas em minutos, avalie currículos completos e feche a contratação em um só lugar.',
    bullets: [
      'Publique vagas com faixa salarial e stack',
      'Currículos padronizados e fáceis de comparar',
      'Contrate e feche a vaga com um clique',
    ],
  },
};

export function render(view, { query }) {
  const state = {
    role: query.perfil === 'empresa' ? 'company' : 'candidate',
    mode: query.modo === 'cadastro' ? 'register' : 'login',
  };

  view.innerHTML = `<div class="auth">
    <section class="auth-hero" data-hero></section>
    <section class="auth-panel">
      <div class="auth-card">
        <div class="tabs tabs-block" role="tablist" aria-label="Tipo de conta">
          <button type="button" class="tab" role="tab" data-role="candidate">Sou candidato</button>
          <button type="button" class="tab" role="tab" data-role="company">Sou empresa</button>
        </div>
        <form class="card form" data-form novalidate>
          <div>
            <h2 data-form-title></h2>
            <p class="muted small" data-form-sub style="margin-top:4px"></p>
          </div>
          <div class="field" data-name-field>
            <label for="auth-name" data-name-label></label>
            <input class="input" id="auth-name" name="name" autocomplete="name" maxlength="120">
          </div>
          <div class="field">
            <label for="auth-email">E-mail</label>
            <input class="input" id="auth-email" name="email" type="email" autocomplete="email" required placeholder="voce@exemplo.com">
          </div>
          <div class="field">
            <label for="auth-password">Senha</label>
            <input class="input" id="auth-password" name="password" type="password" required minlength="6" placeholder="••••••">
            <span class="hint" data-pass-hint>Mínimo de 6 caracteres.</span>
          </div>
          <button type="submit" class="btn btn-primary btn-lg btn-block" data-submit></button>
          <p class="auth-switch"><span data-switch-text></span> <button type="button" class="link-btn" data-toggle-mode></button></p>
        </form>
        <a class="demo-link" href="/emails.html" target="_blank" rel="noopener">✉️ Caixa de e-mails (demo)</a>
      </div>
    </section>
  </div>`;

  const $ = (sel) => view.querySelector(sel);
  const form = $('[data-form]');

  function paint() {
    const hero = HERO[state.role];
    const heroEl = $('[data-hero]');
    heroEl.classList.toggle('company', state.role === 'company');
    heroEl.innerHTML = `
      <div class="brand"><span class="brand-mark" aria-hidden="true">C</span><span>Conecta<strong>Vagas</strong></span></div>
      <div>
        <h1>${escapeHtml(hero.title)}</h1>
        <p class="lead">${escapeHtml(hero.lead)}</p>
        <ul>${hero.bullets.map((b) => `<li><span class="check" aria-hidden="true">✓</span>${escapeHtml(b)}</li>`).join('')}</ul>
      </div>
      <div class="foot">© 2026 Conecta Vagas · Feito para o Codecon</div>`;

    view.querySelectorAll('[data-role]').forEach((t) => {
      const on = t.dataset.role === state.role;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
    });

    const isReg = state.mode === 'register';
    const isCompany = state.role === 'company';
    $('[data-form-title]').textContent = isReg ? 'Criar conta' : 'Entrar';
    $('[data-form-sub]').textContent = isReg
      ? (isCompany ? 'Cadastre sua empresa e publique vagas hoje.' : 'Crie sua conta e encontre sua próxima vaga.')
      : (isCompany ? 'Acesse o painel da sua empresa.' : 'Que bom ver você de novo!');
    $('[data-name-field]').hidden = !isReg;
    $('#auth-name').required = isReg;
    $('[data-name-label]').innerHTML = `${isCompany ? 'Nome da empresa' : 'Nome completo'}<span class="req">*</span>`;
    $('#auth-name').placeholder = isCompany ? 'Ex.: TechNova' : 'Ex.: Ana Souza';
    $('#auth-password').autocomplete = isReg ? 'new-password' : 'current-password';
    $('[data-pass-hint]').hidden = !isReg;
    $('[data-submit]').textContent = isReg ? 'Criar conta' : 'Entrar';
    $('[data-switch-text]').textContent = isReg ? 'Já tem conta?' : 'Ainda não tem conta?';
    $('[data-toggle-mode]').textContent = isReg ? 'Entrar' : 'Criar conta';
  }

  view.addEventListener('click', (e) => {
    const roleTab = e.target.closest('[data-role]');
    if (roleTab) { state.role = roleTab.dataset.role; paint(); return; }
    if (e.target.closest('[data-toggle-mode]')) {
      state.mode = state.mode === 'login' ? 'register' : 'login';
      paint();
      (state.mode === 'register' ? $('#auth-name') : $('#auth-email')).focus();
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = $('#auth-email').value.trim();
    const password = $('#auth-password').value;
    const name = $('#auth-name').value.trim();
    const isReg = state.mode === 'register';

    if (isReg && !name) return toast(state.role === 'company' ? 'Informe o nome da empresa.' : 'Informe seu nome completo.');
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return toast('Informe um e-mail válido.');
    if (!password) return toast('Informe sua senha.');
    if (isReg && password.length < 6) return toast('A senha deve ter pelo menos 6 caracteres.');

    withButton($('[data-submit]'), async () => {
      const user = isReg
        ? await api('/auth/register', { method: 'POST', body: { email, password, role: state.role, name } })
        : await api('/auth/login', { method: 'POST', body: { email, password } });
      session.user = user;
      toast(isReg ? `Conta criada! Bem-vindo(a), ${user.name || ''}`.trim() : `Olá, ${user.name || user.email}!`, 'success');
      if (isReg && user.role === 'candidate') go('#/curriculo');
      else go(homeFor(user));
    });
  });

  paint();
}
