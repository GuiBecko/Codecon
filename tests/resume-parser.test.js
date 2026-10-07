import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseResumeText, parseDateToken } from '../public/js/resume-parser.js';

const NOW = new Date('2026-10-06T12:00:00Z');

const PT_RESUME = `ANA CAROLINA SOUZA
Desenvolvedora Front-end Pleno
São Paulo - SP | (11) 98888-1111 | ana.souza@email.com
linkedin.com/in/ana-souza-dev

Resumo
Desenvolvedora com 5 anos de experiência criando interfaces acessíveis com React e TypeScript.
Busco desafios em produtos de impacto.

Experiência Profissional
Desenvolvedora Front-end Pleno - TechNova
mar/2022 - atual
• Liderei a migração de JavaScript para TypeScript no app principal.
• Criei a biblioteca de componentes com Storybook e testes com Jest.
Desenvolvedora Júnior | Agência Pixel
03/2020 – 02/2022
• Sites institucionais em Vue.js e Node.js com PostgreSQL.

Formação
Bacharelado em Ciência da Computação - Universidade de São Paulo
2016 - 2019
MBA em Engenharia de Software - FIAP
Previsão: jun/2027

Habilidades
JavaScript, TypeScript, React, Node.js, Vue, Git, Docker, AWS, Figma, SQL
`;

const EN_RESUME = `John Peterson
Senior Backend Engineer
john.peterson@mail.io · +55 21 3888-1111 · Rio de Janeiro, RJ
https://br.linkedin.com/in/johnpeterson/?locale=en_US

Summary
Backend engineer focused on Java and Spring Boot microservices on Kubernetes.

Work Experience
Globex Corp | Jan 2020 – Present
Senior Software Engineer
Designed event-driven services with Kafka and PostgreSQL
Initech
Software Engineer
2017 - 2019
Built REST APIs in C# and .NET Core

Education
Computer Science — Federal University of Rio de Janeiro (2012 - 2016)
`;

const MESSY_RESUME = `   Currículo
   carlos   eduardo lima

Email: carlos.lima@gmail.com     Tel: 31 99777-6655
Belo Horizonte/MG
Objetivo: Atuar como estagiário em desenvolvimento.
Conhecimentos: python, django, html5, css, javascript básico, c++, react native, golang
EXPERIÊNCIAS
Monitor de Algoritmos na UFMG desde 2025
Ajudava alunos com listas de exercícios
ESCOLARIDADE
Sistemas de Informação - UFMG - cursando
Técnico em Informática - CEFET 2020
`;

test('parse de currículo pt-BR completo', () => {
  const r = parseResumeText(PT_RESUME, { now: NOW });
  assert.equal(r.fullName, 'Ana Carolina Souza');
  assert.equal(r.email, 'ana.souza@email.com');
  assert.equal(r.phone, '(11) 98888-1111');
  assert.equal(r.city, 'São Paulo');
  assert.equal(r.state, 'SP');
  assert.equal(r.linkedin, 'https://www.linkedin.com/in/ana-souza-dev');
  assert.equal(r.seniority, 'pleno');
  for (const t of ['javascript', 'typescript', 'react', 'node', 'vue', 'git', 'docker', 'aws', 'figma', 'sql', 'postgresql', 'jest']) {
    assert.ok(r.technologies.includes(t), `faltou ${t}: ${r.technologies}`);
  }
  assert.ok(!r.technologies.includes('java'), 'java não deve casar com javascript');
  assert.match(r.summary, /^Desenvolvedora com 5 anos/);

  assert.equal(r.experiences.length, 2);
  const [a, b] = r.experiences;
  assert.equal(a.cargo, 'Desenvolvedora Front-end Pleno');
  assert.equal(a.empresa, 'TechNova');
  assert.equal(a.inicio, '2022-03');
  assert.equal(a.fim, '');
  assert.equal(a.atual, true);
  assert.match(a.descricao, /migração de JavaScript/);
  assert.match(a.descricao, /Storybook/);
  assert.equal(b.cargo, 'Desenvolvedora Júnior');
  assert.equal(b.empresa, 'Agência Pixel');
  assert.equal(b.inicio, '2020-03');
  assert.equal(b.fim, '2022-02');
  assert.equal(b.atual, false);
  assert.match(b.descricao, /Vue\.js/);

  assert.equal(r.education.length, 2);
  assert.deepEqual(r.education[0], {
    curso: 'Bacharelado em Ciência da Computação', instituicao: 'Universidade de São Paulo', situacao: 'concluido', conclusao: '2019-01',
  });
  assert.equal(r.education[1].curso, 'MBA em Engenharia de Software');
  assert.equal(r.education[1].instituicao, 'FIAP');
  assert.equal(r.education[1].situacao, 'em_andamento');
  assert.equal(r.education[1].conclusao, '2027-06');
});

