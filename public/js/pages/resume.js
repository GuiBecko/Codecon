import { api, upload, ApiError } from '../api.js';
import { session, go } from '../session.js';
import {
  escapeHtml, options, toast, withButton, confirmModal, alertModal, loading, missingProfileFields,
  SENIORITY_LABELS,
} from '../ui.js';
import { tagInputHtml, mountTagInput } from '../tag-input.js';
import { attachedPdfHtml, ICONS } from '../components.js';
import {
  UFS, DEFAULT_COUNTRY, isBrazil, formatBrPhone, validatePhone, normalizeLinkedin, normalizeUf,
} from '../validators.js';
import { parseResumeText } from '../resume-parser.js';
import { extractPdfText } from '../pdf-text.js';
import { downloadResumePdf } from '../resume-pdf.js';

const MONTH_RE = /^\d{4}-\d{2}$/;
const MAX_PDF_BYTES = 5 * 1024 * 1024;
const PDF_URL = '/api/candidate/resume-pdf';
const COUNTRIES = ['Brasil', 'Portugal', 'Argentina', 'Chile', 'Uruguai', 'Paraguai', 'Colômbia', 'México',
  'Estados Unidos', 'Canadá', 'Reino Unido', 'Irlanda', 'Espanha', 'Alemanha', 'França', 'Itália', 'Holanda'];
const SITUACAO_LABELS = { concluido: 'Concluído', em_andamento: 'Em andamento' };

/** Input de mês; se o valor salvo não for AAAA-MM, cai para texto para não perder o dado. */
function monthInput(name, value, labelText, { disabled = false } = {}) {
  const v = value || '';
  const type = !v || MONTH_RE.test(v) ? 'month' : 'text';
  return `<div class="field">
    <label><span data-label>${escapeHtml(labelText)}</span>
      <input class="input" type="${type}" name="${escapeHtml(name)}" value="${escapeHtml(v)}" placeholder="AAAA-MM" maxlength="120" style="margin-top:6px"${disabled ? ' disabled' : ''}>
    </label>
  </div>`;
}

/** Emprego atual: campo explícito; no legado, fim vazio com início preenchido significava "atual". */
function isCurrentJob(e) {
  return e.atual === true || (e.atual === undefined && !e.fim && Boolean(e.inicio));
}

function expItem(e = {}, i = 0) {
  const current = isCurrentJob(e);
  return `<div class="dyn-item" data-item>
    <div class="dyn-item-head">
      <span class="section-title">Experiência ${i + 1}</span>
      <button type="button" class="btn btn-danger-ghost btn-sm" data-remove>Remover</button>
    </div>
    <div class="grid-2">
      <div class="field"><label>Cargo<input class="input" name="cargo" value="${escapeHtml(e.cargo)}" placeholder="Ex.: Desenvolvedora Front-end" style="margin-top:6px" maxlength="120"></label></div>
      <div class="field"><label>Empresa<input class="input" name="empresa" value="${escapeHtml(e.empresa)}" placeholder="Ex.: TechNova" style="margin-top:6px" maxlength="120"></label></div>
      ${monthInput('inicio', e.inicio, 'Início')}
      ${monthInput('fim', current ? '' : e.fim, 'Fim', { disabled: current })}
      <div class="field span-2">
        <label class="check"><input type="checkbox" name="atual"${current ? ' checked' : ''}> Trabalho aqui atualmente</label>
      </div>
      <div class="field span-2"><label>Descrição<textarea class="textarea" name="descricao" rows="3" placeholder="Principais atividades e conquistas" maxlength="1000" style="margin-top:6px; min-height:80px">${escapeHtml(e.descricao)}</textarea></label></div>
    </div>
  </div>`;
}

function conclusaoLabel(situacao) {
  return situacao === 'em_andamento' ? 'Previsão de conclusão' : 'Conclusão';
}

