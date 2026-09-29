const express = require('express');
const { query } = require('../db');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// GET /api/dashboard/resumo — os 4 KPIs do topo do painel
router.get('/resumo', async (req, res) => {
  try {
    const [membros, celulas, ultimoCulto, consolidacao] = await Promise.all([
      query(`SELECT COUNT(*) AS total FROM membros`),
      query(`SELECT
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE status = 'em_multiplicacao') AS em_multiplicacao
             FROM celulas WHERE status IN ('ativa','em_multiplicacao')`),
      query(`SELECT * FROM cultos_frequencia ORDER BY data_culto DESC LIMIT 1`),
      query(`SELECT etapa, COUNT(*) AS total FROM consolidacao_acompanhamento
             WHERE etapa != 'concluido' GROUP BY etapa`),
    ]);

    res.json({
      membros_cadastrados: Number(membros.rows[0].total),
      celulas_ativas: Number(celulas.rows[0].total),
      celulas_em_multiplicacao: Number(celulas.rows[0].em_multiplicacao),
      ultimo_culto: ultimoCulto.rows[0] || null,
      em_consolidacao_por_etapa: consolidacao.rows,
      em_consolidacao_total: consolidacao.rows.reduce((soma, r) => soma + Number(r.total), 0),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao gerar resumo do painel' });
  }
});

module.exports = router;
