// Recebe notificações do Mercado Pago e sincroniza a assinatura. Sempre consulta a API (nunca confia no corpo recebido).
import { admin, json } from '../_shared/http.ts';
import { assinaturaValida, cancelarAssinatura, obterAssinatura } from '../_shared/mercadopago.ts';

const CARENCIA_DIAS = 3; // tolerância para a cobrança da renovação ser processada

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const corpo = await req.json().catch(() => ({}));
  const tipo: string = corpo.type || url.searchParams.get('type') || corpo.topic || '';
  const dataId: string = String(corpo?.data?.id ?? url.searchParams.get('data.id') ?? '');
  if (!dataId) return json({ ok: true });

  if (!(await assinaturaValida(req.headers.get('x-signature'), req.headers.get('x-request-id'), dataId, Deno.env.get('MP_WEBHOOK_SECRET') || ''))) {
    return json({ erro: 'assinatura inválida' }, 401);
  }
  const db = admin();
  await db.from('eventos_pagamento').insert({ tipo, recurso_id: dataId, corpo });

  try {
    let preapprovalId = dataId;
    if (tipo === 'subscription_authorized_payment') {
      const r = await fetch(`https://api.mercadopago.com/authorized_payments/${dataId}`, { headers: { Authorization: `Bearer ${Deno.env.get('MP_ACCESS_TOKEN')}` } });
      preapprovalId = (await r.json()).preapproval_id;
    } else if (tipo !== 'subscription_preapproval') {
      return json({ ok: true });
    }
    const a = await obterAssinatura(preapprovalId);
    const [userId, plano] = String(a.external_reference || '').split('|');
    if (!userId) return json({ ok: true });

    const { data: atual } = await db.from('assinaturas').select('valido_ate, mp_preapproval_id, status').eq('user_id', userId).maybeSingle();
    // Notificação atrasada de uma assinatura antiga não pode sobrescrever a atual.
    if (atual?.mp_preapproval_id && atual.mp_preapproval_id !== a.id && atual.status === 'authorized' && a.status !== 'authorized') return json({ ok: true });
    // Nova assinatura autorizada substitui a anterior: cancela a antiga para não cobrar duas vezes.
    if (atual?.mp_preapproval_id && atual.mp_preapproval_id !== a.id && a.status === 'authorized') {
      await cancelarAssinatura(atual.mp_preapproval_id).catch((e) => console.error('cancelar antiga', e));
    }
    let validoAte: string | null = atual?.valido_ate ?? null;
    if (a.status === 'authorized' && a.next_payment_date) {
      const ate = new Date(new Date(a.next_payment_date).getTime() + CARENCIA_DIAS * 864e5);
      if (!validoAte || ate > new Date(validoAte)) validoAte = ate.toISOString();
    }
    await db.from('assinaturas').upsert({
      user_id: userId, plano: plano || null, mp_preapproval_id: a.id, status: a.status, valido_ate: validoAte,
      atualizado_em: new Date().toISOString(),
    });
    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ erro: 'falha ao sincronizar' }, 500); // o Mercado Pago reenvia
  }
});
