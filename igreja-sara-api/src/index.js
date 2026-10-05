const app = require('./app');
const { port } = require('./config/environment');

app.listen(port, () => {
  console.log(`API da Igreja Sara Encontro com Deus rodando na porta ${port}`);
});
