-- ============================================================================
-- Migração 002 — para bancos criados com o 001_init.sql original.
-- Não apaga nem altera dados. Pode ser executada mais de uma vez.
--   1) Apagar um membro deixa de dar erro quando ele é líder/discipulador
--   2) A view do Raio X passa a trazer Consolidação e Instituto
-- ============================================================================

-- 1) Chaves estrangeiras que apontam para membros/células: ao apagar, viram NULL
ALTER TABLE celulas DROP CONSTRAINT IF EXISTS celulas_lider_id_fkey;
ALTER TABLE celulas ADD  CONSTRAINT celulas_lider_id_fkey
    FOREIGN KEY (lider_id) REFERENCES membros(id) ON DELETE SET NULL;

ALTER TABLE celulas DROP CONSTRAINT IF EXISTS celulas_co_lider_id_fkey;
ALTER TABLE celulas ADD  CONSTRAINT celulas_co_lider_id_fkey
    FOREIGN KEY (co_lider_id) REFERENCES membros(id) ON DELETE SET NULL;

ALTER TABLE celula_doze_discipulos DROP CONSTRAINT IF EXISTS celula_doze_discipulos_discipulador_id_fkey;
ALTER TABLE celula_doze_discipulos ADD  CONSTRAINT celula_doze_discipulos_discipulador_id_fkey
    FOREIGN KEY (discipulador_id) REFERENCES membros(id) ON DELETE SET NULL;

ALTER TABLE consolidacao_acompanhamento DROP CONSTRAINT IF EXISTS consolidacao_acompanhamento_celula_origem_id_fkey;
ALTER TABLE consolidacao_acompanhamento ADD  CONSTRAINT consolidacao_acompanhamento_celula_origem_id_fkey
    FOREIGN KEY (celula_origem_id) REFERENCES celulas(id) ON DELETE SET NULL;

ALTER TABLE consolidacao_acompanhamento DROP CONSTRAINT IF EXISTS consolidacao_acompanhamento_lider_responsavel_id_fkey;
ALTER TABLE consolidacao_acompanhamento ADD  CONSTRAINT consolidacao_acompanhamento_lider_responsavel_id_fkey
    FOREIGN KEY (lider_responsavel_id) REFERENCES membros(id) ON DELETE SET NULL;

-- 2) View do Raio X (as colunas novas ficam no final, então o REPLACE é aceito)
CREATE OR REPLACE VIEW vw_raiox_mensal AS
SELECT
    c.id            AS celula_id,
    c.nome          AS celula_nome,
    lider.nome      AS lider_nome,
    date_trunc('month', cf.data_encontro)::date AS mes_referencia,
    m.id            AS membro_id,
    m.nome          AS membro_nome,
    m.whatsapp,
    COUNT(*) FILTER (WHERE cf.presente) AS presencas_no_mes,
    COUNT(*)        AS encontros_no_mes,
    (SELECT ca.etapa
       FROM fichas_conversao f
       JOIN consolidacao_acompanhamento ca ON ca.ficha_id = f.id
      WHERE f.membro_id = m.id
      ORDER BY ca.atualizado_em DESC
      LIMIT 1) AS consolidacao_etapa,
    (SELECT t.nome
       FROM instituto_matriculas im
       JOIN instituto_turmas t ON t.id = im.turma_id
      WHERE im.membro_id = m.id
      ORDER BY im.data_matricula DESC
      LIMIT 1) AS instituto_turma,
    (SELECT im.aprovado
       FROM instituto_matriculas im
      WHERE im.membro_id = m.id
      ORDER BY im.data_matricula DESC
      LIMIT 1) AS instituto_aprovado
FROM celula_frequencia cf
JOIN celulas c   ON c.id = cf.celula_id
JOIN membros m   ON m.id = cf.membro_id
LEFT JOIN membros lider ON lider.id = c.lider_id
GROUP BY c.id, c.nome, lider.nome, date_trunc('month', cf.data_encontro), m.id, m.nome, m.whatsapp;

