# Plataforma de Vagas (estilo Gupy) — Design

Data: 2026-10-06
Contexto: hackathon Codecon, prazo curto. Critério de sucesso: demo funcionando, fluxo completo e visual caprichado.

## 1. Escopo

**Dentro:**
- Autenticação com dois perfis: empresa e candidato (cadastro + login).
- Empresa: criar vaga; listar suas vagas (abertas/fechadas) com candidaturas; fechar vaga escolhendo um candidato.
- Candidato: preencher currículo via formulário (sem PDF); painel de vagas com busca e filtros (cargo, salário, tecnologias, empresa, senioridade); candidatar-se com um clique; ver "Minhas candidaturas".

**Fora (deliberadamente):** upload de PDF, edição/exclusão de vaga, etapas intermediárias de processo seletivo, cancelar vaga sem contratar, notificações/e-mail, recuperação de senha, testes automatizados de front.

## 2. Stack e arquitetura

Monólito Node.js único:
- **Backend:** Express, `better-sqlite3`, `bcryptjs`, `express-session` (cookie `httpOnly`, `sameSite=lax`).
- **Frontend:** SPA em HTML + CSS + JavaScript puro (ES modules nativos, sem build), servida como estático pelo Express. Roteamento por hash.
- **Banco:** SQLite em arquivo (`data/app.db`; `DB_PATH` configurável, `:memory:` nos testes).
- **Deploy:** um único serviço (Render/Railway).

```
server/
  app.js              # express, sessão, static, rotas, errorHandler
  index.js            # sobe o servidor (app.listen)
  db.js               # conexão + schema (CREATE TABLE IF NOT EXISTS)
  seed.js             # dados de demo
  validation.js       # validadores + HttpError
  middleware/auth.js  # requireAuth, requireRole(role)
  routes/auth.js
  routes/candidate.js
  routes/jobs.js
  routes/company.js
  routes/meta.js
public/
  index.html
  css/styles.css
  js/app.js           # router + guarda por role
  js/api.js           # wrapper de fetch
  js/ui.js            # escapeHtml, toast, modal, helpers de render
  js/pages/*.js       # uma página por arquivo, exporta render(container, params)
tests/
data/                 # gitignored
```

## 3. Modelo de dados

**users**: `id` PK, `email` UNIQUE, `password_hash`, `role` (`company` | `candidate`), `created_at`

**companies**: `user_id` PK/FK → users, `name`, `description`, `website`

**candidates** (currículo-formulário): `user_id` PK/FK → users, `full_name`, `phone`, `city`, `linkedin`, `seniority`, `technologies` (CSV normalizado em minúsculas, sem espaços), `summary`, `experiences` (JSON `[{empresa, cargo, inicio, fim, descricao}]`), `education` (JSON `[{instituicao, curso, conclusao}]`), `updated_at`

**jobs**: `id` PK, `company_id` FK → companies, `title`, `description`, `seniority`, `salary_min`, `salary_max` (inteiros, R$/mês), `technologies` (CSV normalizado), `location`, `work_model` (`remoto` | `hibrido` | `presencial`), `status` (`open` | `closed`), `hired_application_id` (nullable), `created_at`

**applications**: `id` PK, `job_id` FK, `candidate_id` FK → candidates, `status` (`em_analise` | `aprovado` | `nao_selecionado`), `created_at`, `UNIQUE(job_id, candidate_id)`

Senioridade (enum único): `estagio` | `junior` | `pleno` | `senior` | `especialista`.

### Regras de negócio
- **Perfil completo** = `full_name`, `seniority` e ao menos 1 tecnologia preenchidos. Obrigatório para se candidatar.
- Candidatura nasce `em_analise`.
- **Fechar vaga** (transação única): `jobs.status='closed'`, `hired_application_id` = escolhida; escolhida → `aprovado`; demais da vaga → `nao_selecionado`. Só vagas `open` podem ser fechadas, e só com candidatura daquela vaga.
- Vagas fechadas não aparecem no painel do candidato e não aceitam candidatura.
- **Filtros** (combinados com AND):
  - `q`: substring case-insensitive em `title`
  - `seniority`: igualdade
  - `salaryMin`: vagas com `salary_max >= salaryMin`
  - `tech`: lista separada por vírgula; a vaga deve conter **todas**
  - `company`: id da empresa
- Ordenação do painel: mais recentes primeiro.

## 4. API

