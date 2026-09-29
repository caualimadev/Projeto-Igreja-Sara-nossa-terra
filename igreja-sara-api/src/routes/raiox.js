const express = require('express');
const { query } = require('../db');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// GET /api/raiox/:celulaId?mes=2026-08
router.get('/:celulaId', async (req, res) => {
  const { mes } = req.query; // formato YYYY-MM, opcional
  const condicoes = ['celula_id = $1'];
  const valores = [req.params.celulaId];
  if (mes) {
    valores.push(`${mes}-01`);
    condicoes.push(`mes_referencia = $${valores.length}`);
  }
  try {
    const { rows } = await query(
      `SELECT * FROM vw_raiox_mensal WHERE ${condicoes.join(' AND ')} ORDER BY membro_nome`,
      valores
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao gerar Raio X mensal' });
  }
});

module.exports = router;
