CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. USUÁRIOS DO SISTEMA (login da tela inicial)
-- ============================================================================
CREATE TABLE usuarios (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome            VARCHAR(150) NOT NULL,
    email           VARCHAR(150) NOT NULL UNIQUE,
    senha_hash      VARCHAR(255) NOT NULL,
    perfil          VARCHAR(20) NOT NULL DEFAULT 'secretaria'
                    CHECK (perfil IN ('administrador','secretaria','pastor','lider')),
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMP NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. MEMBROS (tabela central — visitantes, novos convertidos, membros)
-- ============================================================================
CREATE TABLE membros (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome                VARCHAR(150) NOT NULL,
    data_nascimento     DATE,
    endereco            VARCHAR(255),
    bairro              VARCHAR(100),
    whatsapp            VARCHAR(20),
    status              VARCHAR(20) NOT NULL DEFAULT 'visitante'
                        CHECK (status IN ('visitante','novo_convertido','reconciliacao',
                                           'membro','parceiro_de_deus')),
    celula_id           UUID REFERENCES celulas(id) ON DELETE SET NULL,
    membro_desde        DATE,             -- "Desde" mostrado na listagem de Membros
    criado_em           TIMESTAMP NOT NULL DEFAULT now(),
    atualizado_em       TIMESTAMP NOT NULL DEFAULT now()
);
-- OBS: a FK celula_id é criada antes da tabela 'celulas' existir; ver nota no final
-- (em SQL real, crie 'celulas' primeiro ou use ALTER TABLE para a FK — ajustado abaixo).

-- ============================================================================
-- 3. CÉLULAS
-- ============================================================================
CREATE TABLE celulas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome            VARCHAR(100) NOT NULL,          -- Ex: "Célula Videira"
    bairro          VARCHAR(100),
    dia_semana      VARCHAR(20),                    -- Terça, Sábado, Quinta...
    horario         TIME,
    lider_id        UUID REFERENCES membros(id),
    co_lider_id     UUID REFERENCES membros(id),
    anfitriao       VARCHAR(150),                   -- "Fam. Sousa"
    status          VARCHAR(20) NOT NULL DEFAULT 'ativa'
                    CHECK (status IN ('ativa','em_multiplicacao','inativa')),
    criada_em       TIMESTAMP NOT NULL DEFAULT now()
);

-- Agora sim a FK de membros -> celulas pode ser adicionada:
ALTER TABLE membros
    ADD CONSTRAINT fk_membros_celula FOREIGN KEY (celula_id) REFERENCES celulas(id) ON DELETE SET NULL;

-- Frequência semanal da célula (usada na barra "Frequência média" e no Raio X)
CREATE TABLE celula_frequencia (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    celula_id       UUID NOT NULL REFERENCES celulas(id) ON DELETE CASCADE,
    membro_id       UUID NOT NULL REFERENCES membros(id) ON DELETE CASCADE,
    data_encontro   DATE NOT NULL,
    presente        BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (celula_id, membro_id, data_encontro)
);

-- ============================================================================
-- 4. CÉLULA DE 12 (discipulado G-12 da alta liderança)
-- ============================================================================
CREATE TABLE celula_doze_discipulos (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discipulo_id        UUID NOT NULL REFERENCES membros(id) ON DELETE CASCADE,
    discipulador_id     UUID REFERENCES membros(id),   -- "G-144 de"
    UNIQUE (discipulo_id)
);

CREATE TABLE celula_doze_encontros (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_encontro   DATE NOT NULL,
    observacao      TEXT
);

CREATE TABLE celula_doze_presencas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encontro_id     UUID NOT NULL REFERENCES celula_doze_encontros(id) ON DELETE CASCADE,
    discipulo_id    UUID NOT NULL REFERENCES membros(id) ON DELETE CASCADE,
    presente        BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (encontro_id, discipulo_id)
);

