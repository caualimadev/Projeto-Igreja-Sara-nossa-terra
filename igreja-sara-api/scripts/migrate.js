require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const arquivo = path.join(__dirname, '..', 'migrations', '001_init.sql');
  const sql = fs.readFileSync(arquivo, 'utf8');

  console.log('Executando migration 001_init.sql...');
  try {
    await pool.query(sql);
    console.log('Migration aplicada com sucesso.');
  } catch (err) {
    console.error('Erro ao aplicar migration:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
