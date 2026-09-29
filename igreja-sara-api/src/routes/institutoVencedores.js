const express = require('express');
const { query } = require('../db');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// GET /api/instituto/turmas — já com % de frequência para a barra do painel
router.get('/turmas', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT t.*,
        (SELECT COUNT(*) FROM instituto_matriculas im WHERE im.turma_id = t.id) AS matriculados,
        COALESCE((
          SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE ifr.presente) / NULLIF(COUNT(*),0))
          FROM instituto_matriculas im
          JOIN instituto_frequencia ifr ON ifr.matricula_id = im.id
          WHERE im.turma_id = t.id
        ), 0) AS frequencia_percentual
      FROM instituto_turmas t
      ORDER BY t.nome
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar turmas' });
  }
});

// POST /api/instituto/turmas
router.post('/turmas', async (req, res) => {
  const { nome, dia_semana, horario, vagas, status } = req.body;
  if (!nome) return res.status(400).json({ erro: 'nome é obrigatório' });
  try {
    const { rows } = await query(
      `INSERT INTO instituto_turmas (nome, dia_semana, horario, vagas, status)
       VALUES ($1,$2,$3,COALESCE($4,50),COALESCE($5,'em_curso')) RETURNING *`,
      [nome, dia_semana || null, horario || null, vagas || null, status || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao criar turma' });
  }
});

// POST /api/instituto/turmas/:turmaId/matriculas  { membro_id }
router.post('/turmas/:turmaId/matriculas', async (req, res) => {
  const { membro_id } = req.body;
  if (!membro_id) return res.status(400).json({ erro: 'membro_id é obrigatório' });
  try {
    const { rows } = await query(
      `INSERT INTO instituto_matriculas (turma_id, membro_id) VALUES ($1,$2) RETURNING *`,
      [req.params.turmaId, membro_id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao matricular membro' });
  }
});

// GET /api/instituto/turmas/:turmaId/matriculas
router.get('/turmas/:turmaId/matriculas', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT im.*, m.nome AS membro_nome
       FROM instituto_matriculas im
       JOIN membros m ON m.id = im.membro_id
       WHERE im.turma_id = $1
       ORDER BY m.nome`,
      [req.params.turmaId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar matrículas' });
  }
});

// POST /api/instituto/matriculas/:matriculaId/frequencia  { data_aula, presente }
router.post('/matriculas/:matriculaId/frequencia', async (req, res) => {
  const { data_aula, presente } = req.body;
  if (!data_aula) return res.status(400).json({ erro: 'data_aula é obrigatória' });
  try {
    const { rows } = await query(
      `INSERT INTO instituto_frequencia (matricula_id, data_aula, presente)
       VALUES ($1,$2,$3)
       ON CONFLICT (matricula_id, data_aula) DO UPDATE SET presente = EXCLUDED.presente
       RETURNING *`,
      [req.params.matriculaId, data_aula, !!presente]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao lançar frequência' });
  }
});

// PUT /api/instituto/matriculas/:matriculaId/aprovacao  { aprovado: true|false }
router.put('/matriculas/:matriculaId/aprovacao', async (req, res) => {
  const { aprovado } = req.body;
  try {
    const { rows } = await query(
      `UPDATE instituto_matriculas SET aprovado = $1 WHERE id = $2 RETURNING *`,
      [!!aprovado, req.params.matriculaId]
    );
    if (!rows[0]) return res.status(404).json({ erro: 'Matrícula não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao registrar aprovação' });
  }
});

module.exports = router;