function eduItem(e = {}, i = 0) {
  const situacao = e.situacao === 'em_andamento' ? 'em_andamento' : 'concluido';
  return `<div class="dyn-item" data-item>
    <div class="dyn-item-head">
      <span class="section-title">Formação ${i + 1}</span>
      <button type="button" class="btn btn-danger-ghost btn-sm" data-remove>Remover</button>
    </div>
    <div class="grid-2">
      <div class="field"><label>Curso<input class="input" name="curso" value="${escapeHtml(e.curso)}" placeholder="Ex.: Ciência da Computação" style="margin-top:6px" maxlength="120"></label></div>
      <div class="field"><label>Instituição<input class="input" name="instituicao" value="${escapeHtml(e.instituicao)}" placeholder="Ex.: USP" style="margin-top:6px" maxlength="120"></label></div>
      <div class="field"><label>Situação<select class="select" name="situacao" style="margin-top:6px">${options(SITUACAO_LABELS, situacao)}</select></label></div>
      ${monthInput('conclusao', e.conclusao, conclusaoLabel(situacao))}
    </div>
  </div>`;
}

const LISTS = {
  experiences: {
    item: expItem,
    text: ['empresa', 'cargo', 'inicio', 'fim', 'descricao'],
    extra: ['atual'],
    empty: 'Nenhuma experiência adicionada.',
  },
  education: {
    item: eduItem,
    text: ['instituicao', 'curso', 'conclusao'],
    extra: ['situacao'],
    empty: 'Nenhuma formação adicionada.',
  },
};

function stateControl(brazil, value) {
  if (brazil) {
    const uf = normalizeUf(value);
    return `<select class="select" id="r-state" name="state">${options(UFS.map((u) => ({ value: u, label: u })), uf, { placeholder: 'Selecione…' })}</select>`;
  }
  return `<input class="input" id="r-state" name="state" value="${escapeHtml(value)}" placeholder="Estado / província" maxlength="80">`;
}

/** Perfis antigos guardavam "São Paulo - SP" em city: separa quando não há estado. */
function splitLegacyCity(profile) {
  const city = profile.city || '';
  if (profile.state || !isBrazil(profile.country)) return { city, state: profile.state || '' };
  const m = /^(.+?)\s*[-/,]\s*([A-Za-z]{2})$/.exec(city.trim());
  if (m && normalizeUf(m[2])) return { city: m[1].trim(), state: normalizeUf(m[2]) };
  return { city, state: '' };
}

/** Mensagem de erro do backend → seletor do campo. */
const ERROR_FIELDS = [
  [/telefone/i, '#r-phone'],
  [/linkedin/i, '#r-linkedin'],
  [/estado|\buf\b/i, '#r-state'],
  [/pa[ií]s/i, '#r-country'],
  [/cidade/i, '#r-city'],
  [/nome/i, '#r-name'],
  [/senioridade/i, '#r-seniority'],
  [/tecnologia/i, '[data-tag-input]'],
  [/resumo/i, '#r-summary'],
];

