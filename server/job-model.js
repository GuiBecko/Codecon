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
