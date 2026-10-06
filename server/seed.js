import { pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import { createDb } from './db.js';

export const DEMO_PASSWORD = 'demo123';

const COMPANIES = [
  {
    email: 'rh@technova.com',
    name: 'TechNova',
    description: 'Software house focada em produtos SaaS para o varejo e a indústria.',
    website: 'https://technova.example.com',
  },
  {
    email: 'talentos@aurorabank.com',
    name: 'Banco Aurora',
    description: 'Banco digital com mais de 5 milhões de clientes em todo o Brasil.',
    website: 'https://aurorabank.example.com',
  },
  {
    email: 'vagas@lojaviva.com',
    name: 'Loja Viva',
    description: 'E-commerce de casa e decoração que cresce 40% ao ano.',
    website: 'https://lojaviva.example.com',
  },
];

const CANDIDATES = [
  {
    email: 'ana@demo.com',
    fullName: 'Ana Souza',
    phone: '(11) 98765-4321',
    city: 'São Paulo - SP',
    linkedin: 'https://www.linkedin.com/in/ana-souza-demo',
    seniority: 'pleno',
    technologies: ['javascript', 'typescript', 'react', 'node'],
    summary: 'Desenvolvedora full stack com 4 anos de experiência construindo aplicações web com React e Node.js.',
    experiences: [
      {
        empresa: 'Startup Pix',
        cargo: 'Desenvolvedora Full Stack',
        inicio: '2022',
        fim: 'atual',
        descricao: 'Desenvolvimento de dashboards em React e APIs REST em Node.js.',
      },
    ],
    education: [
      { instituicao: 'Universidade Federal do ABC', curso: 'Ciência da Computação', conclusao: '2021' },
    ],
  },
  {
    email: 'bruno@demo.com',
    fullName: 'Bruno Lima',
    phone: '(31) 99876-5432',
    city: 'Belo Horizonte - MG',
    linkedin: 'https://www.linkedin.com/in/bruno-lima-demo',
    seniority: 'junior',
    technologies: ['python', 'django', 'sql'],
    summary: 'Desenvolvedor backend em início de carreira, apaixonado por Python e dados.',
    experiences: [
      {
        empresa: 'Agência Mineira',
        cargo: 'Estagiário de Desenvolvimento',
        inicio: '2023',
        fim: '2024',
        descricao: 'Manutenção de sistemas internos em Django.',
      },
    ],
    education: [
      { instituicao: 'PUC Minas', curso: 'Sistemas de Informação', conclusao: '2024' },
    ],
  },
];

// company: índice em COMPANIES
const JOBS = [
  {
    company: 0, title: 'Desenvolvedor(a) Full Stack', seniority: 'pleno', salaryMin: 7000, salaryMax: 10000,
    technologies: ['javascript', 'react', 'node', 'postgresql'], location: 'São Paulo - SP', workModel: 'hibrido',
    description: 'Construa features ponta a ponta do nosso SaaS de gestão de estoque, do banco de dados à interface.',
  },
  {
    company: 1, title: 'Desenvolvedor(a) Python Júnior', seniority: 'junior', salaryMin: 4000, salaryMax: 5500,
    technologies: ['python', 'django', 'sql'], location: 'Belo Horizonte - MG', workModel: 'remoto',
    description: 'Atue no time de crédito desenvolvendo APIs em Django e automações de dados.',
  },
  {
    company: 1, title: 'Analista de Segurança da Informação', seniority: 'senior', salaryMin: 12000, salaryMax: 16000,
    technologies: ['aws', 'linux', 'python', 'siem'], location: 'São Paulo - SP', workModel: 'presencial',
    description: 'Lidere a resposta a incidentes e a gestão de vulnerabilidades da nossa infraestrutura em nuvem.',
  },
  {
    company: 2, title: 'Desenvolvedor Mobile', seniority: 'pleno', salaryMin: 6500, salaryMax: 9500,
    technologies: ['react native', 'typescript', 'javascript'], location: 'Curitiba - PR', workModel: 'remoto',
    description: 'Evolua o app da Loja Viva, usado por milhões de clientes, com foco em performance e UX.',
  },
  {
    company: 0, title: 'Estágio em Desenvolvimento Web', seniority: 'estagio', salaryMin: 1800, salaryMax: 2200,
    technologies: ['html', 'css', 'javascript'], location: 'São Paulo - SP', workModel: 'hibrido',
    description: 'Aprenda na prática com mentoria de devs seniores, construindo telas do nosso produto.',
  },
  {
    company: 1, title: 'Engenheiro(a) de Dados', seniority: 'senior', salaryMin: 13000, salaryMax: 18000,
    technologies: ['python', 'spark', 'sql', 'aws'], location: 'Remoto', workModel: 'remoto',
    description: 'Projete pipelines de dados escaláveis que alimentam os modelos de risco do banco.',
  },
  {
    company: 2, title: 'Desenvolvedor(a) Front-end Júnior', seniority: 'junior', salaryMin: 3500, salaryMax: 5000,
    technologies: ['javascript', 'react', 'css'], location: 'Florianópolis - SC', workModel: 'presencial',
    description: 'Crie páginas de produto e campanhas do e-commerce com foco em acessibilidade.',
  },
  {
    company: 0, title: 'Arquiteto(a) de Software', seniority: 'especialista', salaryMin: 20000, salaryMax: 28000,
    technologies: ['java', 'kubernetes', 'aws', 'microservices'], location: 'São Paulo - SP', workModel: 'hibrido',
    description: 'Defina a arquitetura da nova plataforma de integrações e guie os times técnicos.',
  },
  {
    company: 1, title: 'Desenvolvedor(a) Java', seniority: 'pleno', salaryMin: 8000, salaryMax: 11000,
    technologies: ['java', 'spring', 'sql'], location: 'Rio de Janeiro - RJ', workModel: 'hibrido',
    description: 'Desenvolva microsserviços do core bancário com Spring Boot e alta disponibilidade.',
  },
  {
    company: 2, title: 'Analista de QA', seniority: 'junior', salaryMin: 3800, salaryMax: 5200,
    technologies: ['cypress', 'javascript', 'testes automatizados'], location: 'Remoto', workModel: 'remoto',
    description: 'Garanta a qualidade do checkout escrevendo testes automatizados de ponta a ponta.',
  },
];

// [candidato, vaga]
const APPLICATIONS = [
  [0, 0],
  [1, 0],
  [1, 1],
];

export function seed(db) {
  const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);

  db.transaction(() => {
    db.exec(`
      DELETE FROM applications;
      DELETE FROM jobs;
      DELETE FROM candidates;
      DELETE FROM companies;
      DELETE FROM users;
    `);
    const hasSequence = db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'sqlite_sequence'").get();
    if (hasSequence) db.exec('DELETE FROM sqlite_sequence');

    const insertUser = db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)');
    const companyIds = COMPANIES.map((c) => {
      const id = Number(insertUser.run(c.email, hash, 'company').lastInsertRowid);
      db.prepare('INSERT INTO companies (user_id, name, description, website) VALUES (?, ?, ?, ?)')
        .run(id, c.name, c.description, c.website);
      return id;
    });

    const candidateIds = CANDIDATES.map((c) => {
      const id = Number(insertUser.run(c.email, hash, 'candidate').lastInsertRowid);
      db.prepare(`
        INSERT INTO candidates (user_id, full_name, phone, city, linkedin, seniority, technologies,
          summary, experiences, education)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, c.fullName, c.phone, c.city, c.linkedin, c.seniority, c.technologies.join(','),
        c.summary, JSON.stringify(c.experiences), JSON.stringify(c.education),
      );
      return id;
    });

    // A primeira vaga da lista é a mais recente.
    const jobIds = JOBS.map((j, i) => Number(db.prepare(`
      INSERT INTO jobs (company_id, title, description, seniority, salary_min, salary_max,
        technologies, location, work_model, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
    `).run(
      companyIds[j.company], j.title, j.description, j.seniority, j.salaryMin, j.salaryMax,
      j.technologies.join(','), j.location, j.workModel, `-${i * 6} hours`,
    ).lastInsertRowid));

    for (const [candidate, job] of APPLICATIONS) {
      db.prepare('INSERT INTO applications (job_id, candidate_id) VALUES (?, ?)')
        .run(jobIds[job], candidateIds[candidate]);
    }
  })();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = createDb();
  seed(db);
  db.close();
  console.log('Banco populado com dados de demonstração.');
  console.log(`Senha de todos os usuários demo: ${DEMO_PASSWORD}`);
}
