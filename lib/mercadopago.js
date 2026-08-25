/**
 * Configuração central do SDK do Mercado Pago (v2 — pacote "mercadopago").
 * Tudo que precisar falar com a API do MP importa o client/Preference/Payment
 * daqui, em vez de instanciar de novo em cada arquivo.
 */
const { MercadoPagoConfig, Preference, Payment, PreApproval } = require('mercadopago');

const accessToken = process.env.MP_ACCESS_TOKEN;
if (!accessToken) {
    console.warn(
          '[mercadopago] MP_ACCESS_TOKEN não definido no .env — as chamadas ao ' +
          'Mercado Pago vão falhar até você configurar isso.'
        );
}

const client = new MercadoPagoConfig({
    accessToken,
    options: { timeout: 8000 },
});

const preference = new Preference(client);
const payment = new Payment(client);
const preapproval = new PreApproval(client); // Assinaturas (cobrança recorrente)

module.exports = { client, preference, payment, preapproval };
