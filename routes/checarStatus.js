/**
 * PASSO 5 (parte back-end) — GET /api/checar-status?email=...
 * O front-end faz polling nessa rota depois de voltar do checkout, até o
 * webhook (Passo 4) ter confirmado o pagamento e marcado o e-mail como PRO.
 */
const express = require('express');
const { getUsuario } = require('../lib/db');

const router = express.Router();

router.get('/api/checar-status', (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ erro: 'Informe o e-mail via ?email=' });
  }

  const usuario = getUsuario(email);
  return res.json({ pro: usuario.pro, updatedAt: usuario.updatedAt });
});

module.exports = router;
