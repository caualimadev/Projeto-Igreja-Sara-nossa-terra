const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const { adminNome, adminEmail, adminSenha, databaseUrl } = require('../src/config/environment');

async function main() {
  const pool = new Pool({ connectionString: databaseUrl });
  const nome = adminNome;
  const email = adminEmail;
  const senha = adminSenha;

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
