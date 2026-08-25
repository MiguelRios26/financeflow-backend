/**
 * PASSO 4 — POST /webhook-mercadopago
 * Recebe as notificações do Mercado Pago, confirma o status real do
 * pagamento (nunca confie só no que vem na notificação) e libera o PRO.
 */
const crypto = require('crypto');
const express = require('express');
const { payment } = require('../lib/mercadopago');
const { definirPro } = require('../lib/db');

const router = express.Router();

/**
 * Validação opcional (mas recomendada em produção) da assinatura do
 * webhook, usando a "Chave secreta" configurada no painel do Mercado Pago
 * (Suas integrações > Webhooks > Assinatura secreta).
 * Se MP_WEBHOOK_SECRET não estiver definido, a validação é pulada (útil
 * pra testar rápido em dev), mas fica logado um aviso.
 */
function assinaturaValida(req, paymentId) {
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

  const manifest = `id:${paymentId};request-id:${xRequestId};ts:${ts};`;
  const hashCalculado = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  return hashCalculado === v1;
}

function extrairPaymentId(req) {
  // O Mercado Pago manda a notificação de formas ligeiramente diferentes
  // dependendo de onde ela foi configurada (painel vs. notification_url
  // da preferência), então checamos todas as variações conhecidas.
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

  // Responde 200 cedo pra notificações que não são de pagamento (ex:
  // merchant_order) — não há nada pra fazer com elas aqui.
  if (tipo && tipo !== 'payment') {
    return res.sendStatus(200);
  }

  if (!paymentId) {
    console.warn('[webhook] notificação sem payment id, ignorando:', req.body, req.query);
    return res.sendStatus(200);
  }

  if (!assinaturaValida(req, paymentId)) {
    console.warn('[webhook] assinatura inválida, ignorando notificação.');
    return res.sendStatus(200);
  }

  try {
    // NUNCA confie no status que vem na notificação — sempre confirme
    // consultando a API do Mercado Pago com o id do pagamento.
    const pagamento = await payment.get({ id: paymentId });

    if (pagamento.status === 'approved') {
      const email = pagamento.external_reference;
      if (email) {
        definirPro(email, true);
        console.log(`[webhook] PRO liberado para ${email} (payment ${paymentId})`);
      } else {
        console.warn(`[webhook] pagamento ${paymentId} aprovado mas sem external_reference.`);
      }
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
