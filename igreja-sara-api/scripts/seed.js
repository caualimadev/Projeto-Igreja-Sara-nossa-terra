require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const nome = process.env.ADMIN_NOME || 'Administrador';
  const email = process.env.ADMIN_EMAIL;
  const senha = process.env.ADMIN_SENHA;

  if (!email || !senha) {
    console.error('Defina ADMIN_EMAIL e ADMIN_SENHA no .env antes de rodar o seed.');
    process.exit(1);
  }

  try {
    const senhaHash = await bcrypt.hash(senha, 10);
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil)
       VALUES ($1,$2,$3,'administrador')
       ON CONFLICT (email) DO UPDATE SET senha_hash = EXCLUDED.senha_hash
       RETURNING id, nome, email, perfil`,
      [nome, email, senhaHash]
    );
    console.log('Usuário administrador criado/atualizado:', rows[0]);
  } catch (err) {
    console.error('Erro ao criar usuário administrador:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
