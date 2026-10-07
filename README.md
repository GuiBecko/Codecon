# Conecta Vagas

Plataforma de vagas no estilo Gupy, construída para o hackathon Codecon.

- **Empresas** publicam vagas, acompanham os candidatos e fecham a vaga escolhendo quem foi contratado.
- **Candidatos** preenchem o currículo em um formulário, buscam vagas com filtros (cargo, salário, tecnologias, empresa, senioridade), se candidatam com um clique e acompanham o status de cada candidatura.

Monólito Node.js: API em Express + SQLite (`better-sqlite3`) e SPA em HTML/CSS/JavaScript puro servida pelo próprio Express — sem etapa de build.

## Como rodar

Requisitos: Node.js 22.9 ou superior (os scripts usam `--env-file-if-exists=.env`).

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
| `NODE_ENV` | — | Em `production`, exige `SESSION_SECRET`, marca o cookie como `secure` e desliga `/api/dev/*` |
| `SMTP_HOST` | `smtp.gmail.com` | Servidor SMTP |
| `SMTP_PORT` | `465` | Porta SMTP (TLS direto quando 465) |
| `SMTP_USER` | `guilherme2becker@gmail.com` | Usuário SMTP |
| `SMTP_PASS` | — | Senha de app do Gmail. Sem ela (e sem `SMTP_URL`), nenhum e-mail sai da máquina |
| `SMTP_URL` | — | Opcional: URL SMTP completa que sobrescreve as variáveis acima |
| `MAIL_FROM` | `Conecta Vagas <guilherme2becker@gmail.com>` | Remetente |
| `MAIL_REDIRECT_TO` | — | Opcional: entrega todo e-mail neste endereço (assunto prefixado com `[para: original]`) |

`npm start` e `npm run dev` carregam automaticamente um arquivo `.env` local (não versionado). Modelo em [`.env.example`](.env.example).

## E-mails

Ao fechar uma vaga, cada candidato que estava **em análise** e passou a **não selecionado** recebe um e-mail de retorno personalizado:

- **Vaga fechada com contratação** (`POST /api/company/jobs/:id/close`): explica que outra pessoa foi selecionada e dá um feedback baseado no match — % das tecnologias atendidas, quais faltam e uma observação de senioridade quando o nível do perfil difere do da vaga.
- **Vaga encerrada sem contratação** (`POST /api/company/jobs/:id/cancel`): avisa que não tem relação com o perfil e recomenda até 3 vagas abertas compatíveis.

Envio real via Gmail: crie uma [senha de app](https://myaccount.google.com/apppasswords), copie `.env.example` para `.env` e preencha `SMTP_PASS`. Com `MAIL_REDIRECT_TO` definido, todos os e-mails chegam nesse endereço (útil porque os usuários demo têm e-mails fictícios). Sem `SMTP_PASS`, o servidor avisa na inicialização e os e-mails são apenas registrados.

O envio acontece depois de a transação ser gravada e nunca atrasa nem derruba a resposta: falhas ficam com status `failed` na tabela `emails`. Todos os e-mails (enviados ou não) aparecem na **caixa de demonstração** em [`/emails.html`](http://localhost:3000/emails.html), alimentada por `GET /api/dev/emails` (só fora de produção).

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
- Candidato: `GET|PUT /candidate/profile`, `GET /candidate/applications`, `GET /jobs`, `GET /jobs/matches`, `GET /jobs/:id`, `POST /jobs/:id/apply`
- Empresa: `POST /company/jobs`, `GET /company/jobs?status=open|closed`, `GET /company/jobs/:id/applications`, `POST /company/jobs/:id/close`, `POST /company/jobs/:id/cancel`
- Demonstração (fora de produção): `GET /dev/emails`
- Qualquer usuário logado: `GET /meta/filters`

Detalhes em [`docs/superpowers/specs/2026-10-06-plataforma-vagas-design.md`](docs/superpowers/specs/2026-10-06-plataforma-vagas-design.md).

## Deploy (Render)

1. Crie um **Web Service** apontando para este repositório (runtime Node).
2. Build command: `npm install` — Start command: `npm start`.
3. Defina as variáveis `SESSION_SECRET` (valor aleatório longo) e `NODE_ENV=production`.

Observações:
- As sessões ficam em memória: um restart desloga todos os usuários.
- O arquivo SQLite fica no disco efêmero do serviço e é perdido a cada deploy/restart. Como o servidor executa o seed automaticamente quando o banco está vazio, a demo sempre sobe com dados. Para persistir dados, use um disco persistente e aponte `DB_PATH` para ele.
