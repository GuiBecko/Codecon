import { api } from '../api.js';
import { session, go } from '../session.js';
import { escapeHtml, options, toast, withButton, SENIORITY_LABELS } from '../ui.js';
import { tagInputHtml, mountTagInput } from '../tag-input.js';

const MONTH_RE = /^\d{4}-\d{2}$/;

/** Input de mês; se o valor salvo não for AAAA-MM, cai para texto para não perder o dado. */
function monthInput(name, value, labelText) {
  const v = value || '';
  const type = !v || MONTH_RE.test(v) ? 'month' : 'text';
  return `<div class="field">
    <label>${escapeHtml(labelText)}
      <input class="input" type="${type}" name="${escapeHtml(name)}" value="${escapeHtml(v)}" placeholder="AAAA-MM" maxlength="120" style="margin-top:6px">
    </label>
  </div>`;
}

function expItem(e = {}, i = 0) {
  return `<div class="dyn-item" data-item>
    <div class="dyn-item-head">
      <span class="section-title">Experiência ${i + 1}</span>
      <button type="button" class="btn btn-danger-ghost btn-sm" data-remove>Remover</button>
    </div>
    <div class="grid-2">
      <div class="field"><label>Cargo<input class="input" name="cargo" value="${escapeHtml(e.cargo)}" placeholder="Ex.: Desenvolvedora Front-end" style="margin-top:6px" maxlength="120"></label></div>
      <div class="field"><label>Empresa<input class="input" name="empresa" value="${escapeHtml(e.empresa)}" placeholder="Ex.: TechNova" style="margin-top:6px" maxlength="120"></label></div>
      ${monthInput('inicio', e.inicio, 'Início')}
      ${monthInput('fim', e.fim, 'Fim (vazio = atual)')}
      <div class="field span-2"><label>Descrição<textarea class="textarea" name="descricao" rows="3" placeholder="Principais atividades e conquistas" maxlength="1000" style="margin-top:6px; min-height:80px">${escapeHtml(e.descricao)}</textarea></label></div>
    </div>
  </div>`;
}

function eduItem(e = {}, i = 0) {
  return `<div class="dyn-item" data-item>
    <div class="dyn-item-head">
      <span class="section-title">Formação ${i + 1}</span>
      <button type="button" class="btn btn-danger-ghost btn-sm" data-remove>Remover</button>
    </div>
    <div class="grid-2">
      <div class="field"><label>Curso<input class="input" name="curso" value="${escapeHtml(e.curso)}" placeholder="Ex.: Ciência da Computação" style="margin-top:6px" maxlength="120"></label></div>
      <div class="field"><label>Instituição<input class="input" name="instituicao" value="${escapeHtml(e.instituicao)}" placeholder="Ex.: USP" style="margin-top:6px" maxlength="120"></label></div>
      ${monthInput('conclusao', e.conclusao, 'Conclusão (ou previsão)')}
    </div>
  </div>`;
}

const LISTS = {
  experiences: { item: expItem, fields: ['empresa', 'cargo', 'inicio', 'fim', 'descricao'], empty: 'Nenhuma experiência adicionada.' },
  education: { item: eduItem, fields: ['instituicao', 'curso', 'conclusao'], empty: 'Nenhuma formação adicionada.' },
};

