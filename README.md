# Conecta Vagas

Plataforma de vagas no estilo Gupy, construída para o hackathon Codecon.

- **Empresas** publicam vagas, acompanham os candidatos e fecham a vaga escolhendo quem foi contratado.
- **Candidatos** preenchem o currículo em um formulário, buscam vagas com filtros (cargo, salário, tecnologias, empresa, senioridade), se candidatam com um clique e acompanham o status de cada candidatura.

Monólito Node.js: API em Express + SQLite (`better-sqlite3`) e SPA em HTML/CSS/JavaScript puro servida pelo próprio Express — sem etapa de build.

## Como rodar

Requisitos: Node.js 20 ou superior.

```bash
npm install
npm run seed   # recria o banco com dados de demonstração
npm run dev    # sobe o servidor com reload automático
```

Abra http://localhost:3000.

> Se o banco estiver vazio ao subir o servidor, os dados de demonstração são criados automaticamente.

Para produção: `npm start`.

## Testes

```bash
npm test
```

Testes de API com `node:test` + `supertest`, cada um com um banco SQLite em memória.

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `3000` | Porta HTTP |
| `DB_PATH` | `data/app.db` | Caminho do arquivo SQLite (`:memory:` para banco em memória) |
| `SESSION_SECRET` | segredo de dev | Segredo do cookie de sessão. **Obrigatório** quando `NODE_ENV=production` |
| `NODE_ENV` | — | Em `production`, exige `SESSION_SECRET` e marca o cookie como `secure` |

## Credenciais de demonstração

Senha de todos os usuários: **`demo123`**

| Perfil | E-mail | Nome |
|---|---|---|
| Empresa | `rh@technova.com` | TechNova |
| Empresa | `talentos@aurorabank.com` | Banco Aurora |
| Empresa | `vagas@lojaviva.com` | Loja Viva |
| Candidato | `ana@demo.com` | Ana Souza (pleno — JavaScript, TypeScript, React, Node) |
| Candidato | `bruno@demo.com` | Bruno Lima (júnior — Python, Django, SQL) |

O seed cria 10 vagas abertas variadas e 3 candidaturas.

## Roteiro de demo

1. **Empresa cria vaga:** entre como `rh@technova.com`, vá em "Nova vaga" e publique uma vaga (ex.: "Desenvolvedor(a) React", pleno, tecnologias `react, typescript`).
2. **Candidato preenche o currículo:** em outra janela anônima, crie uma conta de candidato (ou entre como `ana@demo.com`) e preencha o currículo (nome, senioridade e ao menos uma tecnologia são obrigatórios para se candidatar).
3. **Candidato filtra e se candidata:** no painel de vagas, filtre por tecnologia `react` e/ou pela empresa TechNova, abra a vaga criada e clique em "Candidatar-se".
4. **Empresa fecha a vaga:** de volta à empresa, abra a vaga, expanda o currículo do candidato e clique em "Contratar e fechar vaga".
5. **Candidato vê "Aprovado":** em "Minhas candidaturas", a candidatura aparece como **Aprovado** (os demais candidatos da vaga ficam como "Não selecionado").

## Estrutura de pastas

```
server/
  app.js              # Express: sessão, rotas, estáticos e tratamento de erros
  index.js            # sobe o servidor (auto-seed se o banco estiver vazio)
  db.js               # conexão SQLite + schema
  seed.js             # dados de demonstração (npm run seed)
  validation.js       # validadores + HttpError
  profile-model.js    # currículo: validação e serialização
  job-model.js        # vagas: validação, serialização e filtros
  middleware/auth.js  # requireAuth / requireRole
  routes/             # auth, candidate, jobs, company, meta
public/               # SPA (HTML + CSS + JS puro, roteamento por hash)
tests/                # testes de API (node:test + supertest)
docs/                 # spec de design
data/                 # banco SQLite (ignorado pelo git)
```

## API (resumo)

Todas as rotas ficam sob `/api` e respondem JSON; erros vêm como `{ "error": "mensagem" }`.

- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- Candidato: `GET|PUT /candidate/profile`, `GET /candidate/applications`, `GET /jobs`, `GET /jobs/:id`, `POST /jobs/:id/apply`
- Empresa: `POST /company/jobs`, `GET /company/jobs?status=open|closed`, `GET /company/jobs/:id/applications`, `POST /company/jobs/:id/close`
- Qualquer usuário logado: `GET /meta/filters`

Detalhes em [`docs/superpowers/specs/2026-10-06-plataforma-vagas-design.md`](docs/superpowers/specs/2026-10-06-plataforma-vagas-design.md).

## Deploy (Render)

1. Crie um **Web Service** apontando para este repositório (runtime Node).
2. Build command: `npm install` — Start command: `npm start`.
3. Defina as variáveis `SESSION_SECRET` (valor aleatório longo) e `NODE_ENV=production`.

Observações:
- As sessões ficam em memória: um restart desloga todos os usuários.
- O arquivo SQLite fica no disco efêmero do serviço e é perdido a cada deploy/restart. Como o servidor executa o seed automaticamente quando o banco está vazio, a demo sempre sobe com dados. Para persistir dados, use um disco persistente e aponte `DB_PATH` para ele.
