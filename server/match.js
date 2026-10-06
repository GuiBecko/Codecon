// server/match.js

// Compatibilidade entre UM candidato e UMA vaga.
// matchScore = % dos requisitos da vaga que o candidato atende.
export function scoreMatch(candidateTechs, jobTechs) {
  const have = new Set(candidateTechs);
  const matchedTechnologies = jobTechs.filter((t) => have.has(t));
  const missingTechnologies = jobTechs.filter((t) => !have.has(t));
  const total = jobTechs.length || 1;
  return {
    matchScore: Math.round((matchedTechnologies.length / total) * 100),
    matchedTechnologies,
    missingTechnologies,
  };
}

// ---------- LADO DO CANDIDATO: vagas compatíveis ----------

// Índice invertido: tecnologia -> vagas que pedem essa tecnologia.
export function buildTechIndex(jobs) {
  const index = new Map();
  for (const job of jobs) {
    for (const tech of job.technologies) {
      if (!index.has(tech)) index.set(tech, []);
      index.get(tech).push(job);
    }
  }
  return index;
}

export function matchJobs(candidateTechs, jobs, { minScore = 1 } = {}) {
  const index = buildTechIndex(jobs);
  const found = new Map(); // job.id -> job

  for (const tech of new Set(candidateTechs)) {
    for (const job of index.get(tech) ?? []) found.set(job.id, job);
  }

  return [...found.values()]
    .map((job) => ({ ...job, ...scoreMatch(candidateTechs, job.technologies) }))
    .filter((job) => job.matchScore >= minScore)
    .sort((a, b) =>
      b.matchScore - a.matchScore ||
      b.matchedTechnologies.length - a.matchedTechnologies.length ||
      b.id - a.id);
}

// ---------- LADO DA EMPRESA: triagem das candidaturas ----------

// applications: [{ id, status, createdAt, candidate: { technologies, ... } }]
export function rankApplications(applications, job) {
  return applications
    .map((app) => ({ ...app, ...scoreMatch(app.candidate.technologies, job.technologies) }))
    .sort((a, b) =>
      b.matchScore - a.matchScore ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id - b.id);
}