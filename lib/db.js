/**
 * "Banco de dados" simulado em arquivo JSON.
 * Troque por Postgres/Mongo/Firestore/etc quando for para produção séria —
 * a interface (getUsuario/definirPro) é o único contrato que o resto do
 * back-end conhece, então trocar a implementação aqui não quebra nada.
 */
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'db.json');

function lerTudo() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return {}; // arquivo ainda não existe na primeira execução
  }
}

function salvarTudo(dados) {
  fs.writeFileSync(DB_PATH, JSON.stringify(dados, null, 2), 'utf-8');
}

/** Retorna { pro: boolean, updatedAt: string|null } para o e-mail informado. */
function getUsuario(email) {
  const dados = lerTudo();
  const chave = normalizarEmail(email);
  return dados[chave] || { pro: false, updatedAt: null };
}

/** Marca (ou desmarca) o e-mail como usuário PRO. */
function definirPro(email, pro) {
  const dados = lerTudo();
  const chave = normalizarEmail(email);
  dados[chave] = { pro: !!pro, updatedAt: new Date().toISOString() };
  salvarTudo(dados);
  return dados[chave];
}

function normalizarEmail(email) {
  return String(email || '').trim().toLowerCase();
}

module.exports = { getUsuario, definirPro };
