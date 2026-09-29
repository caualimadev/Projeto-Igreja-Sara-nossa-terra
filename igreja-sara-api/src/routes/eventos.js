const express = require('express');
const { query } = require('../db');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// GET /api/eventos
router.get('/', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM eventos ORDER BY data_evento');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar eventos' });
  }
});

// POST /api/eventos
router.post('/', async (req, res) => {
  const { titulo, data_evento, horario, local, descricao } = req.body;
  if (!titulo || !data_evento) return res.status(400).json({ erro: 'titulo e data_evento são obrigatórios' });
  try {
    const { rows } = await query(
      `INSERT INTO eventos (titulo, data_evento, horario, local, descricao, criado_por)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [titulo, data_evento, horario || null, local || null, descricao || null, req.usuario.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao criar evento' });
  }
});

// PUT /api/eventos/:id
router.put('/:id', async (req, res) => {
  const { titulo, data_evento, horario, local, descricao } = req.body;
  try {
    const { rows } = await query(
      `UPDATE eventos SET
         titulo = COALESCE($1, titulo),
         data_evento = COALESCE($2, data_evento),
         horario = COALESCE($3, horario),
         local = COALESCE($4, local),
         descricao = COALESCE($5, descricao)
       WHERE id = $6 RETURNING *`,
      [titulo, data_evento, horario, local, descricao, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ erro: 'Evento não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao atualizar evento' });
  }
});

// DELETE /api/eventos/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await query('DELETE FROM eventos WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ erro: 'Evento não encontrado' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao excluir evento' });
  }
});

module.exports = router;
