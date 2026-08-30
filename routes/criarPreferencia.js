/**
 * PASSO 3 — POST /api/criar-preferencia-mp
 * Cria uma PREFERÊNCIA DE PAGAMENTO ÚNICO (Checkout Pro do Mercado Pago) e
 * devolve o init_point para o front-end redirecionar o usuário.
 *
 * Mantém o mesmo nome de rota (/api/criar-preferencia-mp) por compatibilidade
 * com o front-end (premium-paywall.js).
 */
const express = require('express');
const { preference } = require('../lib/mercadopago');

const router = express.Router();

const PRECO_PRO_UNICO = 24.99;
const TITULO_PRO = 'FinanceFlow PRO - Acesso vitalício (Metas, Investimentos e Educação Financeira)';

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
            title: TITULO_PRO,
            quantity: 1,
            unit_price: PRECO_PRO_UNICO,
            currency_id: 'BRL',
          },
        ],
        external_reference: email,
        payer: { email },
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
    return res.status(500).json({ erro: 'Não foi possível criar o pagamento.' });
  }
});

module.exports = router;