test('parse de currículo com títulos em inglês', () => {
  const r = parseResumeText(EN_RESUME, { now: NOW });
  assert.equal(r.fullName, 'John Peterson');
  assert.equal(r.email, 'john.peterson@mail.io');
  assert.equal(r.phone, '(21) 3888-1111');
  assert.equal(r.city, 'Rio de Janeiro');
  assert.equal(r.state, 'RJ');
  assert.equal(r.linkedin, 'https://www.linkedin.com/in/johnpeterson');
  assert.equal(r.seniority, 'senior');
  for (const t of ['java', 'spring boot', 'kubernetes', 'kafka', 'postgresql', 'c#', '.net', 'rest']) {
    assert.ok(r.technologies.includes(t), `faltou ${t}: ${r.technologies}`);
  }
  assert.ok(!r.technologies.includes('spring'), 'spring boot não deve gerar "spring" isolado');
  assert.match(r.summary, /Spring Boot microservices/);

  assert.equal(r.experiences.length, 2);
  assert.deepEqual(
    { cargo: r.experiences[0].cargo, empresa: r.experiences[0].empresa, inicio: r.experiences[0].inicio, atual: r.experiences[0].atual },
    { cargo: 'Senior Software Engineer', empresa: 'Globex Corp', inicio: '2020-01', atual: true },
  );
  assert.match(r.experiences[0].descricao, /Kafka/);
  assert.equal(r.experiences[1].cargo, 'Software Engineer');
  assert.equal(r.experiences[1].empresa, 'Initech');
  assert.equal(r.experiences[1].inicio, '2017-01');
  assert.equal(r.experiences[1].fim, '2019-01');
  assert.equal(r.experiences[1].atual, false);
  assert.match(r.experiences[1].descricao, /REST APIs/);

  assert.equal(r.education.length, 1);
  assert.equal(r.education[0].curso, 'Computer Science');
  assert.equal(r.education[0].instituicao, 'Federal University of Rio de Janeiro');
  assert.equal(r.education[0].situacao, 'concluido');
  assert.equal(r.education[0].conclusao, '2016-01');
});

test('parse de currículo bagunçado', () => {
  const r = parseResumeText(MESSY_RESUME, { now: NOW });
  assert.equal(r.fullName, 'Carlos Eduardo Lima');
  assert.equal(r.email, 'carlos.lima@gmail.com');
  assert.equal(r.phone, '(31) 99777-6655');
  assert.equal(r.city, 'Belo Horizonte');
  assert.equal(r.state, 'MG');
  assert.equal(r.linkedin, undefined);
  assert.equal(r.seniority, 'estagio');
  for (const t of ['python', 'django', 'html', 'css', 'javascript', 'c++', 'react native', 'go']) {
    assert.ok(r.technologies.includes(t), `faltou ${t}: ${r.technologies}`);
  }
  assert.ok(!r.technologies.includes('react'), 'react native não deve gerar "react"');
  assert.ok(!r.technologies.includes('java'));

  assert.equal(r.experiences.length, 1);
  assert.equal(r.experiences[0].cargo, 'Monitor de Algoritmos');
  assert.equal(r.experiences[0].empresa, 'UFMG');
  assert.equal(r.experiences[0].inicio, '2025-01');
  assert.equal(r.experiences[0].atual, true);

  assert.equal(r.education.length, 2);
  assert.equal(r.education[0].curso, 'Sistemas de Informação');
  assert.equal(r.education[0].instituicao, 'UFMG');
  assert.equal(r.education[0].situacao, 'em_andamento');
  assert.equal(r.education[1].curso, 'Técnico em Informática');
  assert.equal(r.education[1].situacao, 'concluido');
  assert.equal(r.education[1].conclusao, '2020-01');
});

test('texto vazio ou inválido não lança e devolve resultado vazio', () => {
  for (const input of ['', '   \n\n ', null, undefined, 42, '@@@ ### ---']) {
    const r = parseResumeText(input);
    assert.deepEqual(r.technologies, []);
    assert.deepEqual(r.experiences, []);
    assert.deepEqual(r.education, []);
    assert.equal(r.fullName, undefined);
    assert.equal(r.email, undefined);
  }
});

test('não confunde datas com telefone nem cidade com cargo', () => {
  const r = parseResumeText('Maria Lima\nAnalista de Sistemas - TO\nExperiência\nAnalista | ACME\n2019 - 2021', { now: NOW });
  assert.equal(r.phone, undefined);
  assert.equal(r.city, undefined);
  assert.equal(r.experiences[0].inicio, '2019-01');
  assert.equal(r.experiences[0].fim, '2021-01');
});

test('parseDateToken', () => {
  assert.equal(parseDateToken('mar/2022'), '2022-03');
  assert.equal(parseDateToken('03/2020'), '2020-03');
  assert.equal(parseDateToken('Jan 2020'), '2020-01');
  assert.equal(parseDateToken('setembro de 2019'), '2019-09');
  assert.equal(parseDateToken('Dez. 2021'), '2021-12');
  assert.equal(parseDateToken('2019'), '2019-01');
  assert.equal(parseDateToken('13/2020'), '2020-01');
  assert.equal(parseDateToken('lixo'), '');
});
