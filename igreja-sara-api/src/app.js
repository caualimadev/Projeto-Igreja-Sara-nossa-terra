require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const membrosRoutes = require('./routes/membros');
const celulasRoutes = require('./routes/celulas');
const celulaDozeRoutes = require('./routes/celulaDoze');
const parceirosRoutes = require('./routes/parceiros');
const fichasConversaoRoutes = require('./routes/fichasConversao');
const consolidacaoRoutes = require('./routes/consolidacao');
const institutoVencedoresRoutes = require('./routes/institutoVencedores');
const cultosRoutes = require('./routes/cultos');
const eventosRoutes = require('./routes/eventos');
const raioxRoutes = require('./routes/raiox');
const dashboardRoutes = require('./routes/dashboard');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/membros', membrosRoutes);
app.use('/api/celulas', celulasRoutes);
app.use('/api/celula-doze', celulaDozeRoutes);
app.use('/api/parceiros', parceirosRoutes);
app.use('/api/fichas-conversao', fichasConversaoRoutes);
app.use('/api/consolidacao', consolidacaoRoutes);
app.use('/api/instituto', institutoVencedoresRoutes);
app.use('/api/cultos', cultosRoutes);
app.use('/api/eventos', eventosRoutes);
app.use('/api/raiox', raioxRoutes);
app.use('/api/dashboard', dashboardRoutes);

// 404 para rotas não mapeadas
app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada' }));

// Tratamento de erros não capturados
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

module.exports = app;
