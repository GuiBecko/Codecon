import {
  HttpError, SENIORITIES, WORK_MODELS, text, oneOf, nonNegativeInt, normalizeTechs, csvToTechs,
} from './validation.js';

export const JOB_SELECT = `
  SELECT j.*, c.name AS company_name
  FROM jobs j
  JOIN companies c ON c.user_id = j.company_id
`;

export function jobFromRow(row) {
  return {
    id: row.id,
    companyId: row.company_id,
    companyName: row.company_name,
    title: row.title,
    description: row.description,
    seniority: row.seniority,
    salaryMin: row.salary_min,
    salaryMax: row.salary_max,
    technologies: csvToTechs(row.technologies),
    location: row.location,
    workModel: row.work_model,
    status: row.status,
    hiredApplicationId: row.hired_application_id ?? null,
    createdAt: row.created_at,
  };
}

export function parseJobInput(body) {
  body = body ?? {};
  const job = {
    title: text(body.title, 'Título', { required: true, max: 120 }),
    description: text(body.description, 'Descrição', { max: 5000 }),
    seniority: oneOf(body.seniority, SENIORITIES, 'Senioridade'),
    salaryMin: nonNegativeInt(body.salaryMin, 'Salário mínimo'),
    salaryMax: nonNegativeInt(body.salaryMax, 'Salário máximo'),
    technologies: normalizeTechs(body.technologies),
    location: text(body.location, 'Localização', { max: 120 }),
    workModel: oneOf(body.workModel, WORK_MODELS, 'Modelo de trabalho'),
  };
  if (job.salaryMin > job.salaryMax) {
    throw new HttpError(400, 'O salário mínimo não pode ser maior que o máximo');
  }
  if (job.technologies.length === 0) {
    throw new HttpError(400, 'Informe ao menos uma tecnologia');
  }
  return job;
}

const isEmpty = (v) => v === undefined || v === null || v === '';

export function parseJobFilters(query) {
  query = query ?? {};
  const q = text(query.q, 'Busca', { max: 120 });
  const seniority = oneOf(query.seniority, SENIORITIES, 'Senioridade', { required: false });
  let salaryMin = null;
  if (!isEmpty(query.salaryMin)) {
    salaryMin = nonNegativeInt(query.salaryMin, 'Salário mínimo');
  }
  let company = null;
  if (!isEmpty(query.company)) {
    if (typeof query.company !== 'string' || !/^\d+$/.test(query.company) || Number(query.company) <= 0) {
      throw new HttpError(400, 'Empresa inválida');
    }
    company = Number(query.company);
  }
  const tech = normalizeTechs(query.tech);
  return { q, seniority, salaryMin, tech, company };
}

function fold(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function filterJobs(jobs, filters) {
  const q = filters.q ? fold(filters.q) : '';
  return jobs.filter((job) => {
    if (q && !fold(job.title).includes(q)) return false;
    if (filters.seniority && job.seniority !== filters.seniority) return false;
    if (filters.salaryMin !== null && filters.salaryMin !== undefined && job.salaryMax < filters.salaryMin) return false;
    if (filters.company !== null && filters.company !== undefined && job.companyId !== filters.company) return false;
    if (filters.tech?.length && !filters.tech.every((t) => job.technologies.includes(t))) return false;
    return true;
  });
}
