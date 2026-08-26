/**
 * FinanceFlow PRO — Back-end de liberação via Mercado Pago Checkout Pro
 * -----------------------------------------------------------------------
 * Setup:
 *   1. npm install
 *   2. cp .env.example .env   (e preencha MP_ACCESS_TOKEN, FRONTEND_URL, BACKEND_URL)
 *   3. npm run dev             (ou "npm start" em produção)
 *
 * IMPORTANTE: Netlify (onde o front-end estático do FinanceFlow está
 * hospedado) não roda servidores Node — este back-end precisa ser
 * hospedado separadamente (Render, Railway, Fly.io, um VPS, etc.) e sua
 * URL pública é o que vai em BACKEND_URL / no front-end (premium-paywall.js).
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const rotaCriarPreferencia = require('./routes/criarPreferencia');
const rotaWebhook = require('./routes/webhook');
const rotaCheckarStatus = require('./routes/checarStatus');
const rotaGestorIA = require('./routes/gestorIA');

const app = express();

app.use(cors()); // em produção, restrinja para o domínio do seu front-end
app.use(express.json());

app.get('/', (req, res) => res.send('FinanceFlow PRO backend rodando ✅'));

app.use(rotaCriarPreferencia);
app.use(rotaWebhook);
app.use(rotaCheckarStatus);
app.use(rotaGestorIA);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`FinanceFlow PRO backend ouvindo na porta ${PORT}`);
});
