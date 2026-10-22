// Baixa os concursos que faltam em web/data/*.json. Fonte principal: API pública da Caixa; reserva: loteriascaixa-api.
// Uso: node scripts/atualizar-dados.mjs   (Node 20+, sem dependências)
import { readFile, writeFile } from 'node:fs/promises';

const PASTA = new URL('../web/data/', import.meta.url);
const MODALIDADES = ['megasena', 'lotofacil', 'quina', 'lotomania', 'timemania', 'duplasena', 'diadesorte', 'supersete', 'maismilionaria'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const TAMANHO = { megasena: 6, lotofacil: 15, quina: 5, lotomania: 20, timemania: 7, duplasena: 12, diadesorte: 7, supersete: 7, maismilionaria: 6 };
const MAX_POR_EXECUCAO = 600;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const FONTES = process.env.FONTE_TESTE ? [{ nome: 'teste', url: (m, n) => `${process.env.FONTE_TESTE}/${m}/${n ?? ''}` }] : [
  { nome: 'caixa', url: (m, n) => `https://servicebus2.caixa.gov.br/portaldeloterias/api/${m}/${n ?? ''}` },
  { nome: 'reserva', url: (m, n) => `https://loteriascaixa-api.herokuapp.com/api/${m}/${n ?? 'latest'}` },
];

async function baixar(fonte, m, n) {
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      const r = await fetch(fonte.url(m, n), { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (loterias-lab)' }, signal: AbortSignal.timeout(20000) });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (tentativa === 2) throw e;
      await espera(1500 * (tentativa + 1));
    }
  }
}

const ints = (lista) => (lista || []).map((x) => parseInt(String(x), 10)).filter(Number.isFinite);

/** Converte a resposta de qualquer fonte no formato compacto { numero, n, x }. */
function normalizar(m, j) {
  const numero = j.numero ?? j.concurso;
  if (!numero) return null;
  let n, x;
  if (m === 'supersete') n = ints(j.listaDezenas ?? j.dezenas);                       // ordem das colunas
  else if (m === 'duplasena') {
    const um = ints(j.listaDezenas ?? j.dezenas?.slice(0, 6)).sort((a, b) => a - b);
    const dois = ints(j.listaDezenasSegundoSorteio ?? j.dezenas?.slice(6, 12)).sort((a, b) => a - b);
    n = [...um, ...dois];
  } else n = ints(j.listaDezenas ?? j.dezenas).sort((a, b) => a - b);
  if (m === 'diadesorte') {
    const nome = String(j.nomeTimeCoracaoMesSorte ?? j.mesSorte ?? '').trim().toLowerCase();
    x = MESES.indexOf(nome) + 1;
    if (!x) return null;
  }
  if (m === 'maismilionaria') {
    x = ints(j.trevosSorteados ?? j.listaTrevos ?? j.trevos).sort((a, b) => a - b);
    if (x.length !== 2) return null;
  }
  if (n.length !== TAMANHO[m]) return null;
  return { numero: Number(numero), n, x };
}

async function atualizar(m) {
  const arq = new URL(`${m}.json`, PASTA);
  const dados = JSON.parse(await readFile(arq, 'utf8'));
  let novos = 0, fonteUsada = null;
  for (const fonte of FONTES) {
    try {
      const ultimo = normalizar(m, await baixar(fonte, m));
      if (!ultimo) throw new Error('resposta sem concurso');
      for (let c = dados.n.length + 1; c <= ultimo.numero && novos < MAX_POR_EXECUCAO; c++) {
        const r = c === ultimo.numero ? ultimo : normalizar(m, await baixar(fonte, m, c));
        if (!r || r.numero !== c) throw new Error(`concurso ${c} ausente ou inválido`);
        dados.n.push(r.n);
        if (r.x !== undefined) dados.x.push(r.x);
        novos++;
        await espera(120);
      }
      fonteUsada = fonte.nome;
      break;
    } catch (e) {
      console.warn(`${m}: fonte ${fonte.nome} falhou (${e.message})`);
    }
  }
  if (novos) await writeFile(arq, JSON.stringify(dados));
  console.log(`${m}: ${novos} concurso(s) novo(s), total ${dados.n.length}${fonteUsada ? ` [${fonteUsada}]` : ''}`);
  return { novos, total: dados.n.length, ok: !!fonteUsada };
}

const meta = { atualizado_em: new Date().toISOString(), ultimo: {} };
let totalNovos = 0, falhas = 0;
for (const m of MODALIDADES) {
  const r = await atualizar(m);
  meta.ultimo[m] = r.total; totalNovos += r.novos; if (!r.ok) falhas++;
}
if (totalNovos) await writeFile(new URL('meta.json', PASTA), JSON.stringify(meta));
console.log(`Concluído: ${totalNovos} novo(s), ${falhas} modalidade(s) sem fonte disponível.`);
if (falhas === MODALIDADES.length) process.exit(1);
