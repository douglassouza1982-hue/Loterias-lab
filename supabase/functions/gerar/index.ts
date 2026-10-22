// Gera combinações. Quem sorteia e controla a cota do plano grátis é o servidor, não o navegador.
import { gerar, normalizar, semanaBR, type Pedido } from '../_shared/loterias.ts';
import { admin, cors, eAssinante, json, usuarioDa } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);
  const user = await usuarioDa(req);
  if (!user) return json({ erro: 'Entre na sua conta para gerar combinações.' }, 401);

  let pedido: Pedido;
  try { pedido = await req.json(); normalizar(pedido, false); } catch { return json({ erro: 'Pedido inválido.' }, 400); }

  const db = admin();
  const assinante = await eAssinante(db, user.id);
  const jogos = gerar(pedido, assinante);
  const { error } = await db.from('geracoes').insert({
    user_id: user.id, modalidade: pedido.modalidade, semana: semanaBR(), gratis: !assinante, resultado: jogos,
  });
  if (error) {
    // 23505 = violação do índice único da cota grátis
    if (error.code === '23505') return json({ erro: 'Você já usou sua combinação grátis desta modalidade nesta semana. Assine para gerar sem limite.' }, 429);
    console.error(error);
    return json({ erro: 'Não foi possível gerar agora. Tente de novo.' }, 500);
  }
  return json({ jogos, gratis: !assinante });
});
