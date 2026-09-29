const express = require('express');
const { query } = require('../db');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// GET /api/membros?busca=&bairro=&celula_id=&status=
router.get('/', async (req, res) => {
  const { busca, bairro, celula_id, status } = req.query;
  const condicoes = [];
  const valores = [];

  if (busca) {
    valores.push(`%${busca}%`);
    condicoes.push(`(m.nome ILIKE $${valores.length} OR m.bairro ILIKE $${valores.length})`);
  }
  if (bairro) {
    valores.push(bairro);
    condicoes.push(`m.bairro = $${valores.length}`);
  }
  if (celula_id) {
    valores.push(celula_id);
    condicoes.push(`m.celula_id = $${valores.length}`);
  }
  if (status) {
    valores.push(status);
    condicoes.push(`m.status = $${valores.length}`);
  }
  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';

  try {
    const { rows } = await query(
      `SELECT m.*, c.nome AS celula_nome
       FROM membros m
       LEFT JOIN celulas c ON c.id = m.celula_id
       ${where}
       ORDER BY m.nome`,
      valores
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar membros' });
  }
});

// GET /api/membros/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM membros WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ erro: 'Membro não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar membro' });
  }
});

// POST /api/membros
router.post('/', async (req, res) => {
  const { nome, data_nascimento, endereco, bairro, whatsapp, status, celula_id, membro_desde } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório' });

  try {
    const { rows } = await query(
      `INSERT INTO membros (nome, data_nascimento, endereco, bairro, whatsapp, status, celula_id, membro_desde)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6,'visitante'),$7,$8)
       RETURNING *`,
      [nome, data_nascimento || null, endereco || null, bairro || null, whatsapp || null,
       status || null, celula_id || null, membro_desde || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao criar membro' });
  }
});

// PUT /api/membros/:id
router.put('/:id', async (req, res) => {
  const { nome, data_nascimento, endereco, bairro, whatsapp, status, celula_id, membro_desde } = req.body;
  try {
    const { rows } = await query(
      `UPDATE membros SET
         nome = COALESCE($1, nome),
         data_nascimento = COALESCE($2, data_nascimento),
         endereco = COALESCE($3, endereco),
         bairro = COALESCE($4, bairro),
         whatsapp = COALESCE($5, whatsapp),
         status = COALESCE($6, status),
         celula_id = COALESCE($7, celula_id),
         membro_desde = COALESCE($8, membro_desde),
         atualizado_em = now()
       WHERE id = $9
       RETURNING *`,
      [nome, data_nascimento, endereco, bairro, whatsapp, status, celula_id, membro_desde, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ erro: 'Membro não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao atualizar membro' });
  }
});

// DELETE /api/membros/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await query('DELETE FROM membros WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ erro: 'Membro não encontrado' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao excluir membro' });
  }
});

module.exports = router;
