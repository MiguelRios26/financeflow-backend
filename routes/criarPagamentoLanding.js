/**
 * Rota do Checkout Pro (Preference — pagamento único) usada pela landing page
 * pública do FinanceFlow (Instagram). Diferente de /api/criar-preferencia-mp
 * (que cria uma ASSINATURA recorrente via PreApproval), esta rota cria uma
 * Preference de pagamento único parcelável em até 12x, com 12x já
 * pré-selecionado por padrão no checkout — em vez do padrão de 3x do
 * Mercado Pago — via payment_methods.installments / default_installments.
 */
const express = require('express');
const { preference } = require('../lib/mercadopago');

const router = express.Router();

const VALOR_TOTAL = 358.92; // 12x de R$29,91
const TITULO = 'FinanceFlow - Acesso completo ao app';

router.post('/api/criar-pagamento-landing', async (req, res) => {
  const landingUrl = (process.env.LANDING_URL || process.env.FRONTEND_URL || '').replace(/\/$/, '');

  try {
    const resultado = await preference.create({
      body: {
        items: [
          {
            title: TITULO,
            quantity: 1,
            unit_price: VALOR_TOTAL,
            currency_id: 'BRL',
          },
        ],
        payment_methods: {
          installments: 12,
          default_installments: 12,
        },
        back_urls: {
          success: `${landingUrl}/?pago=1`,
          failure: `${landingUrl}/?pago=0`,
          pending: `${landingUrl}/?pago=pendente`,
        },
        auto_return: 'approved',
      },
    });

    return res.json({ init_point: resultado.init_point });
  } catch (err) {
    console.error('[criar-pagamento-landing] erro:', err);
    return res.status(500).json({ erro: 'Não foi possível criar o pagamento.' });
  }
});

module.exports = router;
