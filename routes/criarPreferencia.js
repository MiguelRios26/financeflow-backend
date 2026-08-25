/**
 * PASSO 3 — POST /api/criar-preferencia-mp
 * Cria a preferência de pagamento (Checkout Pro) e devolve o init_point
 * para o front-end redirecionar o usuário.
 */
const express = require('express');
const { preference } = require('../lib/mercadopago');

const router = express.Router();

const PRECO_PRO = 29.9;
const NOME_PRODUTO = 'Plano PRO - FinanceFlow';

router.post('/api/criar-preferencia-mp', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ erro: 'E-mail inválido ou não informado.' });
  }

  const frontendUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
  const backendUrl = (process.env.BACKEND_URL || '').replace(/\/$/, '');

  try {
    const resultado = await preference.create({
      body: {
        items: [
          {
            id: 'financeflow-pro',
            title: NOME_PRODUTO,
            description: 'Acesso completo a Investimentos, Metas e Educação Financeira',
            quantity: 1,
            unit_price: PRECO_PRO,
            currency_id: 'BRL',
          },
        ],
        payer: { email },
        // Essencial: é assim que o webhook (Passo 4) sabe QUEM pagou.
        external_reference: email,
        back_urls: {
          success: `${frontendUrl}/?status=sucesso`,
          pending: `${frontendUrl}/?status=pendente`,
          failure: `${frontendUrl}/?status=falha`,
        },
        auto_return: 'approved',
        notification_url: `${backendUrl}/webhook-mercadopago`,
      },
    });

    return res.json({ init_point: resultado.init_point });
  } catch (err) {
    console.error('[criar-preferencia-mp] erro:', err);
    return res.status(500).json({ erro: 'Não foi possível criar a preferência de pagamento.' });
  }
});

module.exports = router;