Todas sob `/api`, JSON. Erro sempre como `{ "error": "mensagem" }`.

### Auth
| Método | Rota | Corpo/Resposta |
|---|---|---|
| POST | `/auth/register` | `{email, password, role, name}` → cria user + companies/candidates (`name` vira `companies.name` ou `candidates.full_name`) e loga. 409 se e-mail existe; 400 se inválido (senha ≥ 6) |
| POST | `/auth/login` | `{email, password}` → `{id, email, role, name}`; 401 se inválido |
| POST | `/auth/logout` | 204 |
| GET | `/auth/me` | `{id, email, role, name}` ou 401 |

### Candidato (`requireRole('candidate')`)
| Método | Rota | Notas |
|---|---|---|
| GET | `/candidate/profile` | perfil completo + `complete: boolean` |
| PUT | `/candidate/profile` | valida tipos/enum; normaliza tecnologias |
| GET | `/jobs` | filtros da seção 3; só `open`; cada item traz `companyName` e `alreadyApplied` |
| GET | `/jobs/:id` | detalhe (404 se não existe) |
| POST | `/jobs/:id/apply` | 201; 409 duplicada; 422 perfil incompleto; 400 vaga fechada; 404 inexistente |
| GET | `/candidate/applications` | `[ {id, status, createdAt, job: {id, title, companyName, status}} ]` |

### Compartilhado (`requireAuth`)
| GET | `/meta/filters` | `{ companies: [{id, name}], technologies: [string] }` (a partir das vagas abertas) |

### Empresa (`requireRole('company')`)
| Método | Rota | Notas |
|---|---|---|
| POST | `/company/jobs` | valida: título, senioridade, work_model, `salary_min <= salary_max`, ≥ 1 tecnologia |
| GET | `/company/jobs?status=open\|closed` | vagas da empresa + `applicationsCount` |
| GET | `/company/jobs/:id/applications` | candidaturas com o perfil completo do candidato; 403 se a vaga não é da empresa |
| POST | `/company/jobs/:id/close` | `{applicationId}`; 403 vaga de outra empresa; 400 vaga já fechada ou candidatura de outra vaga |

### Segurança
bcryptjs (custo 10), sessão em cookie httpOnly + sameSite=lax, `SESSION_SECRET` via env (fallback só em dev), queries sempre parametrizadas, checagem de propriedade em toda rota de empresa.

## 5. Telas (SPA)

Boot: `GET /auth/me` → sem sessão vai para `#/login`; com sessão, a guarda de rota impede acesso a telas do outro role (redireciona para a home do role).

1. **`#/login`** — abas "Sou candidato" / "Sou empresa"; cada uma com Entrar / Criar conta.
2. **`#/vagas`** (candidato, home) — sidebar de filtros (busca, senioridade, salário mínimo, chips de tecnologias, select de empresa) + cards de vaga com botão Candidatar-se / "✓ Candidatado". Filtros com debounce, refletidos na query da hash.
3. **`#/vagas/:id`** — detalhe da vaga + candidatar.
4. **`#/curriculo`** — formulário do currículo; experiências e formação como listas dinâmicas; tecnologias como input de tags. Se a candidatura falhar com 422, o candidato é levado para cá com aviso.
5. **`#/minhas-candidaturas`** — lista com vaga, empresa, data e badge de status.
6. **`#/empresa/vagas`** (empresa, home) — abas Abertas / Fechadas; cards com nº de candidatos.
7. **`#/empresa/vagas/nova`** — formulário de criação.
8. **`#/empresa/vagas/:id`** — candidatos expansíveis (currículo completo) com "Contratar e fechar vaga" + modal de confirmação; vaga fechada mostra o contratado.

Visual: CSS próprio com variáveis de tema, inspirado na Gupy (fundo claro, cor primária forte, cards com sombra suave), responsivo, com estados de vazio e carregamento em todas as listas.

## 6. Tratamento de erros

- **Backend:** `HttpError(status, message)` lançado por validadores/rotas; `errorHandler` central converte em `{error}`; erros inesperados → 500 genérico + `console.error`.
- **Frontend:** `api.js` — 401 → `#/login`; demais → toast com `error`. Botões desabilitados durante requisição. Todo dado do usuário passa por `escapeHtml` antes de `innerHTML`.

## 7. Testes

