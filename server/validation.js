export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export const SENIORITIES = ['estagio', 'junior', 'pleno', 'senior', 'especialista'];
export const WORK_MODELS = ['remoto', 'hibrido', 'presencial'];

export function text(value, field, { required = false, max = 200 } = {}) {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string') throw new HttpError(400, `${field}: valor inválido`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new HttpError(400, `${field} é obrigatório`);
  if (trimmed.length > max) throw new HttpError(400, `${field} deve ter no máximo ${max} caracteres`);
  return trimmed;
}

export function oneOf(value, allowed, field, { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new HttpError(400, `${field} é obrigatório`);
    return null;
  }
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new HttpError(400, `${field} inválido(a). Valores aceitos: ${allowed.join(', ')}`);
  }
  return value;
}

export function nonNegativeInt(value, field) {
  let n;
  if (typeof value === 'number') n = value;
  else if (typeof value === 'string' && /^\d+$/.test(value.trim())) n = Number(value.trim());
  else throw new HttpError(400, `${field} deve ser um número inteiro não negativo`);
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new HttpError(400, `${field} deve ser um número inteiro não negativo`);
  }
  return n;
}

export function parseId(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new HttpError(404, 'Não encontrado');
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) throw new HttpError(404, 'Não encontrado');
  return n;
}

const MAX_TECH_LEN = 40;
const MAX_TECHS = 30;

export function normalizeTechs(value) {
  if (value === undefined || value === null) return [];
  let items;
  if (typeof value === 'string') items = [value];
  else if (Array.isArray(value)) items = value;
  else throw new HttpError(400, 'Tecnologias: valor inválido');

  const result = [];
  for (const item of items) {
    if (typeof item !== 'string') throw new HttpError(400, 'Tecnologias: valor inválido');
    for (const part of item.split(',')) {
      const tech = part.trim().toLowerCase().replace(/\s+/g, ' ');
      if (!tech) continue;
      if (tech.length > MAX_TECH_LEN) {
        throw new HttpError(400, `Cada tecnologia deve ter no máximo ${MAX_TECH_LEN} caracteres`);
      }
      if (!result.includes(tech)) result.push(tech);
    }
  }
  if (result.length > MAX_TECHS) throw new HttpError(400, `Informe no máximo ${MAX_TECHS} tecnologias`);
  return result;
}

export function techsToCsv(arr) {
  return arr.join(',');
}

export function csvToTechs(csv) {
  if (!csv) return [];
  return csv.split(',').filter(Boolean);
}
