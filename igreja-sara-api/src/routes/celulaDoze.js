const express = require('express');
const { query } = require('../db');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// GET /api/celula-doze/discipulos
router.get('/discipulos', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT d.*, m.nome AS discipulo_nome, g.nome AS discipulador_nome
      FROM celula_doze_discipulos d
      JOIN membros m ON m.id = d.discipulo_id
      LEFT JOIN membros g ON g.id = d.discipulador_id
      ORDER BY m.nome
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar discípulos' });
  }
});

// POST /api/celula-doze/discipulos  { discipulo_id, discipulador_id }
router.post('/discipulos', async (req, res) => {
  const { discipulo_id, discipulador_id } = req.body;
  if (!discipulo_id) return res.status(400).json({ erro: 'discipulo_id é obrigatório' });
  try {
    const { rows } = await query(
      `INSERT INTO celula_doze_discipulos (discipulo_id, discipulador_id)
       VALUES ($1,$2) RETURNING *`,
      [discipulo_id, discipulador_id || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao registrar discípulo' });
  }
});

// GET /api/celula-doze/encontros
router.get('/encontros', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM celula_doze_encontros ORDER BY data_encontro DESC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar encontros' });
  }
});

// POST /api/celula-doze/encontros  { data_encontro, observacao }
router.post('/encontros', async (req, res) => {
  const { data_encontro, observacao } = req.body;
  if (!data_encontro) return res.status(400).json({ erro: 'data_encontro é obrigatória' });
  try {
    const { rows } = await query(
      `INSERT INTO celula_doze_encontros (data_encontro, observacao) VALUES ($1,$2) RETURNING *`,
      [data_encontro, observacao || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao criar encontro' });
  }
});

// POST /api/celula-doze/encontros/:id/presencas  { presencas: [{ discipulo_id, presente }] }
router.post('/encontros/:id/presencas', async (req, res) => {
  const { presencas } = req.body;
  if (!Array.isArray(presencas)) return res.status(400).json({ erro: 'Informe a lista de presencas' });
  try {
    const resultados = [];
    for (const p of presencas) {
      const { rows } = await query(
        `INSERT INTO celula_doze_presencas (encontro_id, discipulo_id, presente)
         VALUES ($1,$2,$3)
         ON CONFLICT (encontro_id, discipulo_id)
         DO UPDATE SET presente = EXCLUDED.presente
         RETURNING *`,
        [req.params.id, p.discipulo_id, !!p.presente]
      );
      resultados.push(rows[0]);
    }
    res.status(201).json(resultados);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao lançar presenças do encontro' });
  }
});

module.exports = router;
