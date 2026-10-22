// Regras das modalidades e sorteio criptográfico. Sem dependências de Deno: também roda em Node para testes.

export type Jogo = {
  nome: string; N: number; min: number; k: number; bmin: number; bmax: number; cols: number;
  mes?: boolean; trevos?: boolean; super7?: boolean;
};

export const JOGOS: Record<string, Jogo> = {
  megasena: { nome: 'Mega-Sena', N: 60, min: 1, k: 6, bmin: 6, bmax: 20, cols: 10 },
  lotofacil: { nome: 'Lotofácil', N: 25, min: 1, k: 15, bmin: 15, bmax: 20, cols: 5 },
  quina: { nome: 'Quina', N: 80, min: 1, k: 5, bmin: 5, bmax: 15, cols: 10 },
  lotomania: { nome: 'Lotomania', N: 100, min: 0, k: 20, bmin: 50, bmax: 50, cols: 10 },
  timemania: { nome: 'Timemania', N: 80, min: 1, k: 7, bmin: 10, bmax: 10, cols: 10 },
  duplasena: { nome: 'Dupla Sena', N: 50, min: 1, k: 6, bmin: 6, bmax: 15, cols: 10 },
  diadesorte: { nome: 'Dia de Sorte', N: 31, min: 1, k: 7, bmin: 7, bmax: 15, cols: 7, mes: true },
  maismilionaria: { nome: '+Milionária', N: 50, min: 1, k: 6, bmin: 6, bmax: 12, cols: 10, trevos: true },
  supersete: { nome: 'Super Sete', N: 10, min: 0, k: 7, bmin: 7, bmax: 7, cols: 10, super7: true },
};

export const LIMITES = { gratis: { jogos: 1 }, assinante: { jogos: 10 } };

/** Inteiro uniforme em [0, n) sem viés de módulo. */
export function inteiroSeguro(n: number): number {
  const a = new Uint32Array(1);
  const lim = Math.floor(4294967296 / n) * n;
  do { crypto.getRandomValues(a); } while (a[0] >= lim);
  return a[0] % n;
}

/** b números distintos de {min, ..., min+N-1}, em ordem crescente (Fisher-Yates parcial). */
export function sortear(N: number, min: number, b: number): number[] {
  const pool = Array.from({ length: N }, (_, i) => i + min);
  for (let i = 0; i < b; i++) {
    const j = i + inteiroSeguro(N - i);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, b).sort((x, y) => x - y);
}

/** Padrões muito escolhidos por apostadores. Não mudam a chance de ganhar, só a de dividir o prêmio. */
export function padroesPopulares(j: Jogo, a: number[]): string[] {
  if (j.k > 7) return [];
  const s = [...a].sort((x, y) => x - y);
  const achados: string[] = [];
  if (j.N > 31 && s.every((n) => n <= 31)) achados.push('datas');
  let seq = 1, maxSeq = 1;
  for (let i = 1; i < s.length; i++) { seq = s[i] === s[i - 1] + 1 ? seq + 1 : 1; maxSeq = Math.max(maxSeq, seq); }
  if (maxSeq >= 3) achados.push('sequencia');
  const dif = s.slice(1).map((x, i) => x - s[i]);
  if (dif.every((x) => x === dif[0])) achados.push('progressao');
  const lin: Record<number, number> = {}, col: Record<number, number> = {}, fim: Record<number, number> = {};
  for (const n of s) {
    const i = n - j.min;
    lin[Math.floor(i / j.cols)] = (lin[Math.floor(i / j.cols)] || 0) + 1;
    col[i % j.cols] = (col[i % j.cols] || 0) + 1;
    fim[n % 10] = (fim[n % 10] || 0) + 1;
  }
  if (Math.max(...Object.values(lin), ...Object.values(col)) >= 4) achados.push('volante');
  if (Math.max(...Object.values(fim)) >= 4) achados.push('final');
  return achados;
}

export type Pedido = { modalidade: string; numeros?: number; trevos?: number; jogos?: number; filtro?: boolean };
export type Combinacao = { numeros: number[]; trevos?: number[]; mes?: number };

/** Normaliza o pedido conforme o plano: no grátis, sempre 1 aposta simples com filtro. */
export function normalizar(p: Pedido, assinante: boolean) {
  const j = JOGOS[p.modalidade];
  if (!j) throw new Error('Modalidade inválida.');
  const lim = assinante ? LIMITES.assinante : LIMITES.gratis;
  const inteiro = (v: unknown, lo: number, hi: number, padrao: number) => {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) ? Math.min(Math.max(n, lo), hi) : padrao;
  };
  return {
    j,
    numeros: assinante ? inteiro(p.numeros, j.bmin, j.bmax, j.bmin) : j.bmin,
    trevos: assinante ? inteiro(p.trevos, 2, 6, 2) : 2,
    jogos: inteiro(p.jogos, 1, lim.jogos, 1),
    filtro: assinante ? p.filtro !== false : true,
  };
}

export function gerar(p: Pedido, assinante: boolean): Combinacao[] {
  const { j, numeros, trevos, jogos, filtro } = normalizar(p, assinante);
  const saida: Combinacao[] = [];
  for (let n = 0; n < jogos; n++) {
    let a: number[];
    if (j.super7) a = Array.from({ length: 7 }, () => inteiroSeguro(10));
    else {
      let tentativas = 0;
      do { a = sortear(j.N, j.min, numeros); tentativas++; } while (filtro && tentativas < 500 && padroesPopulares(j, a).length);
    }
    const c: Combinacao = { numeros: a };
    if (j.mes) c.mes = inteiroSeguro(12) + 1;
    if (j.trevos) c.trevos = sortear(6, 1, trevos);
    saida.push(c);
  }
  return saida;
}

/** Semana ISO no fuso de Brasília (UTC-3, sem horário de verão desde 2019). Vira toda segunda às 00h. */
export function semanaBR(d = new Date()): string {
  const t = new Date(d.getTime() - 3 * 3600e3);
  const x = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
  const dia = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - dia);
  const ini = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((x.getTime() - ini.getTime()) / 864e5 + 1) / 7);
  return `${x.getUTCFullYear()}-S${String(semana).padStart(2, '0')}`;
}
