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
    if (err.code === '23505') return res.status(409).json({ erro: 'Este membro já está na Célula de 12' });
    console.error(err);
    res.status(500).json({ erro: 'Erro ao registrar discípulo' });
  }
});

// DELETE /api/celula-doze/discipulos/:id  (remove da Célula de 12; não apaga o membro)
router.delete('/discipulos/:id', async (req, res) => {
  try {
    const { rowCount } = await query('DELETE FROM celula_doze_discipulos WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ erro: 'Discípulo não encontrado' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao remover discípulo' });
  }
});

// GET /api/celula-doze/painel?encontros=2
// Tudo o que a tela precisa numa chamada só: os últimos N encontros (em ordem cronológica)
// e, para cada discípulo, a presença em cada um deles (true / false / ausente = sem lançamento).
// As datas voltam como texto 'AAAA-MM-DD' para não sofrerem deslocamento de fuso horário.
router.get('/painel', async (req, res) => {
  const limite = Math.min(Math.max(Number(req.query.encontros) || 2, 1), 12);
  try {
    const encontros = (await query(
      `SELECT e.id, to_char(e.data_encontro, 'YYYY-MM-DD') AS data_encontro, e.observacao
       FROM celula_doze_encontros e
       ORDER BY e.data_encontro DESC
       LIMIT $1`,
      [limite]
    )).rows.reverse();

    const discipulos = (await query(`
      SELECT d.id, d.discipulo_id, m.nome AS discipulo_nome, g.nome AS discipulador_nome
      FROM celula_doze_discipulos d
      JOIN membros m ON m.id = d.discipulo_id
      LEFT JOIN membros g ON g.id = d.discipulador_id
      ORDER BY m.nome
    `)).rows;

    const presencasPorDiscipulo = {};
    const presentesPorEncontro = {};
    if (encontros.length) {
      const { rows } = await query(
        `SELECT encontro_id, discipulo_id, presente
         FROM celula_doze_presencas
         WHERE encontro_id = ANY($1::uuid[])`,
        [encontros.map((e) => e.id)]
      );
      for (const p of rows) {
        (presencasPorDiscipulo[p.discipulo_id] = presencasPorDiscipulo[p.discipulo_id] || {})[p.encontro_id] = p.presente;
        if (p.presente) presentesPorEncontro[p.encontro_id] = (presentesPorEncontro[p.encontro_id] || 0) + 1;
      }
    }

    res.json({
      total_discipulos: discipulos.length,
      encontros: encontros.map((e) => ({ ...e, presentes: presentesPorEncontro[e.id] || 0 })),
      discipulos: discipulos.map((d) => ({ ...d, presencas: presencasPorDiscipulo[d.discipulo_id] || {} })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao montar o painel da Célula de 12' });
  }
});

// GET /api/celula-doze/encontros
router.get('/encontros', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, to_char(data_encontro, 'YYYY-MM-DD') AS data_encontro, observacao
       FROM celula_doze_encontros ORDER BY celula_doze_encontros.data_encontro DESC`
    );
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

// GET /api/celula-doze/encontros/:id/presencas
router.get('/encontros/:id/presencas', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT p.*, m.nome AS discipulo_nome
       FROM celula_doze_presencas p
       JOIN membros m ON m.id = p.discipulo_id
       WHERE p.encontro_id = $1
       ORDER BY m.nome`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar presenças do encontro' });
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
    if (err.code === '23503') return res.status(404).json({ erro: 'Encontro ou discípulo não encontrado' });
    console.error(err);
    res.status(500).json({ erro: 'Erro ao lançar presenças do encontro' });
  }
});

module.exports = router;