export async function render(view, { query }) {
  const profile = await api('/candidate/profile');
  if (!view.isConnected) return;
  const fromIncomplete = Boolean(query.incompleto);

  view.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Meu currículo</h1>
        <p class="subtitle">É isso que as empresas veem quando você se candidata.</p>
      </div>
      ${profile.complete
        ? '<span class="badge badge-aprovado">Perfil completo</span>'
        : '<span class="badge badge-em_analise">Perfil incompleto</span>'}
    </div>
    ${fromIncomplete && !profile.complete ? `<div class="banner" role="alert">
      <span aria-hidden="true">⚠️</span>
      <div><strong>Complete seu currículo para se candidatar.</strong>
      Preencha nome completo, senioridade e pelo menos uma tecnologia, depois salve.</div>
    </div>` : ''}
    <form class="form" data-form novalidate>
      <section class="card card-lg form-section">
        <h2>Dados pessoais</h2>
        <div class="grid-2">
          <div class="field span-2">
            <label for="r-name">Nome completo<span class="req">*</span></label>
            <input class="input" id="r-name" name="fullName" value="${escapeHtml(profile.fullName)}" autocomplete="name" maxlength="120" required>
          </div>
          <div class="field">
            <label for="r-phone">Telefone</label>
            <input class="input" id="r-phone" name="phone" type="tel" value="${escapeHtml(profile.phone)}" placeholder="(11) 90000-0000" autocomplete="tel" maxlength="30">
          </div>
          <div class="field">
            <label for="r-city">Cidade</label>
            <input class="input" id="r-city" name="city" value="${escapeHtml(profile.city)}" placeholder="Ex.: São Paulo - SP" maxlength="80">
          </div>
          <div class="field span-2">
            <label for="r-linkedin">LinkedIn</label>
            <input class="input" id="r-linkedin" name="linkedin" type="url" value="${escapeHtml(profile.linkedin)}" placeholder="https://linkedin.com/in/seu-perfil" maxlength="200">
          </div>
        </div>
      </section>

      <section class="card card-lg form-section">
        <h2>Perfil profissional</h2>
        <div class="grid-2">
          <div class="field">
            <label for="r-seniority">Senioridade<span class="req">*</span></label>
            <select class="select" id="r-seniority" name="seniority" required>${options(SENIORITY_LABELS, profile.seniority, { placeholder: 'Selecione…' })}</select>
          </div>
          <div class="field span-2">
            <label for="r-tech">Tecnologias<span class="req">*</span></label>
            ${tagInputHtml('Ex.: javascript, react, node — Enter para adicionar', { id: 'r-tech' })}
            <span class="hint">Pressione Enter ou vírgula para adicionar cada tecnologia.</span>
          </div>
          <div class="field span-2">
            <label for="r-summary">Resumo</label>
            <textarea class="textarea" id="r-summary" name="summary" rows="4" placeholder="Conte em poucas linhas sua trajetória e o que você busca." maxlength="2000">${escapeHtml(profile.summary)}</textarea>
          </div>
        </div>
      </section>

      <section class="card card-lg form-section">
        <div class="form-section-head">
          <h2>Experiências</h2>
          <button type="button" class="btn btn-sm" data-add="experiences">+ Adicionar experiência</button>
        </div>
        <div class="dyn-list" data-list="experiences"></div>
      </section>

      <section class="card card-lg form-section">
        <div class="form-section-head">
          <h2>Formação</h2>
          <button type="button" class="btn btn-sm" data-add="education">+ Adicionar formação</button>
        </div>
        <div class="dyn-list" data-list="education"></div>
      </section>

      <div class="form-actions form-actions-sticky">
        <span class="hint" style="margin-right:auto; align-self:center"><span class="req">*</span> Obrigatórios para se candidatar</span>
        <button type="submit" class="btn btn-primary btn-lg" data-submit>Salvar currículo</button>
      </div>
    </form>`;

  const $ = (sel) => view.querySelector(sel);
  const form = $('[data-form]');
  const tech = mountTagInput($('[data-tag-input]'), profile.technologies || []);

  // ----- listas dinâmicas -----
  function readList(key) {
    const { fields } = LISTS[key];
    return [...view.querySelectorAll(`[data-list="${key}"] [data-item]`)].map((item) => {
      const obj = {};
      for (const f of fields) obj[f] = (item.querySelector(`[name="${f}"]`)?.value || '').trim();
      return obj;
    });
  }

  function paintList(key, items) {
    const { item, empty } = LISTS[key];
    $(`[data-list="${key}"]`).innerHTML = items.length
      ? items.map((it, i) => item(it, i)).join('')
      : `<p class="muted small">${escapeHtml(empty)}</p>`;
  }

  paintList('experiences', Array.isArray(profile.experiences) ? profile.experiences : []);
  paintList('education', Array.isArray(profile.education) ? profile.education : []);

  view.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) {
      const key = add.dataset.add;
      const items = readList(key);
      items.push({});
      paintList(key, items);
      const all = view.querySelectorAll(`[data-list="${key}"] [data-item]`);
      all[all.length - 1]?.querySelector('input')?.focus();
      return;
    }
    const remove = e.target.closest('[data-remove]');
    if (remove) {
      const list = remove.closest('[data-list]');
      const key = list.dataset.list;
      const idx = [...list.querySelectorAll('[data-item]')].indexOf(remove.closest('[data-item]'));
      const items = readList(key);
      items.splice(idx, 1);
      paintList(key, items);
    }
  });

  // ----- salvar -----
  const isFilled = (obj) => Object.values(obj).some(Boolean);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const body = {
      fullName: $('#r-name').value.trim(),
      phone: $('#r-phone').value.trim(),
      city: $('#r-city').value.trim(),
      linkedin: $('#r-linkedin').value.trim(),
      seniority: $('#r-seniority').value || null,
      technologies: tech.values(),
      summary: $('#r-summary').value.trim(),
      experiences: readList('experiences').filter(isFilled),
      education: readList('education').filter(isFilled),
    };
    if (!body.fullName) {
      toast('Informe seu nome completo.');
      $('#r-name').focus();
      return;
    }

    withButton($('[data-submit]'), async () => {
      const saved = await api('/candidate/profile', { method: 'PUT', body });
      if (session.user && saved.fullName) {
        session.user.name = saved.fullName;
        const nameEl = document.getElementById('user-name');
        if (nameEl) nameEl.textContent = saved.fullName;
      }
      if (saved.complete) {
        toast('Currículo salvo!', 'success');
        if (fromIncomplete) {
          go('#/vagas');
          return;
        }
      } else {
        toast('Currículo salvo. Preencha senioridade e tecnologias para poder se candidatar.', 'info');
      }
      // Atualiza o selo de completo/incompleto sem recarregar o formulário.
      const badge = view.querySelector('.page-header .badge');
      if (badge) {
        badge.className = `badge ${saved.complete ? 'badge-aprovado' : 'badge-em_analise'}`;
        badge.textContent = saved.complete ? 'Perfil completo' : 'Perfil incompleto';
      }
      if (saved.complete) view.querySelector('.banner')?.remove();
    });
  });
}
