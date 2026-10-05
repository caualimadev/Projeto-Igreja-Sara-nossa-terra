const express = require('express');
const { query } = require('../db');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// GET /api/raiox/:celulaId?mes=2026-08
router.get('/:celulaId', async (req, res) => {
  const { mes } = req.query; // formato YYYY-MM, opcional
  if (mes && !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
    return res.status(400).json({ erro: 'mes deve estar no formato AAAA-MM' });
  }
  const condicoes = ['v.celula_id = $1'];
  const valores = [req.params.celulaId];
  if (mes) {
    valores.push(`${mes}-01`);
    condicoes.push(`v.mes_referencia = $${valores.length}`);
  }
  try {
    const { rows } = await query(
      `SELECT v.*, to_char(v.mes_referencia, 'YYYY-MM') AS mes
       FROM vw_raiox_mensal v
       WHERE ${condicoes.join(' AND ')}
       ORDER BY v.membro_nome`,
      valores
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao gerar Raio X mensal' });
  }
});

module.exports = router;