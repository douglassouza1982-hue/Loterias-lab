// Cria a assinatura no Mercado Pago e devolve o link de pagamento.
import { admin, cors, json, usuarioDa } from '../_shared/http.ts';
import { criarAssinatura, PLANOS, type Plano } from '../_shared/mercadopago.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const user = await usuarioDa(req);
  if (!user?.email) return json({ erro: 'Entre na sua conta para assinar.' }, 401);
  const { plano } = await req.json().catch(() => ({}));
  if (!(plano in PLANOS)) return json({ erro: 'Plano inválido.' }, 400);

  const site = Deno.env.get('SITE_URL')!;
  try {
    const a = await criarAssinatura({ userId: user.id, email: user.email, plano: plano as Plano, voltarPara: `${site}?assinatura=retorno` });
    const db = admin();
    const { data: atual } = await db.from('assinaturas').select('valido_ate, status').eq('user_id', user.id).maybeSingle();
    // Com assinatura ativa, o registro só muda quando o webhook confirmar a nova (que então cancela a antiga).
    if (atual?.status !== 'authorized') await db.from('assinaturas').upsert({
      user_id: user.id, plano, mp_preapproval_id: a.id, status: a.status ?? 'pending',
      valido_ate: atual?.valido_ate ?? null, atualizado_em: new Date().toISOString(),
    });
    return json({ url: a.init_point });
  } catch (e) {
    console.error(e);
    return json({ erro: 'Não foi possível abrir o pagamento agora.' }, 502);
  }
});
