import { createDb } from './db.js';
import { createApp } from './app.js';
import { seed, DEMO_PASSWORD } from './seed.js';

const db = createDb();

const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get();
if (n === 0) {
  seed(db);
  console.log(`Banco vazio: dados de demonstração criados (senha dos usuários demo: ${DEMO_PASSWORD}).`);
}

const app = createApp({ db });
const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`Conecta Vagas rodando em http://localhost:${port}`);
});
