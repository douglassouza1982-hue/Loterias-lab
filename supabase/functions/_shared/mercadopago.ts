// Assinaturas (preapproval) do Mercado Pago. Docs: https://www.mercadopago.com.br/developers/pt/reference/subscriptions/_preapproval/post
const API = 'https://api.mercadopago.com';

export const PLANOS = {
  mensal: { valor: 7.99, meses: 1, nome: 'Laboratório das Loterias · mensal' },
  anual: { valor: 59.0, meses: 12, nome: 'Laboratório das Loterias · anual' },
} as const;
export type Plano = keyof typeof PLANOS;

async function mp(caminho: string, init: RequestInit = {}) {
  const r = await fetch(API + caminho, {
    ...init,
    headers: { Authorization: `Bearer ${Deno.env.get('MP_ACCESS_TOKEN')}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Mercado Pago ${r.status}: ${JSON.stringify(corpo)}`);
  return corpo;
}

export function criarAssinatura(o: { userId: string; email: string; plano: Plano; voltarPara: string }) {
  const p = PLANOS[o.plano];
  return mp('/preapproval', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({
      reason: p.nome,
      external_reference: `${o.userId}|${o.plano}`,
      payer_email: o.email,
      back_url: o.voltarPara,
      status: 'pending',
      auto_recurring: { frequency: p.meses, frequency_type: 'months', transaction_amount: p.valor, currency_id: 'BRL' },
    }),
  });
}

export const obterAssinatura = (id: string) => mp(`/preapproval/${encodeURIComponent(id)}`);
export const cancelarAssinatura = (id: string) =>
  mp(`/preapproval/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) });

/** Valida o cabeçalho x-signature (ts=...,v1=...) com a chave secreta do webhook. */
export async function assinaturaValida(xSignature: string | null, xRequestId: string | null, dataId: string, segredo: string) {
  if (!xSignature || !segredo) return false;
  const partes = Object.fromEntries(xSignature.split(',').map((p) => p.trim().split('=') as [string, string]));
  if (!partes.ts || !partes.v1) return false;
  let manifesto = `id:${dataId.toLowerCase()};`;
  if (xRequestId) manifesto += `request-id:${xRequestId};`;
  manifesto += `ts:${partes.ts};`;
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(manifesto)));
  const hex = Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('');
  if (hex.length !== partes.v1.length) return false;
  let dif = 0;
  for (let i = 0; i < hex.length; i++) dif |= hex.charCodeAt(i) ^ partes.v1.charCodeAt(i);
  return dif === 0;
}