`node:test` + `supertest`, banco `:memory:` novo por arquivo de teste. Cobertura:
- auth: register/login/me/logout, e-mail duplicado, credenciais inválidas;
- autorização por role (candidato ↛ rotas de empresa e vice-versa; sem sessão → 401);
- filtros de `/api/jobs` (cada filtro isolado + combinação; tecnologias com AND; só abertas);
- candidatura: sucesso, 409, 422, 400;
- fechar vaga: transação atualiza status corretamente, 403 outra empresa, 400 candidatura de outra vaga, 400 vaga já fechada.

Front: validação manual seguindo o roteiro de demo do README.

## 8. Scripts e entrega

- `npm start` — produção; `npm run dev` — `node --watch`; `npm run seed` — recria dados de demo (3 empresas, ~10 vagas variadas, 2 candidatos com currículo; senha padrão documentada no README); `npm test`.
- README com: como rodar, credenciais de demo e roteiro de demo (empresa cria vaga → candidato filtra e se candidata → empresa fecha vaga → candidato vê "Aprovado").

## 9. Extensões (2026-10-06)

### Dados do candidato
Novas colunas em `candidates`: `state`, `country` (padrão `'Brasil'`), `resume_pdf_path`, `resume_pdf_name`, `resume_pdf_size`, `resume_pdf_uploaded_at`. `createDb` aplica uma migração idempotente (`PRAGMA table_info` + `ALTER TABLE ADD COLUMN`), então bancos antigos são atualizados no restart.

`GET/PUT /candidate/profile` passam a incluir `state`, `country` e `resumePdf: null | {name, size, uploadedAt}` (este último só leitura).

### Regras de validação (`server/contact.js`, `server/profile-model.js`)
- **País:** texto ≤ 60; vazio → `Brasil`. É Brasil quando, sem acento/caixa, vale `brasil` ou `brazil`.
- **Estado:** no Brasil, vazio ou uma das 27 UFs (entrada sem distinção de caixa, gravada em maiúsculas) — senão 400 `Estado inválido`. Fora do Brasil, texto livre ≤ 60.
- **Telefone:** opcional. Brasil: 10 ou 11 dígitos (aceita prefixo `+55`/`55`), gravado como `(11) 98888-1111` / `(11) 3888-1111`; senão 400 `Telefone inválido. Use DDD + número, ex.: (11) 98888-1111`. Exterior: `^\+?[\d\s().-]+$` com 8–15 dígitos; senão 400 `Telefone inválido`.
- **LinkedIn:** opcional. Aceita `linkedin.com/in/<slug>` (com/sem protocolo, subdomínio `www.`/`br.`, barra final ou query) ou só o slug (`[A-Za-z0-9_%-]{3,100}`); gravado como `https://www.linkedin.com/in/<slug>`; senão 400 `LinkedIn inválido. Use linkedin.com/in/seu-perfil`.
- **Experiências:** `{empresa, cargo, inicio, fim, descricao, atual}`; `atual` booleano (aceita `'true'/'false'`), quando verdadeiro `fim = ''`. Datas `AAAA-MM` (400 `Data inválida (use AAAA-MM)`); `fim >= inicio` (400 `A data de fim deve ser posterior ao início`).
- **Formação:** `{instituicao, curso, conclusao, situacao}`; `conclusao` em `AAAA-MM` (previsão, se em andamento); `situacao` ∈ `concluido | em_andamento` (padrão `concluido`).
- Registros antigos sem `atual`/`situacao` são lidos com os padrões.

### PDF do currículo
Upload via `multer` em memória, limite 5 MB, assinatura `%PDF-` obrigatória. Arquivo salvo como `<UPLOADS_DIR>/<uuid>.pdf` (padrão `data/uploads`, fora do git); o banco guarda só o nome UUID, e nenhum caminho é montado a partir de entrada do usuário.

| Método | Rota | Notas |
|---|---|---|
| PUT | `/candidate/resume-pdf` | multipart, campo `file`; 200 com o perfil; 400 `Envie um arquivo PDF válido`; 413 `O PDF deve ter no máximo 5 MB`; substitui (e apaga) o anterior |
| GET | `/candidate/resume-pdf` | `application/pdf` + `Content-Disposition: attachment`; 404 `Nenhum PDF anexado` |
| DELETE | `/candidate/resume-pdf` | 204 |
| GET | `/company/applications/:id/resume-pdf` | empresa dona da vaga; 403 outra empresa; 404 candidatura inexistente ou sem PDF |

