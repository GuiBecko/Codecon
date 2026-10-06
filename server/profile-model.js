import { HttpError, SENIORITIES, text, oneOf, normalizeTechs, csvToTechs } from './validation.js';

const MAX_ITEMS = 20;
const EXPERIENCE_FIELDS = { empresa: 120, cargo: 120, inicio: 120, fim: 120, descricao: 1000 };
const EDUCATION_FIELDS = { instituicao: 120, curso: 120, conclusao: 120 };

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function profileFromRow(row) {
  const technologies = csvToTechs(row.technologies);
  const profile = {
    fullName: row.full_name ?? '',
    phone: row.phone ?? '',
    city: row.city ?? '',
    linkedin: row.linkedin ?? '',
    seniority: row.seniority ?? null,
    technologies,
    summary: row.summary ?? '',
    experiences: parseJsonArray(row.experiences),
    education: parseJsonArray(row.education),
  };
  profile.complete = Boolean(profile.fullName && profile.seniority && technologies.length > 0);
  return profile;
}

function parseList(value, fields, label) {
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
    if (Object.values(clean).some(Boolean)) result.push(clean);
  }
  return result;
}

export function parseProfileInput(body) {
  body = body ?? {};
  return {
    fullName: text(body.fullName, 'Nome completo', { required: true, max: 120 }),
    phone: text(body.phone, 'Telefone', { max: 30 }),
    city: text(body.city, 'Cidade', { max: 80 }),
    linkedin: text(body.linkedin, 'LinkedIn', { max: 200 }),
    seniority: oneOf(body.seniority, SENIORITIES, 'Senioridade', { required: false }),
    technologies: normalizeTechs(body.technologies),
    summary: text(body.summary, 'Resumo', { max: 2000 }),
    experiences: parseList(body.experiences, EXPERIENCE_FIELDS, 'Experiências'),
    education: parseList(body.education, EDUCATION_FIELDS, 'Formação'),
  };
}
