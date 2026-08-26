/**
 * POST /api/gestor-ia
 * Proxy do Gestor IA (assistente financeiro do FinanceFlow) para o Gemini.
 * A chave da API fica só aqui no servidor (variável de ambiente
 * GEMINI_API_KEY no Render) — nunca exposta no código do front-end.
 */
const express = require('express');
const router = express.Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-1.5-flash';

router.post('/api/gestor-ia', async (req, res) => {
    if (!GEMINI_API_KEY) {
          console.warn('[gestor-ia] GEMINI_API_KEY não configurada no servidor.');
          return res.status(503).json({ erro: 'IA não configurada no servidor.' });
    }

              const { systemPrompt, mensagens } = req.body || {};
    if (!systemPrompt || !Array.isArray(mensagens) || !mensagens.length) {
          return res.status(400).json({ erro: 'Requisição inválida: systemPrompt e mensagens são obrigatórios.' });
    }

              try {
                    const historicoTexto = mensagens
                      .slice(-8)
                      .map((m) => (m.role === 'user' ? 'Usuário: ' : 'Assistente: ') + String(m.content || ''))
                      .join('\n');

      const prompt = `${systemPrompt}\n\nHistórico da conversa:\n${historicoTexto}`;

      const resp = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                              contents: [{ role: 'user', parts: [{ text: prompt }] }],
                              generationConfig: { maxOutputTokens: 900, temperature: 0.6 },
                  }),
        }
            );

      const data = await resp.json();

      if (!resp.ok) {
              console.error('[gestor-ia] erro Gemini:', data);
              return res.status(502).json({ erro: data?.error?.message || 'Erro ao consultar a IA.' });
      }

      const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    if (!texto) {
                            console.warn('[gestor-ia] resposta vazia da IA:', JSON.stringify(data).slice(0, 500));
                    }
                    return res.json({ texto });
              } catch (err) {
                    console.error('[gestor-ia] erro inesperado:', err);
                    return res.status(500).json({ erro: 'Falha ao consultar a IA.' });
              }
});

module.exports = router;