### Ajustes
- `GET /company/jobs/:id/applications`: `candidate` traz também `email` e `resumePdf`.
- `POST /jobs/:id/apply`: ordem das checagens 404 → 409 (já candidatado) → 400 (vaga fechada) → 422 (currículo incompleto).
- Bibliotecas de navegador servidas em `/vendor/pdfjs` (`pdfjs-dist/build`) e `/vendor/jspdf` (`jspdf/dist`).

### Frontend
O frontend importa dados de um currículo em PDF com heurísticas sobre o texto extraído pelo pdf.js e exporta o currículo em PDF com jsPDF.

## 10. Match e e-mails de retorno

### Match (`server/match.js`)
- `scoreMatch(candidateTechs, jobTechs)` → `{matchScore, matchedTechnologies, missingTechnologies}`; `matchScore` = % (arredondado) das tecnologias da vaga que o candidato tem. Vaga sem tecnologias → 0.
- `matchJobs(candidateTechs, jobs, {minScore = 1})`: só vagas com ao menos 1 tecnologia em comum, ordenadas por score desc → nº de tecnologias atendidas desc → mais nova primeiro.
- `rankApplications(applications, job)`: score desc → candidatura mais antiga primeiro.

| Método | Rota | Notas |
|---|---|---|
| GET | `/jobs/matches` | candidato; vagas **abertas** compatíveis, cada uma com `matchScore`, `matchedTechnologies`, `missingTechnologies`, `alreadyApplied`; sem tecnologias → `[]`; empresa → 403. Declarada antes de `/jobs/:id` |
| GET | `/company/jobs/:id/applications` | candidaturas ordenadas por `rankApplications`, cada uma com `matchScore`, `matchedTechnologies`, `missingTechnologies` |
| POST | `/company/jobs/:id/cancel` | fecha **sem contratação**: 404/403 como `/close`; 400 `Esta vaga já está fechada`. Numa transação: `status='closed'`, `hired_application_id=NULL`, candidaturas `em_analise` → `nao_selecionado`. Responde a vaga |

### E-mails de retorno
- Disparados por `/close` (motivo `outro_candidato`) e `/cancel` (motivo `vaga_encerrada`), um por candidatura que passou de `em_analise` para `nao_selecionado` **naquela operação** (nunca para o contratado nem para quem já estava não selecionado).
- Conteúdo (`server/rejection-emails.js`, função pura `buildRejectionEmail`): pt-BR, primeiro nome, título da vaga e empresa; HTML com todos os valores escapados.
  - `outro_candidato`: outra pessoa com perfil mais alinhado foi selecionada; % das tecnologias atendidas, lista das atendidas e das que "fortaleceriam seu perfil"; nota de senioridade se o nível do perfil difere do da vaga; com 100% das tecnologias, a decisão "se deu por outros fatores".
  - `vaga_encerrada`: vaga encerrada sem contratação, sem relação com o perfil; até 3 vagas abertas recomendadas (`matchJobs`, excluindo as já candidatadas) com título, empresa e %, ou "veja as vagas abertas".
- Envio (`server/mailer.js`, nodemailer) **depois do commit**, fora do ciclo da resposta (`setImmediate`); erros nunca afetam a resposta HTTP. Tabela `emails (id, to_email, to_user_id, subject, text, html, reason, job_id, status 'sent'|'failed', error, created_at)` registra todo envio. `mailer.idle()` (em `app.locals.mailer`) permite aos testes aguardar; `createApp` aceita `mailer`/`mailTransport` (testes usam transporte falso, sem rede).
- Transporte: `SMTP_URL` se definido; senão, com `SMTP_PASS`, SMTP em `SMTP_HOST` (padrão `smtp.gmail.com`) / `SMTP_PORT` (465, TLS) / `SMTP_USER`; sem senha, `jsonTransport` (nada sai da máquina) e aviso na inicialização. Remetente `MAIL_FROM`. `MAIL_REDIRECT_TO` entrega tudo nesse endereço, com assunto prefixado `[para: original]`; a tabela guarda o destinatário e assunto originais.
- `GET /dev/emails` (só com `NODE_ENV !== 'production'`, sem autenticação): últimos 50 `{id, toEmail, subject, reason, jobId, status, error, html, text, createdAt}`, mais recentes primeiro. Usado pela caixa de demonstração `/emails.html`.
