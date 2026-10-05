require('dotenv').config();
const express = require('express');
const cors = require('cors');

const routes = require('./routes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', routes.auth);
app.use('/api/membros', routes.membros);
app.use('/api/celulas', routes.celulas);
app.use('/api/celula-doze', routes.celulaDoze);
app.use('/api/parceiros', routes.parceiros);
app.use('/api/fichas-conversao', routes.fichasConversao);
app.use('/api/consolidacao', routes.consolidacao);
app.use('/api/instituto', routes.institutoVencedores);
app.use('/api/cultos', routes.cultos);
app.use('/api/eventos', routes.eventos);
app.use('/api/raiox', routes.raiox);
app.use('/api/dashboard', routes.dashboard);

// 404 para rotas não mapeadas
app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada' }));

// Tratamento de erros não capturados
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

module.exports = app;
