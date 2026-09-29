const express = require('express');
const { query } = require('../db');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// GET /api/cultos?limite=6
router.get('/', async (req, res) => {
  const limite = Number(req.query.limite) || 12;
  try {
    const { rows } = await query(
      `SELECT * FROM cultos_frequencia ORDER BY data_culto DESC LIMIT $1`,
      [limite]
    );
    res.json(rows.reverse()); // ordem cronológica, como no gráfico de barras do painel
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar frequência de cultos' });
  }
});

// POST /api/cultos  { tipo_culto, data_culto, quantitativo_presentes }
router.post('/', async (req, res) => {
  const { tipo_culto, data_culto, quantitativo_presentes } = req.body;
  if (!tipo_culto || !data_culto || quantitativo_presentes == null) {
    return res.status(400).json({ erro: 'tipo_culto, data_culto e quantitativo_presentes são obrigatórios' });
  }
  try {
    const { rows } = await query(
      `INSERT INTO cultos_frequencia (tipo_culto, data_culto, quantitativo_presentes, registrado_por)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (tipo_culto, data_culto) DO UPDATE SET quantitativo_presentes = EXCLUDED.quantitativo_presentes
       RETURNING *`,
      [tipo_culto, data_culto, quantitativo_presentes, req.usuario.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao lançar frequência de culto' });
  }
});

module.exports = router;