export async function render(view, { query }) {
  const profile = await api('/candidate/profile');
  if (!view.isConnected) return;
  const fromIncomplete = Boolean(query.incompleto);
  const country = profile.country || DEFAULT_COUNTRY;
  const loc = splitLegacyCity({ ...profile, country });
  let brazil = isBrazil(country);

  view.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Meu currículo</h1>
        <p class="subtitle">É isso que as empresas veem quando você se candidata.</p>
      </div>
      <div class="row">
        ${profile.complete
          ? '<span class="badge badge-aprovado">Perfil completo</span>'
          : '<span class="badge badge-em_analise">Perfil incompleto</span>'}
        <a class="btn btn-sm btn-ghost" href="#/perfil">Ver meu perfil</a>
      </div>
    </div>
    ${fromIncomplete && !profile.complete ? `<div class="banner" role="alert">
      <span aria-hidden="true">⚠️</span>
      <div><strong>Complete seu currículo para se candidatar.</strong>
      Preencha nome completo, senioridade e pelo menos uma tecnologia, depois salve.</div>
    </div>` : ''}

    <section class="card card-lg form-section" data-import>
      <div>
        <h2>Importar currículo em PDF</h2>
        <p class="muted small" style="margin-top:4px">Lemos o seu PDF e preenchemos os campos que ainda estão vazios — revise antes de salvar. O arquivo fica anexado ao seu perfil.</p>
      </div>
      <label class="dropzone" data-dropzone>
        <input type="file" accept="application/pdf,.pdf" class="sr-only" data-file>
        <span class="dropzone-icon">${ICONS.upload}</span>
        <span><strong>Arraste seu PDF aqui</strong> ou <span class="dropzone-link">clique para selecionar</span></span>
        <span class="hint">Apenas PDF, até 5 MB.</span>
      </label>
      <div data-import-status hidden></div>
      <div data-attached>${attachedPdfHtml(profile.resumePdf, { href: PDF_URL, removable: true })}</div>
    </section>

    <form class="form" data-form novalidate>
      <section class="card card-lg form-section">
        <h2>Dados pessoais</h2>
        <div class="grid-2">
          <div class="field span-2">
            <label for="r-name">Nome completo<span class="req">*</span></label>
            <input class="input" id="r-name" name="fullName" value="${escapeHtml(profile.fullName)}" autocomplete="name" maxlength="120" required>
          </div>
          <div class="field">
            <label for="r-country">País</label>
            <input class="input" id="r-country" name="country" value="${escapeHtml(country)}" list="r-countries" autocomplete="country-name" maxlength="60">
            <datalist id="r-countries">${COUNTRIES.map((c) => `<option value="${escapeHtml(c)}"></option>`).join('')}</datalist>
          </div>
          <div class="field">
            <label for="r-state">Estado</label>
            <div data-state-slot>${stateControl(brazil, loc.state)}</div>
          </div>
          <div class="field">
            <label for="r-city">Cidade</label>
            <input class="input" id="r-city" name="city" value="${escapeHtml(loc.city)}" placeholder="Ex.: São Paulo" autocomplete="address-level2" maxlength="80">
          </div>
          <div class="field">
            <label for="r-phone">Telefone</label>
            <input class="input" id="r-phone" name="phone" type="tel" inputmode="tel" value="${escapeHtml(brazil && profile.phone ? formatBrPhone(profile.phone) || profile.phone : profile.phone)}" placeholder="${brazil ? '(11) 98888-1111' : '+1 555 123 4567'}" autocomplete="tel" maxlength="30">
          </div>
          <div class="field span-2">
            <label for="r-linkedin">LinkedIn</label>
            <input class="input" id="r-linkedin" name="linkedin" inputmode="url" value="${escapeHtml(profile.linkedin)}" placeholder="linkedin.com/in/seu-perfil" autocomplete="url" maxlength="200">
            <span class="hint">Cole o link do perfil ou só o seu usuário — a gente completa o endereço.</span>
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
        <button type="button" class="btn btn-lg" data-gen-pdf>Gerar PDF do currículo</button>
        <button type="submit" class="btn btn-primary btn-lg" data-submit>Salvar currículo</button>
      </div>
    </form>`;

  const $ = (sel) => view.querySelector(sel);
  const form = $('[data-form]');
  const tech = mountTagInput($('[data-tag-input]'), profile.technologies || []);
  const countryEl = $('#r-country');
  const phoneEl = $('#r-phone');
  const linkedinEl = $('#r-linkedin');

  // ----- erros inline -----
  let errorSeq = 0;
  function setError(el, message) {
    if (!el) return;
    const field = el.closest('.field') || el.parentElement;
    el.classList.add('invalid');
    el.setAttribute('aria-invalid', 'true');
    let msg = field.querySelector(':scope > .field-error');
    if (!msg) {
      msg = document.createElement('span');
      msg.className = 'field-error';
      msg.id = `err-${++errorSeq}`;
      field.appendChild(msg);
    }
    msg.textContent = message;
    el.setAttribute('aria-describedby', msg.id);
  }
  function clearError(el) {
    if (!el || !el.classList.contains('invalid')) return;
    el.classList.remove('invalid');
    el.removeAttribute('aria-invalid');
    el.removeAttribute('aria-describedby');
    const field = el.closest('.field') || el.parentElement;
    field.querySelector(':scope > .field-error')?.remove();
  }
  function clearAllErrors() {
    view.querySelectorAll('.invalid').forEach(clearError);
  }

  // ----- listas dinâmicas -----
  function readList(key) {
    const { text, extra } = LISTS[key];
    return [...view.querySelectorAll(`[data-list="${key}"] [data-item]`)].map((item) => {
      const obj = {};
      for (const f of [...text, ...extra]) {
        const el = item.querySelector(`[name="${f}"]`);
        if (!el) continue;
        obj[f] = el.type === 'checkbox' ? el.checked : (el.value || '').trim();
      }
      if (obj.atual) obj.fim = '';
      return obj;
    });
  }

  const isFilled = (key, obj) => LISTS[key].text.some((f) => Boolean(obj[f]));

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
      items.push(key === 'experiences' ? { atual: false } : {});
      paintList(key, items);
      const all = view.querySelectorAll(`[data-list="${key}"] [data-item]`);
      all[all.length - 1]?.querySelector('input')?.focus();
      return;
    }
    const remove = e.target.closest('[data-remove]');
    const list = remove && remove.closest('[data-list]');
    if (list) {
      const key = list.dataset.list;
      const idx = [...list.querySelectorAll('[data-item]')].indexOf(remove.closest('[data-item]'));
      const items = readList(key);
      items.splice(idx, 1);
      paintList(key, items);
      return;
    }
    if (e.target.closest('[data-pdf-remove]')) removePdf(e.target.closest('[data-pdf-remove]'));
  });

  view.addEventListener('change', (e) => {
    const t = e.target;
    const item = t.closest('[data-item]');
    if (item && t.name === 'atual') {
      const fim = item.querySelector('[name="fim"]');
      fim.disabled = t.checked;
      if (t.checked) { fim.value = ''; clearError(fim); }
    }
    if (item && t.name === 'situacao') {
      const lbl = item.querySelector('[name="conclusao"]')?.closest('label')?.querySelector('[data-label]');
      if (lbl) lbl.textContent = conclusaoLabel(t.value);
    }
  });

  // limpa o erro de um campo assim que o usuário mexe nele
  view.addEventListener('input', (e) => {
    clearError(e.target);
    const tagBox = e.target.closest('[data-tag-input]');
    if (tagBox) clearError(tagBox);
  });

  // ----- país / estado / telefone / LinkedIn -----
  function maskPhone() {
    const input = phoneEl;
    const pos = input.selectionStart ?? input.value.length;
    const digitsBefore = input.value.slice(0, pos).replace(/\D/g, '').length;
    const formatted = formatBrPhone(input.value);
    if (formatted === input.value) return;
    input.value = formatted;
    let p = 0;
    let seen = 0;
    while (p < formatted.length && seen < digitsBefore) {
      if (/\d/.test(formatted[p])) seen++;
      p++;
    }
    if (document.activeElement === input) input.setSelectionRange(p, p);
  }

  phoneEl.addEventListener('input', () => { if (brazil) maskPhone(); });

  countryEl.addEventListener('input', () => {
    const nowBrazil = isBrazil(countryEl.value);
    if (nowBrazil === brazil) return;
    brazil = nowBrazil;
    const current = $('#r-state').value;
    $('[data-state-slot]').innerHTML = stateControl(brazil, current);
    phoneEl.placeholder = brazil ? '(11) 98888-1111' : '+1 555 123 4567';
    if (brazil && phoneEl.value) phoneEl.value = formatBrPhone(phoneEl.value) || phoneEl.value;
    clearError(phoneEl);
  });

  linkedinEl.addEventListener('blur', () => {
    const v = normalizeLinkedin(linkedinEl.value);
    if (v === null) setError(linkedinEl, 'Informe um perfil do LinkedIn válido, ex.: linkedin.com/in/seu-perfil');
    else { linkedinEl.value = v; clearError(linkedinEl); }
  });

  // ----- coleta / validação -----
  function collect() {
    const linkedin = normalizeLinkedin(linkedinEl.value);
    return {
      fullName: $('#r-name').value.trim(),
      phone: phoneEl.value.trim(),
      country: countryEl.value.trim() || DEFAULT_COUNTRY,
      state: brazil ? normalizeUf($('#r-state').value) : $('#r-state').value.trim(),
      city: $('#r-city').value.trim(),
      linkedin: linkedin === null ? linkedinEl.value.trim() : linkedin,
      seniority: $('#r-seniority').value || null,
      technologies: tech.values(),
      summary: $('#r-summary').value.trim(),
      experiences: readList('experiences').filter((x) => isFilled('experiences', x)),
      education: readList('education').filter((x) => isFilled('education', x)),
    };
  }

  /** Valida no cliente; marca os campos e devolve o primeiro inválido (ou null). */
  function validate(body) {
    const errors = [];
    if (!body.fullName) errors.push([$('#r-name'), 'Informe seu nome completo.']);
    const phoneErr = validatePhone(body.phone, body.country);
    if (phoneErr) errors.push([phoneEl, phoneErr]);
    if (normalizeLinkedin(linkedinEl.value) === null) {
      errors.push([linkedinEl, 'Informe um perfil do LinkedIn válido, ex.: linkedin.com/in/seu-perfil']);
    }
    if (brazil && $('#r-state').value && !normalizeUf($('#r-state').value)) errors.push([$('#r-state'), 'Selecione uma UF válida.']);

    for (const item of view.querySelectorAll('[data-list] [data-item]')) {
      for (const name of ['inicio', 'fim', 'conclusao']) {
        const el = item.querySelector(`[name="${name}"]`);
        if (el && !el.disabled && el.value.trim() && !MONTH_RE.test(el.value.trim())) {
          errors.push([el, 'Use o formato AAAA-MM (ex.: 2022-03).']);
        }
      }
      const ini = item.querySelector('[name="inicio"]');
      const fim = item.querySelector('[name="fim"]');
      if (ini && fim && !fim.disabled && MONTH_RE.test(ini.value) && MONTH_RE.test(fim.value) && fim.value < ini.value) {
        errors.push([fim, 'O fim deve ser depois do início.']);
      }
    }
    for (const [el, msg] of errors) setError(el, msg);
    return errors.length ? errors[0][0] : null;
  }

  // ----- salvar -----
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearAllErrors();
    const body = collect();
    const firstInvalid = validate(body);
    if (firstInvalid) {
      toast('Corrija os campos destacados antes de salvar.');
      firstInvalid.focus();
      return;
    }
    if (body.linkedin) linkedinEl.value = body.linkedin;

    withButton($('[data-submit]'), async () => {
      let saved;
      try {
        saved = await api('/candidate/profile', { method: 'PUT', body });
      } catch (err) {
        if (err instanceof ApiError && err.status === 400) {
          const hit = ERROR_FIELDS.find(([re]) => re.test(err.message));
          const el = hit && $(hit[1]);
          if (el) { setError(el, err.message); el.focus(); }
        }
        throw err;
      }
      if (session.user && saved.fullName) {
        session.user.name = saved.fullName;
        const nameEl = document.getElementById('user-name');
        if (nameEl) nameEl.textContent = saved.fullName;
      }
      const missing = missingProfileFields(saved);
      const complete = saved.complete ?? missing.length === 0;
      go(fromIncomplete && complete ? '#/vagas' : '#/perfil');
      if (complete) {
        alertModal({
          title: 'Currículo salvo com sucesso!',
          message: fromIncomplete
            ? 'Seu perfil está completo. Agora você já pode se candidatar às vagas.'
            : 'Seu perfil está completo e pronto para as candidaturas.',
        });
      } else {
        alertModal({
          title: 'Currículo salvo com sucesso!',
          message: 'Seu perfil ainda está incompleto. Para se candidatar, preencha:',
          lines: missing.length ? missing : ['Os campos obrigatórios do currículo'],
        });
      }
    });
  });

  // ----- gerar PDF com os valores atuais do formulário -----
  $('[data-gen-pdf]').addEventListener('click', (e) => {
    const body = collect();
    withButton(e.currentTarget, () => downloadResumePdf(body, session.user && session.user.email));
  });

  // ----- importar PDF -----
  const dropzone = $('[data-dropzone]');
  const fileInput = $('[data-file]');
  const statusEl = $('[data-import-status]');
  let busy = false;

  function setBusy(text) {
    busy = Boolean(text);
    dropzone.classList.toggle('busy', busy);
    dropzone.setAttribute('aria-busy', String(busy));
    fileInput.disabled = busy;
    statusEl.hidden = !busy;
    statusEl.innerHTML = busy ? loading(text) : '';
  }

  function paintAttached(pdf) {
    $('[data-attached]').innerHTML = attachedPdfHtml(pdf, { href: PDF_URL, removable: true });
  }

  /** Preenche só o que está vazio. Retorna os elementos preenchidos. */
  function applyParsed(parsed) {
    const filled = [];
    const fill = (el, value) => {
      if (el && value && !String(el.value || '').trim()) {
        el.value = value;
        if (el.value) filled.push(el);
      }
    };
    fill($('#r-name'), parsed.fullName);
    if (parsed.phone) fill(phoneEl, brazil ? formatBrPhone(parsed.phone) : parsed.phone);
    fill($('#r-city'), parsed.city);
    if (parsed.state && brazil) fill($('#r-state'), parsed.state);
    fill(linkedinEl, parsed.linkedin);
    fill($('#r-seniority'), parsed.seniority);
    fill($('#r-summary'), parsed.summary);
    if (parsed.technologies && parsed.technologies.length && tech.add(parsed.technologies)) filled.push($('[data-tag-input]'));
    for (const key of ['experiences', 'education']) {
      if (parsed[key] && parsed[key].length && !readList(key).some((x) => isFilled(key, x))) {
        paintList(key, parsed[key]);
        filled.push($(`[data-list="${key}"]`));
      }
    }
    for (const el of filled) {
      clearError(el);
      el.classList.remove('autofilled');
      void el.offsetWidth; // reinicia a animação
      el.classList.add('autofilled');
    }
    setTimeout(() => filled.forEach((el) => el.classList.remove('autofilled')), 2600);
    return filled;
  }

  async function handleFile(file) {
    if (!file || busy) return;
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
    if (!isPdf) { toast('Selecione um arquivo PDF.'); return; }
    if (file.size > MAX_PDF_BYTES) { toast('O PDF deve ter no máximo 5 MB.'); return; }
    if (!file.size) { toast('O arquivo está vazio.'); return; }

    setBusy('Lendo o PDF…');
    const formData = new FormData();
    formData.append('file', file, file.name || 'curriculo.pdf');
    const uploading = upload('/candidate/resume-pdf', formData).then(
      (p) => ({ ok: true, pdf: p && p.resumePdf }),
      (err) => ({ ok: false, err }),
    );

    let text = '';
    try {
      text = await extractPdfText(file);
    } catch (err) {
      console.warn('Falha ao ler o PDF', err);
    }
    if (!view.isConnected) return;
    const filled = text.trim() ? applyParsed(parseResumeText(text)) : [];

    setBusy('Anexando o PDF ao seu perfil…');
    const up = await uploading;
    if (!view.isConnected) return;
    setBusy(null);
    if (up.ok && up.pdf) paintAttached(up.pdf);
    if (!up.ok) toast(`Não foi possível anexar o PDF: ${up.err.message}`);

    if (!text.trim()) {
      toast(up.ok
        ? 'Não conseguimos ler o texto deste PDF (pode ser uma imagem digitalizada), mas o arquivo foi anexado ao seu perfil.'
        : 'Não conseguimos ler o texto deste PDF.', 'info');
    } else if (filled.length) {
      const n = filled.length;
      toast(`${n} ${n === 1 ? 'campo preenchido' : 'campos preenchidos'} a partir do PDF — revise antes de salvar.`, 'success');
    } else {
      toast(`Lemos o PDF, mas os campos já estavam preenchidos — nada foi alterado.${up.ok ? ' O arquivo foi anexado.' : ''}`, 'info');
    }
  }

  async function removePdf(btn) {
    const ok = await confirmModal({
      title: 'Remover PDF anexado?',
      message: 'O arquivo deixará de ficar disponível para as empresas. Os dados do formulário não serão alterados.',
      confirmText: 'Remover',
      confirmClass: 'btn-danger',
    });
    if (!ok || !view.isConnected) return;
    await withButton(btn, async () => {
      await api('/candidate/resume-pdf', { method: 'DELETE' });
      paintAttached(null);
      toast('PDF removido.', 'success');
    });
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    handleFile(file);
  });
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!busy) dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', (e) => {
    if (!dropzone.contains(e.relatedTarget)) dropzone.classList.remove('dragover');
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    handleFile(file);
  });
}
