import { api } from '../api.js';
import { go } from '../session.js';
import { options, toast, withButton, SENIORITY_LABELS, WORK_MODEL_LABELS } from '../ui.js';
import { tagInputHtml, mountTagInput } from '../tag-input.js';

export function render(view) {
  view.innerHTML = `
    <a class="link-back" href="#/empresa/vagas">← Voltar para minhas vagas</a>
    <div class="page-header">
      <div>
        <h1>Nova vaga</h1>
        <p class="subtitle">Descreva a oportunidade. Ela fica visível para os candidatos assim que for publicada.</p>
      </div>
    </div>
    <form class="form" data-form novalidate>
      <section class="card card-lg form-section">
        <h2>Informações da vaga</h2>
        <div class="grid-2">
          <div class="field span-2">
            <label for="j-title">Cargo<span class="req">*</span></label>
            <input class="input" id="j-title" required maxlength="120" placeholder="Ex.: Desenvolvedor(a) Back-end Node.js">
          </div>
          <div class="field">
            <label for="j-seniority">Senioridade<span class="req">*</span></label>
            <select class="select" id="j-seniority" required>${options(SENIORITY_LABELS, '', { placeholder: 'Selecione…' })}</select>
          </div>
          <div class="field">
            <label for="j-model">Modelo de trabalho<span class="req">*</span></label>
            <select class="select" id="j-model" required>${options(WORK_MODEL_LABELS, '', { placeholder: 'Selecione…' })}</select>
          </div>
          <div class="field">
            <label for="j-min">Salário mínimo (R$/mês)<span class="req">*</span></label>
            <input class="input" id="j-min" type="number" min="0" step="1" inputmode="numeric" placeholder="Ex.: 6000" required>
          </div>
          <div class="field">
            <label for="j-max">Salário máximo (R$/mês)<span class="req">*</span></label>
            <input class="input" id="j-max" type="number" min="0" step="1" inputmode="numeric" placeholder="Ex.: 9000" required>
          </div>
          <div class="field span-2">
            <label for="j-location">Local</label>
            <input class="input" id="j-location" maxlength="120" placeholder="Ex.: São Paulo - SP (ou Brasil, para remoto)">
          </div>
          <div class="field span-2">
            <label for="j-tech">Tecnologias<span class="req">*</span></label>
            ${tagInputHtml('Ex.: node, postgresql, docker — Enter para adicionar', { id: 'j-tech' })}
            <span class="hint">Candidatos filtram vagas por essas tecnologias.</span>
          </div>
          <div class="field span-2">
            <label for="j-desc">Descrição</label>
            <textarea class="textarea" id="j-desc" rows="8" maxlength="5000" placeholder="Responsabilidades, requisitos, benefícios…"></textarea>
          </div>
        </div>
      </section>
      <div class="form-actions">
        <a class="btn btn-ghost" href="#/empresa/vagas">Cancelar</a>
        <button type="submit" class="btn btn-primary btn-lg" data-submit>Publicar vaga</button>
      </div>
    </form>`;

  const $ = (sel) => view.querySelector(sel);
  const tech = mountTagInput($('[data-tag-input]'), []);

  $('[data-form]').addEventListener('submit', (e) => {
    e.preventDefault();
    const minRaw = $('#j-min').value.trim();
    const maxRaw = $('#j-max').value.trim();
    const body = {
      title: $('#j-title').value.trim(),
      description: $('#j-desc').value.trim(),
      seniority: $('#j-seniority').value,
      workModel: $('#j-model').value,
      salaryMin: minRaw === '' ? null : Number(minRaw),
      salaryMax: maxRaw === '' ? null : Number(maxRaw),
      location: $('#j-location').value.trim(),
      technologies: tech.values(),
    };

    const fail = (msg, sel) => { toast(msg); if (sel) $(sel).focus(); };
    if (!body.title) return fail('Informe o cargo.', '#j-title');
    if (!body.seniority) return fail('Selecione a senioridade.', '#j-seniority');
    if (!body.workModel) return fail('Selecione o modelo de trabalho.', '#j-model');
    if (!Number.isInteger(body.salaryMin) || body.salaryMin < 0) return fail('Informe um salário mínimo válido (número inteiro).', '#j-min');
    if (!Number.isInteger(body.salaryMax) || body.salaryMax < 0) return fail('Informe um salário máximo válido (número inteiro).', '#j-max');
    if (body.salaryMin > body.salaryMax) return fail('O salário mínimo não pode ser maior que o máximo.', '#j-min');
    if (!body.technologies.length) return fail('Adicione pelo menos uma tecnologia.', '#j-tech');

    withButton($('[data-submit]'), async () => {
      const job = await api('/company/jobs', { method: 'POST', body });
      toast('Vaga publicada!', 'success');
      go(`#/empresa/vagas/${job.id}`);
    });
  });
}
