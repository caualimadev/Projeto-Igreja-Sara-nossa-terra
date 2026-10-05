const express = require('express');
const { query, pool } = require('../db');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

const ETAPAS_VALIDAS = ['contato_inicial', 'primeira_visita', 'em_acompanhamento', 'concluido'];

// GET /api/consolidacao — retorna já agrupado por etapa, pronto para o Kanban
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT ca.*,
             f.nome_completo,
             c.nome AS celula_nome,
             l.nome AS lider_nome
      FROM consolidacao_acompanhamento ca
      JOIN fichas_conversao f ON f.id = ca.ficha_id
      LEFT JOIN celulas c ON c.id = ca.celula_origem_id
      LEFT JOIN membros l ON l.id = ca.lider_responsavel_id
      ORDER BY ca.atualizado_em DESC
    `);
    const kanban = ETAPAS_VALIDAS.reduce((acc, etapa) => {
      acc[etapa] = rows.filter((r) => r.etapa === etapa);
      return acc;
    }, {});
    res.json(kanban);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar consolidação' });
  }
});

// PUT /api/consolidacao/:id/etapa  { etapa, observacao }
// Move o card no Kanban e grava a mudança no histórico, em uma transação.
router.put('/:id/etapa', async (req, res) => {
  const { etapa, observacao } = req.body;
  if (!ETAPAS_VALIDAS.includes(etapa)) {
    return res.status(400).json({ erro: `etapa deve ser uma de: ${ETAPAS_VALIDAS.join(', ')}` });
  }
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE consolidacao_acompanhamento
       SET etapa = $1, atualizado_em = now()
       WHERE id = $2 RETURNING *`,
      [etapa, req.params.id]
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Registro de acompanhamento não encontrado' });
    }
    await client.query(
      `INSERT INTO consolidacao_historico (acompanhamento_id, etapa, observacao) VALUES ($1,$2,$3)`,
      [req.params.id, etapa, observacao || null]
    );
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ erro: 'Erro ao mover etapa de consolidação' });
  } finally {
    if (client) client.release();
  }
});

// GET /api/consolidacao/:id/historico
router.get('/:id/historico', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM consolidacao_historico WHERE acompanhamento_id = $1 ORDER BY data_mudanca`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar histórico' });
  }
});

module.exports = router;