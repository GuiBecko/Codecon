import { HttpError, SENIORITIES, text, oneOf, normalizeTechs, csvToTechs } from './validation.js';
import { normalizeCountry, normalizeState, normalizePhone, normalizeLinkedin } from './contact.js';

const MAX_ITEMS = 20;
const EXPERIENCE_FIELDS = { empresa: 120, cargo: 120, inicio: 120, fim: 120, descricao: 1000 };
const EDUCATION_FIELDS = { instituicao: 120, curso: 120, conclusao: 120 };
const EDUCATION_STATUSES = ['concluido', 'em_andamento'];
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.filter((i) => i && typeof i === 'object' && !Array.isArray(i)) : [];
  } catch {
    return [];
  }
}

function resumePdfFromRow(row) {
  if (!row.resume_pdf_path) return null;
  return {
    name: row.resume_pdf_name ?? 'curriculo.pdf',
    size: row.resume_pdf_size ?? 0,
    uploadedAt: row.resume_pdf_uploaded_at ?? null,
  };
}

export function profileFromRow(row) {
  const technologies = csvToTechs(row.technologies);
  const profile = {
    fullName: row.full_name ?? '',
    phone: row.phone ?? '',
    city: row.city ?? '',
    state: row.state ?? '',
    country: row.country || 'Brasil',
    linkedin: row.linkedin ?? '',
    seniority: row.seniority ?? null,
    technologies,
    summary: row.summary ?? '',
    experiences: parseJsonArray(row.experiences).map((e) => ({ ...e, atual: e.atual === true })),
    education: parseJsonArray(row.education).map((e) => ({
      ...e,
      situacao: EDUCATION_STATUSES.includes(e.situacao) ? e.situacao : 'concluido',
    })),
    resumePdf: resumePdfFromRow(row),
  };
  profile.complete = Boolean(profile.fullName && profile.seniority && technologies.length > 0);
  return profile;
}

function monthField(value) {
  if (value && !MONTH_RE.test(value)) throw new HttpError(400, 'Data inválida (use AAAA-MM)');
  return value;
}

function parseBool(value, field) {
  if (value === undefined || value === null || value === '') return false;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new HttpError(400, `${field}: valor inválido`);
}

function finishExperience(clean, item) {
  clean.atual = parseBool(item.atual, 'Experiências (atual)');
  if (clean.atual) clean.fim = '';
  monthField(clean.inicio);
  monthField(clean.fim);
  if (clean.inicio && clean.fim && clean.fim < clean.inicio) {
    throw new HttpError(400, 'A data de fim deve ser posterior ao início');
  }
}

function finishEducation(clean, item) {
  monthField(clean.conclusao);
  const situacao = item.situacao === undefined || item.situacao === null || item.situacao === ''
    ? 'concluido' : item.situacao;
  clean.situacao = oneOf(situacao, EDUCATION_STATUSES, 'Formação (situação)');
}

function parseList(value, fields, label, finish) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new HttpError(400, `${label}: valor inválido`);
  if (value.length > MAX_ITEMS) throw new HttpError(400, `${label}: no máximo ${MAX_ITEMS} itens`);
  const result = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new HttpError(400, `${label}: item inválido`);
    }
    const clean = {};
    for (const [field, max] of Object.entries(fields)) {
      clean[field] = text(item[field], `${label} (${field})`, { max });
    }
    if (!Object.values(clean).some(Boolean)) continue;
    finish(clean, item);
    result.push(clean);
  }
  return result;
}

export function parseProfileInput(body) {
  body = body ?? {};
  const country = normalizeCountry(body.country);
  return {
    fullName: text(body.fullName, 'Nome completo', { required: true, max: 120 }),
    country,
    state: normalizeState(body.state, country),
    phone: normalizePhone(body.phone, country),
    city: text(body.city, 'Cidade', { max: 80 }),
    linkedin: normalizeLinkedin(body.linkedin),
    seniority: oneOf(body.seniority, SENIORITIES, 'Senioridade', { required: false }),
    technologies: normalizeTechs(body.technologies),
    summary: text(body.summary, 'Resumo', { max: 2000 }),
    experiences: parseList(body.experiences, EXPERIENCE_FIELDS, 'Experiências', finishExperience),
    education: parseList(body.education, EDUCATION_FIELDS, 'Formação', finishEducation),
  };
}
