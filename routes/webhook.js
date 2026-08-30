/**
 * PASSO 4 — POST /webhook-mercadopago
 * Recebe as notificações do Mercado Pago sobre o PAGAMENTO ÚNICO (Checkout
 * Pro), confirma o status real consultando a API (nunca confia no que vem só
 * na notificação) e libera o PRO quando aprovado.
 *
 * status do pagamento:
 * - "approved" -> libera PRO
 * - "refunded" / "charged_back" -> revoga PRO (estorno/contestação)
 * - qualquer outro ("pending", "in_process", "rejected" etc.) -> ignora
 */
const crypto = require('crypto');
const express = require('express');
const { payment } = require('../lib/mercadopago');
const { definirPro } = require('../lib/db');

const router = express.Router();

/**
 * Validação opcional (mas recomendada em produção) da assinatura HMAC do
 * webhook, usando a "Chave secreta" configurada no painel do Mercado Pago
 * (Suas integrações > Webhooks > Assinatura secreta).
 * Se MP_WEBHOOK_SECRET não estiver definido, a validação é pulada (útil
 * pra testar rápido em dev), mas fica logado um aviso.
 */
function assinaturaValida(req, id) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('[webhook] MP_WEBHOOK_SECRET não configurado — pulando validação de assinatura.');
    return true;
  }

  const xSignature = req.headers['x-signature'];
  const xRequestId = req.headers['x-request-id'];
  if (!xSignature || !xRequestId) return false;

  const partes = Object.fromEntries(
    xSignature.split(',').map((p) => p.trim().split('=').map((s) => s.trim()))
  );
  const { ts, v1 } = partes;
  if (!ts || !v1) return false;

  const manifest = `id:${String(id).toLowerCase()};request-id:${xRequestId};ts:${ts};`;
  const hashCalculado = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  return hashCalculado === v1;
}

function extrairPaymentId(req) {
  // O Mercado Pago manda a notificação de formas ligeiramente diferentes
  // dependendo de onde ela foi configurada, então checamos todas as
  // variações conhecidas.
  return (
    req.body?.data?.id ||
    req.query['data.id'] ||
    req.body?.id ||
    req.query.id ||
    null
  );
}

function extrairTipo(req) {
  return req.body?.type || req.body?.topic || req.query.type || req.query.topic || null;
}

router.post('/webhook-mercadopago', async (req, res) => {
  const tipo = extrairTipo(req);
  const paymentId = extrairPaymentId(req);

  // Só nos interessam notificações de pagamento (agora é pagamento único,
  // não assinatura) — ignora outros tipos de evento (ex: "merchant_order").
  if (tipo && tipo !== 'payment') {
    return res.sendStatus(200);
  }

  if (!paymentId) {
    console.warn('[webhook] notificação sem id de pagamento, ignorando:', req.body, req.query);
    return res.sendStatus(200);
  }

  if (!assinaturaValida(req, paymentId)) {
    console.warn('[webhook] assinatura HMAC inválida, ignorando notificação.');
    return res.sendStatus(200);
  }

  try {
    // NUNCA confie no status que vem na notificação — sempre confirme
    // consultando a API do Mercado Pago com o id do pagamento.
    const pag = await payment.get({ id: paymentId });
    const email = (pag.external_reference || pag.payer?.email || '').toLowerCase();

    if (!email) {
      console.warn(`[webhook] pagamento ${paymentId} sem external_reference nem payer.email.`);
      return res.sendStatus(200);
    }

    if (pag.status === 'approved') {
      definirPro(email, true);
      console.log(`[webhook] PRO liberado (pagamento aprovado) para ${email} (payment ${paymentId})`);
    } else if (pag.status === 'refunded' || pag.status === 'charged_back') {
      definirPro(email, false);
      console.log(`[webhook] PRO revogado (status="${pag.status}") para ${email} (payment ${paymentId})`);
    } else {
      console.log(`[webhook] pagamento ${paymentId} com status="${pag.status}" — nenhuma ação.`);
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error('[webhook] erro ao consultar/processar pagamento:', err);
    // 200 mesmo em erro evita uma tempestade de reenvios do MP; o ideal em
    // produção é logar isso em um serviço de observabilidade (Sentry etc.)
    return res.sendStatus(200);
  }
});

module.exports = router;
