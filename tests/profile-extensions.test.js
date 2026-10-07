import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, register, COMPLETE_PROFILE } from './helpers.js';

async function put(agent, overrides) {
  return agent.put('/api/candidate/profile').send({ ...COMPLETE_PROFILE, ...overrides });
}

test('perfil salva país, UF, telefone e LinkedIn normalizados', async () => {
  const { app, cleanup } = setup();
  const agent = await register(app, 'candidate');
  const res = await put(agent, {
    country: '', state: 'sp', phone: '+55 11 98888-1111', linkedin: 'br.linkedin.com/in/maria/',
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.country, 'Brasil');
  assert.equal(res.body.state, 'SP');
  assert.equal(res.body.phone, '(11) 98888-1111');
  assert.equal(res.body.linkedin, 'https://www.linkedin.com/in/maria');
  assert.equal(res.body.resumePdf, null);

  const fixo = await put(agent, { phone: '1138881111' });
  assert.equal(fixo.body.phone, '(11) 3888-1111');

  const pt = await put(agent, { country: 'Portugal', state: 'Lisboa', phone: '+351 912 345 678' });
  assert.equal(pt.status, 200);
  assert.equal(pt.body.state, 'Lisboa');
  assert.equal(pt.body.phone, '+351 912 345 678');
  cleanup();
});

test('perfil rejeita contato inválido com mensagens claras', async () => {
  const { app, cleanup } = setup();
  const agent = await register(app, 'candidate');
  const cases = [
    [{ state: 'XX' }, 'Estado inválido'],
    [{ phone: '98888-1111' }, 'Telefone inválido. Use DDD + número, ex.: (11) 98888-1111'],
    [{ country: 'Portugal', phone: '123' }, 'Telefone inválido'],
    [{ linkedin: 'https://evil.com/in/ana' }, 'LinkedIn inválido. Use linkedin.com/in/seu-perfil'],
    [{ linkedin: 'javascript:alert(1)' }, 'LinkedIn inválido. Use linkedin.com/in/seu-perfil'],
    [{ country: 'x'.repeat(61) }, null],
  ];
  for (const [bad, msg] of cases) {
    const res = await put(agent, bad);
    assert.equal(res.status, 400, JSON.stringify(bad));
    if (msg) assert.equal(res.body.error, msg);
  }
  cleanup();
});

test('experiência atual limpa a data de fim; datas são validadas', async () => {
  const { app, cleanup } = setup();
  const agent = await register(app, 'candidate');
  const exp = { empresa: 'ACME', cargo: 'Dev', inicio: '2022-03', fim: '2023-01', descricao: '' };
  let res = await put(agent, { experiences: [{ ...exp, atual: true }] });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.experiences, [{ ...exp, fim: '', atual: true }]);

  res = await put(agent, { experiences: [{ ...exp, atual: 'false' }] });
  assert.deepEqual(res.body.experiences, [{ ...exp, atual: false }]);
  res = await put(agent, { experiences: [exp] });
  assert.equal(res.body.experiences[0].atual, false);

  res = await put(agent, { experiences: [{ ...exp, inicio: '2022-13' }] });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Data inválida (use AAAA-MM)');
  res = await put(agent, { experiences: [{ ...exp, fim: 'jan/2023' }] });
  assert.equal(res.body.error, 'Data inválida (use AAAA-MM)');
  res = await put(agent, { experiences: [{ ...exp, inicio: '2023-05', fim: '2023-04' }] });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'A data de fim deve ser posterior ao início');
  res = await put(agent, { experiences: [{ ...exp, inicio: '2023-05', fim: '2023-04', atual: true }] });
  assert.equal(res.status, 200);
  res = await put(agent, { experiences: [{ ...exp, atual: 'sim' }] });
  assert.equal(res.status, 400);
  cleanup();
});

test('formação: situação padrão concluído, em andamento aceito, inválida 400', async () => {
  const { app, cleanup } = setup();
  const agent = await register(app, 'candidate');
  const edu = { instituicao: 'USP', curso: 'Computação', conclusao: '2027-06' };
  let res = await put(agent, { education: [edu, { ...edu, situacao: '' }] });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.education, [{ ...edu, situacao: 'concluido' }, { ...edu, situacao: 'concluido' }]);
  res = await put(agent, { education: [{ ...edu, situacao: 'em_andamento' }] });
  assert.equal(res.body.education[0].situacao, 'em_andamento');
  res = await put(agent, { education: [{ ...edu, situacao: 'trancado' }] });
  assert.equal(res.status, 400);
  res = await put(agent, { education: [{ ...edu, conclusao: '2027' }] });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Data inválida (use AAAA-MM)');
  cleanup();
});

test('linhas antigas sem atual/situação recebem padrões', async () => {
  const { app, db, cleanup } = setup();
  const agent = await register(app, 'candidate');
  db.prepare('UPDATE candidates SET experiences = ?, education = ? WHERE user_id = ?').run(
    JSON.stringify([{ empresa: 'X', cargo: 'Y', inicio: '2020', fim: '', descricao: '' }]),
    JSON.stringify([{ instituicao: 'U', curso: 'C', conclusao: '2019' }]),
    agent.user.id,
  );
  const res = await agent.get('/api/candidate/profile');
  assert.equal(res.body.experiences[0].atual, false);
  assert.equal(res.body.education[0].situacao, 'concluido');
  cleanup();
});
