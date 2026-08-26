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

  // MP recomenda usar o id em minúsculas no manifest quando ele não é
  // puramente numérico (caso dos ids de assinatura, que são alfanuméricos).
  const manifest = `id:${String(id).toLowerCase()};request-id:${xRequestId};ts:${ts};`;
      const hashCalculado = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  return hashCalculado === v1;
}

function extrairPreapprovalId(req) {
      // O Mercado Pago manda a notificação de formas ligeiramente diferentes
  // dependendo de onde ela foi configurada (painel vs. notification_url da
  // assinatura), então checamos todas as variações conhecidas.
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

// Tipos de notificação relevantes pra assinatura (o MP usa nomes um pouco
// diferentes dependendo da versão/origem do evento).
const TIPOS_ASSINATURA = ['subscription_preapproval', 'preapproval'];

router.post('/webhook-mercadopago', async (req, res) => {
      const tipo = extrairTipo(req);
      const preapprovalId = extrairPreapprovalId(req);

              // Ignora notificações que não são sobre a assinatura em si (ex: cobranças
              // individuais/"subscription_authorized_payment") — o status da assinatura
              // já é a fonte da verdade sobre liberar ou não o PRO.
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
                      // NUNCA confie no status que vem na notificação — sempre confirme
        // consultando a API do Mercado Pago com o id da assinatura.
        const sub = await preapproval.get({ id: preapprovalId });
                      // Assinaturas criadas a partir do link fixo do plano (painel do Mercado
        // Pago) não têm external_reference — nesse caso usamos o payer_email
        // (e-mail que a pessoa usou pra pagar) como identificador do usuário.
        const email = (sub.external_reference || sub.payer_email || '').toLowerCase();

        if (!email) {
                  console.warn(`[webhook] assinatura ${preapprovalId} sem external_reference nem payer_email.`);
                  return res.sendStatus(200);
        }

        if (sub.status === 'authorized') {
                  definirPro(email, true);
                  console.log(`[webhook] PRO liberado (assinatura ativa) para ${email} (preapproval ${preapprovalId})`);
        } else {
                  // cancelled, paused, ou qualquer outro status -> revoga o acesso.
                        definirPro(email, false);
                  console.log(`[webhook] PRO revogado (status="${sub.status}") para ${email} (preapproval ${preapprovalId})`);
        }

        return res.sendStatus(200);
              } catch (err) {
                      console.error('[webhook] erro ao consultar/processar assinatura:', err);
                      // 200 mesmo em erro evita uma tempestade de reenvios do MP; o ideal em
        // produção é logar isso em um serviço de observabilidade (Sentry etc.)
        return res.sendStatus(200);
              }
});

module.exports = router;
