import { api } from '../api.js';
import { session } from '../session.js';
import {
  escapeHtml, label, initials, formatLocation, missingProfileFields, withButton, SENIORITY_LABELS,
} from '../ui.js';
import { resumeHtml, attachedPdfHtml } from '../components.js';
import { downloadResumePdf } from '../resume-pdf.js';

export async function render(view) {
  const profile = await api('/candidate/profile');
  if (!view.isConnected) return;
  const email = (session.user && session.user.email) || '';
  const missing = missingProfileFields(profile);
  const complete = profile.complete ?? missing.length === 0;
  const name = profile.fullName || (session.user && session.user.name) || '';
  const sub = [label(SENIORITY_LABELS, profile.seniority), formatLocation(profile)].filter(Boolean).join(' · ');

  view.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Meu perfil</h1>
        <p class="subtitle">É assim que as empresas veem seu currículo quando você se candidata.</p>
      </div>
      <div class="row">
        <a class="btn" href="#/curriculo">Editar currículo</a>
        <button type="button" class="btn btn-primary" data-gen-pdf>Gerar PDF do currículo</button>
      </div>
    </div>
    ${!complete ? `<div class="banner" role="status">
      <span aria-hidden="true">⚠️</span>
      <div><strong>Seu perfil está incompleto — complete-o para se candidatar.</strong>
      Falta: ${escapeHtml(missing.join(', ') || 'revisar os dados obrigatórios')}.
      <a href="#/curriculo">Completar agora →</a></div>
    </div>` : ''}
    <article class="card card-lg profile-card">
      <header class="profile-head">
        <div class="avatar avatar-xl" aria-hidden="true">${escapeHtml(initials(name || email))}</div>
        <div class="profile-id">
          <h2>${name ? escapeHtml(name) : '<span class="muted">Nome não informado</span>'}</h2>
          ${sub ? `<div class="muted">${escapeHtml(sub)}</div>` : ''}
        </div>
        ${complete
          ? '<span class="badge badge-aprovado">Perfil completo</span>'
          : '<span class="badge badge-em_analise">Perfil incompleto</span>'}
      </header>
      <div class="resume-section">
        <div class="section-title">Currículo em PDF</div>
        ${profile.resumePdf
          ? attachedPdfHtml(profile.resumePdf, { href: '/api/candidate/resume-pdf', downloadText: 'Baixar PDF original' })
          : '<p class="muted small">Nenhum PDF anexado. Você pode importar seu currículo em PDF em <a href="#/curriculo">Editar currículo</a>.</p>'}
      </div>
      ${resumeHtml({ ...profile, email })}
    </article>`;

  view.querySelector('[data-gen-pdf]').addEventListener('click', (e) => {
    withButton(e.currentTarget, () => downloadResumePdf(profile, email));
  });
}
