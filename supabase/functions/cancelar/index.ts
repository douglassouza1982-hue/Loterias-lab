// Cancela a renovação. O acesso continua até "valido_ate" (fim do período já pago).
import { admin, cors, json, usuarioDa } from '../_shared/http.ts';
import { cancelarAssinatura } from '../_shared/mercadopago.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const user = await usuarioDa(req);
  if (!user) return json({ erro: 'Entre na sua conta.' }, 401);
  const db = admin();
  const { data } = await db.from('assinaturas').select('mp_preapproval_id').eq('user_id', user.id).maybeSingle();
  if (!data?.mp_preapproval_id) return json({ erro: 'Nenhuma assinatura ativa.' }, 404);
  try {
    await cancelarAssinatura(data.mp_preapproval_id);
    await db.from('assinaturas').update({ status: 'cancelled', atualizado_em: new Date().toISOString() }).eq('user_id', user.id);
    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ erro: 'Não foi possível cancelar agora.' }, 502);
  }
});
