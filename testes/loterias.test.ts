// Rode com: node --experimental-strip-types --test testes/loterias.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { JOGOS, gerar, normalizar, padroesPopulares, semanaBR, sortear } from '../supabase/functions/_shared/loterias.ts';
import { assinaturaValida } from '../supabase/functions/_shared/mercadopago.ts';

test('sortear devolve números distintos, ordenados e no intervalo', () => {
  for (let i = 0; i < 2000; i++) {
    const a = sortear(100, 0, 50);
    assert.equal(new Set(a).size, 50);
    assert.ok(a.every((n, k) => n >= 0 && n <= 99 && (k === 0 || n > a[k - 1])));
  }
});

test('sorteio é uniforme (qui-quadrado grosseiro)', () => {
  const f = new Array(60).fill(0), R = 60000;
  for (let i = 0; i < R; i++) sortear(60, 1, 6).forEach((n) => f[n - 1]++);
  const E = (R * 6) / 60;
  const x = f.reduce((s, o) => s + (o - E) ** 2 / E, 0);
  assert.ok(x < 110, `qui-quadrado alto demais: ${x}`); // df=59, p≈1e-4 em ~105
});

test('plano grátis: sempre 1 aposta simples com filtro, ignora pedidos maiores', () => {
  const n = normalizar({ modalidade: 'megasena', numeros: 15, jogos: 10, filtro: false }, false);
  assert.deepEqual([n.numeros, n.jogos, n.filtro], [6, 1, true]);
  const r = gerar({ modalidade: 'megasena', numeros: 15, jogos: 10 }, false);
  assert.equal(r.length, 1);
  assert.equal(r[0].numeros.length, 6);
  assert.deepEqual(padroesPopulares(JOGOS.megasena, r[0].numeros), []);
});

test('assinante: respeita limites de números e jogos', () => {
  const r = gerar({ modalidade: 'megasena', numeros: 99, jogos: 99 }, true);
  assert.equal(r.length, 10);
  assert.equal(r[0].numeros.length, 20);
  const m = gerar({ modalidade: 'maismilionaria', numeros: 8, trevos: 3, jogos: 2 }, true);
  assert.equal(m[0].numeros.length, 8);
  assert.equal(m[0].trevos!.length, 3);
});

test('extras: mês do Dia de Sorte e colunas do Super Sete', () => {
  const d = gerar({ modalidade: 'diadesorte' }, false)[0];
  assert.ok(d.mes! >= 1 && d.mes! <= 12);
  const s = gerar({ modalidade: 'supersete', jogos: 3 }, true);
  assert.ok(s.every((j) => j.numeros.length === 7 && j.numeros.every((x) => x >= 0 && x <= 9)));
});

test('modalidade inválida é recusada', () => {
  assert.throws(() => normalizar({ modalidade: 'bicho' }, true));
});

test('padrões populares são detectados', () => {
  const j = JOGOS.megasena;
  assert.ok(padroesPopulares(j, [1, 5, 12, 19, 25, 30]).includes('datas'));
  assert.ok(padroesPopulares(j, [10, 11, 12, 40, 50, 60]).includes('sequencia'));
  assert.ok(padroesPopulares(j, [5, 15, 25, 35, 45, 55]).includes('progressao'));
  assert.deepEqual(padroesPopulares(j, [2, 17, 33, 38, 49, 58]), []);
});

test('semana vira na segunda 00h de Brasília', () => {
  assert.equal(semanaBR(new Date('2026-10-26T02:59:00Z')), semanaBR(new Date('2026-10-25T12:00:00Z'))); // dom 23h59 BRT
  assert.notEqual(semanaBR(new Date('2026-10-26T03:00:00Z')), semanaBR(new Date('2026-10-26T02:59:00Z'))); // seg 00h BRT
  assert.equal(semanaBR(new Date('2026-10-22T15:00:00Z')), '2026-S43');
  assert.equal(semanaBR(new Date('2027-01-01T15:00:00Z')), '2026-S53');
});

test('assinatura do webhook do Mercado Pago', async () => {
  const segredo = 'segredo-teste', ts = '1704908010';
  const v1 = createHmac('sha256', segredo).update(`id:123456;request-id:abc-1;ts:${ts};`).digest('hex');
  assert.equal(await assinaturaValida(`ts=${ts},v1=${v1}`, 'abc-1', '123456', segredo), true);
  assert.equal(await assinaturaValida(`ts=${ts},v1=${v1}`, 'abc-2', '123456', segredo), false);
  assert.equal(await assinaturaValida(null, 'abc-1', '123456', segredo), false);
});