-- ============================================================================
-- 5. PARCEIROS DE DEUS (classificação qualitativa — SEM valores monetários)
-- ============================================================================
CREATE TABLE parceiros_classificacao (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    membro_id       UUID NOT NULL REFERENCES membros(id) ON DELETE CASCADE,
    classificacao   VARCHAR(20) NOT NULL
                    CHECK (classificacao IN ('dizimista','ofertante','parceiro_de_deus')),
    desde           DATE NOT NULL DEFAULT CURRENT_DATE,
    UNIQUE (membro_id, classificacao)
);
-- Nenhuma coluna de valor/PIX/cartão/boleto por design (RF08).

-- ============================================================================
-- 6. FICHA DE CONVERSÃO (triagem digital)
-- ============================================================================
CREATE TABLE fichas_conversao (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo                    VARCHAR(20) NOT NULL DEFAULT 'novo_convertido'
                            CHECK (tipo IN ('novo_convertido','reconciliacao','visitante')),
    membro_id               UUID REFERENCES membros(id) ON DELETE SET NULL,
    nome_completo           VARCHAR(150) NOT NULL,
    data_nascimento         DATE,
    endereco                VARCHAR(255),
    bairro                  VARCHAR(100),
    whatsapp                VARCHAR(20),
    participa_celula        BOOLEAN DEFAULT FALSE,
    nome_lider_celula       VARCHAR(150),
    veio_acompanhado_por    VARCHAR(150),
    sera_acompanhado_por    VARCHAR(150),         -- "Será acompanhado pelo líder"
    data_ficha              DATE NOT NULL DEFAULT CURRENT_DATE,
    observacao              TEXT,
    registrado_por          UUID REFERENCES usuarios(id),
    criado_em               TIMESTAMP NOT NULL DEFAULT now()
);

-- Necessidades de oração são multi-seleção (tags): Espiritual, Saúde, Emocional, Financeiro, Mental
CREATE TABLE necessidades_oracao (
    id      SMALLSERIAL PRIMARY KEY,
    nome    VARCHAR(30) NOT NULL UNIQUE
);
INSERT INTO necessidades_oracao (nome) VALUES
    ('Espiritual'), ('Saúde'), ('Emocional'), ('Financeiro'), ('Mental');

CREATE TABLE ficha_necessidades (
    ficha_id        UUID NOT NULL REFERENCES fichas_conversao(id) ON DELETE CASCADE,
    necessidade_id  SMALLINT NOT NULL REFERENCES necessidades_oracao(id),
    PRIMARY KEY (ficha_id, necessidade_id)
);

-- ============================================================================
-- 7. CONSOLIDAÇÃO (Kanban: contato inicial → 1ª visita → em acompanhamento → concluído)
-- ============================================================================
CREATE TABLE consolidacao_acompanhamento (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ficha_id            UUID NOT NULL REFERENCES fichas_conversao(id) ON DELETE CASCADE,
    celula_origem_id    UUID REFERENCES celulas(id),
    lider_responsavel_id UUID REFERENCES membros(id),
    etapa               VARCHAR(25) NOT NULL DEFAULT 'contato_inicial'
                        CHECK (etapa IN ('contato_inicial','primeira_visita',
                                          'em_acompanhamento','concluido')),
    atualizado_em       TIMESTAMP NOT NULL DEFAULT now()
);

-- Histórico de mudança de etapa (para o "há 2 dias", "3ª semana" etc. do mockup)
CREATE TABLE consolidacao_historico (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    acompanhamento_id   UUID NOT NULL REFERENCES consolidacao_acompanhamento(id) ON DELETE CASCADE,
    etapa               VARCHAR(25) NOT NULL,
    data_mudanca        TIMESTAMP NOT NULL DEFAULT now(),
    observacao          TEXT
);

