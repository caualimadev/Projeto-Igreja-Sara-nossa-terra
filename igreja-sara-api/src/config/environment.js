require('dotenv').config();

const environment = {
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  adminEmail: process.env.ADMIN_EMAIL,
  adminSenha: process.env.ADMIN_SENHA,
  adminNome: process.env.ADMIN_NOME || 'Administrador',
};

module.exports = environment;
