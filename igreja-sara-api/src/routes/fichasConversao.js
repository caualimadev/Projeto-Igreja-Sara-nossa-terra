const express = require('express');
const { query, pool } = require('../db');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// GET /api/fichas-conversao
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT f.*,
             array_remove(array_agg(n.nome), NULL) AS necessidades_oracao
      FROM fichas_conversao f
      LEFT JOIN ficha_necessidades fn ON fn.ficha_id = f.id
      LEFT JOIN necessidades_oracao n ON n.id = fn.necessidade_id
      GROUP BY f.id
      ORDER BY f.data_ficha DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar fichas de conversão' });
  }
});

// GET /api/fichas-conversao/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM fichas_conversao WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ erro: 'Ficha não encontrada' });
    const necessidades = await query(
      `SELECT n.nome FROM ficha_necessidades fn
       JOIN necessidades_oracao n ON n.id = fn.necessidade_id
       WHERE fn.ficha_id = $1`,
      [req.params.id]
    );
    res.json({ ...rows[0], necessidades_oracao: necessidades.rows.map((r) => r.nome) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar ficha' });
  }
});

// POST /api/fichas-conversao
// { tipo, nome_completo, data_nascimento, endereco, bairro, whatsapp,
//   participa_celula, nome_lider_celula, veio_acompanhado_por, sera_acompanhado_por,
//   data_ficha, observacao, necessidades: ['Espiritual','Saúde',...], celula_origem_id }
//
// Também cria automaticamente o registro em consolidacao_acompanhamento
// na etapa inicial "contato_inicial" (RF06), dentro de uma transação.
router.post('/', async (req, res) => {
  const {
    tipo, nome_completo, data_nascimento, endereco, bairro, whatsapp,
    participa_celula, nome_lider_celula, veio_acompanhado_por, sera_acompanhado_por,
    data_ficha, observacao, necessidades, celula_origem_id, lider_responsavel_id,
  } = req.body;

  if (!nome_completo) return res.status(400).json({ erro: 'nome_completo é obrigatório' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const fichaResult = await client.query(
      `INSERT INTO fichas_conversao
         (tipo, nome_completo, data_nascimento, endereco, bairro, whatsapp,
          participa_celula, nome_lider_celula, veio_acompanhado_por, sera_acompanhado_por,
          data_ficha, observacao, registrado_por)
       VALUES (COALESCE($1,'novo_convertido'),$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11,CURRENT_DATE),$12,$13)
       RETURNING *`,
      [tipo, nome_completo, data_nascimento || null, endereco || null, bairro || null, whatsapp || null,
       !!participa_celula, nome_lider_celula || null, veio_acompanhado_por || null, sera_acompanhado_por || null,
       data_ficha || null, observacao || null, req.usuario.id]
    );
    const ficha = fichaResult.rows[0];

    if (Array.isArray(necessidades) && necessidades.length) {
      for (const nome of necessidades) {
        const nec = await client.query('SELECT id FROM necessidades_oracao WHERE nome = $1', [nome]);
        if (nec.rows[0]) {
          await client.query(
            'INSERT INTO ficha_necessidades (ficha_id, necessidade_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
            [ficha.id, nec.rows[0].id]
          );
        }
      }
    }

    const acompanhamento = await client.query(
      `INSERT INTO consolidacao_acompanhamento (ficha_id, celula_origem_id, lider_responsavel_id, etapa)
       VALUES ($1,$2,$3,'contato_inicial') RETURNING *`,
      [ficha.id, celula_origem_id || null, lider_responsavel_id || null]
    );
    await client.query(
      `INSERT INTO consolidacao_historico (acompanhamento_id, etapa) VALUES ($1,'contato_inicial')`,
      [acompanhamento.rows[0].id]
    );

    await client.query('COMMIT');
    res.status(201).json({ ficha, acompanhamento: acompanhamento.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ erro: 'Erro ao criar ficha de conversão' });
  } finally {
    client.release();
  }
});

module.exports = router;