-- ============================================================================
-- 8. INSTITUTO DE VENCEDORES (turmas, matrícula, frequência, aprovação)
-- ============================================================================
CREATE TABLE instituto_turmas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome            VARCHAR(100) NOT NULL,     -- "Módulo 1 — Fundamentos"
    dia_semana      VARCHAR(20),
    horario         TIME,
    vagas           INTEGER NOT NULL DEFAULT 50,
    status          VARCHAR(20) NOT NULL DEFAULT 'em_curso'
                    CHECK (status IN ('em_curso','concluida','nao_iniciada'))
);

CREATE TABLE instituto_matriculas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    turma_id        UUID NOT NULL REFERENCES instituto_turmas(id) ON DELETE CASCADE,
    membro_id       UUID NOT NULL REFERENCES membros(id) ON DELETE CASCADE,
    data_matricula  DATE NOT NULL DEFAULT CURRENT_DATE,
    aprovado        BOOLEAN,
    UNIQUE (turma_id, membro_id)
);

CREATE TABLE instituto_frequencia (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matricula_id    UUID NOT NULL REFERENCES instituto_matriculas(id) ON DELETE CASCADE,
    data_aula       DATE NOT NULL,
    presente        BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (matricula_id, data_aula)
);

-- ============================================================================
-- 9. FREQUÊNCIA DE CULTOS (lançamento quantitativo — terça, sábado, domingo)
-- ============================================================================
CREATE TABLE cultos_frequencia (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_culto              VARCHAR(15) NOT NULL CHECK (tipo_culto IN ('terca','sabado','domingo')),
    data_culto              DATE NOT NULL,
    quantitativo_presentes  INTEGER NOT NULL,
    registrado_por          UUID REFERENCES usuarios(id),
    criado_em               TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (tipo_culto, data_culto)
);

-- ============================================================================
-- 10. EVENTOS INSTITUCIONAIS
-- ============================================================================
CREATE TABLE eventos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo          VARCHAR(150) NOT NULL,
    data_evento     DATE NOT NULL,
    horario         TIME,
    local           VARCHAR(150),
    descricao       TEXT,
    criado_por      UUID REFERENCES usuarios(id),
    criado_em       TIMESTAMP NOT NULL DEFAULT now()
);

-- ============================================================================
-- ÍNDICES úteis para os filtros/buscas do mockup (busca por nome/bairro/célula,
-- listagens do painel, Raio X mensal etc.)
-- ============================================================================
CREATE INDEX idx_membros_nome        ON membros (nome);
CREATE INDEX idx_membros_bairro      ON membros (bairro);
CREATE INDEX idx_membros_celula      ON membros (celula_id);
CREATE INDEX idx_membros_status      ON membros (status);
CREATE INDEX idx_celula_freq_data    ON celula_frequencia (data_encontro);
CREATE INDEX idx_cultos_freq_data    ON cultos_frequencia (data_culto);
CREATE INDEX idx_eventos_data        ON eventos (data_evento);
CREATE INDEX idx_consolidacao_etapa  ON consolidacao_acompanhamento (etapa);

-- ============================================================================
-- VIEW de apoio para o "Raio X mensal" (presenças de célula por membro/mês)
-- ============================================================================
CREATE VIEW vw_raiox_mensal AS
SELECT
    c.id            AS celula_id,
    c.nome          AS celula_nome,
    lider.nome      AS lider_nome,
    date_trunc('month', cf.data_encontro)::date AS mes_referencia,
    m.id            AS membro_id,
    m.nome          AS membro_nome,
    m.whatsapp,
    COUNT(*) FILTER (WHERE cf.presente) AS presencas_no_mes,
    COUNT(*)        AS encontros_no_mes
FROM celula_frequencia cf
JOIN celulas c   ON c.id = cf.celula_id
JOIN membros m   ON m.id = cf.membro_id
LEFT JOIN membros lider ON lider.id = c.lider_id
GROUP BY c.id, c.nome, lider.nome, date_trunc('month', cf.data_encontro), m.id, m.nome, m.whatsapp;
