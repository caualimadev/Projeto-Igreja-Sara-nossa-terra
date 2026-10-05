const express = require('express');
const { query } = require('../db');
const { autenticar, permitir } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// GET /api/celulas
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT c.*,
             lider.nome AS lider_nome,
             colider.nome AS co_lider_nome,
             (SELECT COUNT(*) FROM membros m WHERE m.celula_id = c.id) AS total_membros
      FROM celulas c
      LEFT JOIN membros lider ON lider.id = c.lider_id
      LEFT JOIN membros colider ON colider.id = c.co_lider_id
      ORDER BY c.nome
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar células' });
  }
});

// GET /api/celulas/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM celulas WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ erro: 'Célula não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar célula' });
  }
});

// POST /api/celulas
router.post('/', async (req, res) => {
  const { nome, bairro, dia_semana, horario, lider_id, co_lider_id, anfitriao, status } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório' });
  try {
    const { rows } = await query(
      `INSERT INTO celulas (nome, bairro, dia_semana, horario, lider_id, co_lider_id, anfitriao, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,'ativa'))
       RETURNING *`,
      [nome, bairro || null, dia_semana || null, horario || null, lider_id || null,
       co_lider_id || null, anfitriao || null, status || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao criar célula' });
  }
});

// PUT /api/celulas/:id
router.put('/:id', async (req, res) => {
  const { nome, bairro, dia_semana, horario, lider_id, co_lider_id, anfitriao, status } = req.body;
  try {
    const { rows } = await query(
      `UPDATE celulas SET
         nome = COALESCE($1, nome),
         bairro = COALESCE($2, bairro),
         dia_semana = COALESCE($3, dia_semana),
         horario = COALESCE($4, horario),
         lider_id = COALESCE($5, lider_id),
         co_lider_id = COALESCE($6, co_lider_id),
         anfitriao = COALESCE($7, anfitriao),
         status = COALESCE($8, status)
       WHERE id = $9
       RETURNING *`,
      [nome, bairro, dia_semana, horario, lider_id, co_lider_id, anfitriao, status, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ erro: 'Célula não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao atualizar célula' });
  }
});

// DELETE /api/celulas/:id
router.delete('/:id', permitir('administrador', 'secretaria'), async (req, res) => {
  try {
    const { rowCount } = await query('DELETE FROM celulas WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ erro: 'Célula não encontrada' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao excluir célula' });
  }
});

// POST /api/celulas/:id/frequencia  { data_encontro, presencas: [{ membro_id, presente }] }
// Lança a presença de vários membros de uma vez para um encontro da célula.
router.post('/:id/frequencia', async (req, res) => {
  const { data_encontro, presencas } = req.body;
  if (!data_encontro || !Array.isArray(presencas)) {
    return res.status(400).json({ erro: 'Informe data_encontro e a lista de presencas' });
  }
  try {
    const resultados = [];
    for (const p of presencas) {
      const { rows } = await query(
        `INSERT INTO celula_frequencia (celula_id, membro_id, data_encontro, presente)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (celula_id, membro_id, data_encontro)
         DO UPDATE SET presente = EXCLUDED.presente
         RETURNING *`,
        [req.params.id, p.membro_id, data_encontro, !!p.presente]
      );
      resultados.push(rows[0]);
    }
    res.status(201).json(resultados);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao lançar frequência da célula' });
  }
});

// GET /api/celulas/:id/frequencia  -> histórico de encontros da célula
router.get('/:id/frequencia', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT cf.*, m.nome AS membro_nome
       FROM celula_frequencia cf
       JOIN membros m ON m.id = cf.membro_id
       WHERE cf.celula_id = $1
       ORDER BY cf.data_encontro DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar frequência da célula' });
  }
});

module.exports = router;