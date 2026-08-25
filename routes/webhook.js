/**
 * PASSO 4 — POST /webhook-mercadopago
 * Recebe as notificações do Mercado Pago sobre a ASSINATURA (subscription /
 * preapproval), confirma o status real consultando a API (nunca confia no
 * que vem só na notificação) e libera/revoga o PRO de acordo.
 *
 * status da assinatura:
 *   - "authorized" -> cobrança ativa, libera PRO
 *   - "cancelled" / "paused" (ou qualquer outro) -> revoga PRO
 */
const crypto = require('crypto');
const express = require('express');
const { preapproval } = require('../lib/mercadopago');
const { definirPro } = require('../lib/db');

const router = express.Router();

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

function extrairPreapprovalId(req) {
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

const TIPOS_ASSINATURA = ['subscription_preapproval', 'preapproval'];

router.post('/webhook-mercadopago', async (req, res) => {
    const tipo = extrairTipo(req);
    const preapprovalId = extrairPreapprovalId(req);

              if (tipo && !TIPOS_ASSINATURA.includes(tipo)) {
                    return res.sendStatus(200);
              }

              if (!preapprovalId) {
                    console.warn('[webhook] notificação sem id de assinatura, ignorando:', req.body, req.query);
                    return res.sendStatus(200);
              }

              if (!assinaturaValida(req, preapprovalId)) {
                    console.warn('[webhook] assinatura HMAC inválida, ignorando notificação.');
                    return res.sendStatus(200);
              }

              try {
                    const sub = await preapproval.get({ id: preapprovalId });
                    const email = sub.external_reference;

      if (!email) {
              console.warn(`[webhook] assinatura ${preapprovalId} sem external_reference.`);
              return res.sendStatus(200);
      }

      if (sub.status === 'authorized') {
              definirPro(email, true);
              console.log(`[webhook] PRO liberado (assinatura ativa) para ${email} (preapproval ${preapprovalId})`);
      } else {
              definirPro(email, false);
              console.log(`[webhook] PRO revogado (status="${sub.status}") para ${email} (preapproval ${preapprovalId})`);
      }

      return res.sendStatus(200);
              } catch (err) {
                    console.error('[webhook] erro ao consultar/processar assinatura:', err);
                    return res.sendStatus(200);
              }
});

module.exports = router;
