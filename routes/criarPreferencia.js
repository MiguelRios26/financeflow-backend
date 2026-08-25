/**
 * PASSO 3 — POST /api/criar-preferencia-mp
 * Cria uma ASSINATURA MENSAL RECORRENTE (API de Assinaturas / PreApproval do
 * Mercado Pago — não é mais um pagamento único) e devolve o init_point para
 * o front-end redirecionar o usuário e autorizar a cobrança recorrente.
 *
 * Mantém o mesmo nome de rota (/api/criar-preferencia-mp) por compatibilidade
 * com o front-end (premium-paywall.js), mesmo por baixo dos panos agora ser
 * uma assinatura em vez de uma "preferência" de pagamento único.
 */
const express = require('express');
const { preapproval } = require('../lib/mercadopago');

const router = express.Router();

const PRECO_PRO_MENSAL = 29.9;
const MOTIVO_ASSINATURA = 'Plano PRO - FinanceFlow (assinatura mensal)';

router.post('/api/criar-preferencia-mp', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();

              if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
                    return res.status(400).json({ erro: 'E-mail inválido ou não informado.' });
              }

              const frontendUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    const backendUrl = (process.env.BACKEND_URL || '').replace(/\/$/, '');

              try {
                    const resultado = await preapproval.create({
                            body: {
                                      reason: MOTIVO_ASSINATURA,
                                      external_reference: email,
                                      payer_email: email,
                                      back_url: `${frontendUrl}/?status=sucesso`,
                                      notification_url: `${backendUrl}/webhook-mercadopago`,
                                      auto_recurring: {
                                                  frequency: 1,
                                                  frequency_type: 'months',
                                                  transaction_amount: PRECO_PRO_MENSAL,
                                                  currency_id: 'BRL',
                                      },
                                      status: 'pending',
                            },
                    });

      return res.json({ init_point: resultado.init_point });
              } catch (err) {
                    console.error('[criar-preferencia-mp] erro:', err);
                    return res.status(500).json({ erro: 'Não foi possível criar a assinatura.' });
              }
});

module.exports = router;
