const express = require('express');
const { query } = require('../db');
const { autenticar, permitir } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// GET /api/parceiros — restrito a administrador e secretaria (dado sensível)
router.get('/', permitir('administrador', 'secretaria'), async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT pc.*, m.nome AS membro_nome, c.nome AS celula_nome
      FROM parceiros_classificacao pc
      JOIN membros m ON m.id = pc.membro_id
      LEFT JOIN celulas c ON c.id = m.celula_id
      ORDER BY m.nome
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar parceiros de Deus' });
  }
});

// POST /api/parceiros  { membro_id, classificacao }
// classificacao: 'dizimista' | 'ofertante' | 'parceiro_de_deus'
// IMPORTANTE: este módulo nunca recebe nem armazena valores monetários.
router.post('/', permitir('administrador', 'secretaria'), async (req, res) => {
  const { membro_id, classificacao } = req.body;
  if (!membro_id || !classificacao) {
    return res.status(400).json({ erro: 'membro_id e classificacao são obrigatórios' });
  }
  try {
    const { rows } = await query(
      `INSERT INTO parceiros_classificacao (membro_id, classificacao)
       VALUES ($1,$2)
       ON CONFLICT (membro_id, classificacao) DO NOTHING
       RETURNING *`,
      [membro_id, classificacao]
    );
    res.status(201).json(rows[0] || { mensagem: 'Classificação já existia para este membro' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao classificar membro' });
  }
});

// DELETE /api/parceiros/:id
router.delete('/:id', permitir('administrador', 'secretaria'), async (req, res) => {
  try {
    const { rowCount } = await query('DELETE FROM parceiros_classificacao WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ erro: 'Registro não encontrado' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao remover classificação' });
  }
});

module.exports = router;
