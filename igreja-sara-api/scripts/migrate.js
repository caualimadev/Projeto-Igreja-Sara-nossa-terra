const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { databaseUrl } = require('../src/config/environment');

const PASTA = path.join(__dirname, '..', 'migrations');

// Aplica, em ordem, todos os arquivos .sql de /migrations que ainda não foram aplicados.
// O que já foi aplicado fica registrado na tabela schema_migrations, então rodar
// "npm run migrate" várias vezes é seguro. Cada arquivo roda dentro de uma transação:
// se der erro, nada daquele arquivo é gravado.
// Os arquivos .sql NÃO devem ter BEGIN/COMMIT: a transação é aberta aqui.
async function main() {
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        nome        VARCHAR(200) PRIMARY KEY,
        aplicada_em TIMESTAMP NOT NULL DEFAULT now()
      )`);

    const arquivos = fs.readdirSync(PASTA).filter((f) => f.endsWith('.sql')).sort();
    const { rows } = await client.query('SELECT nome FROM schema_migrations');
    const aplicadas = new Set(rows.map((r) => r.nome));

    // Banco criado antes deste controle existir: a 001 já foi executada por uma versão
    // antiga do script, então só registramos que ela foi aplicada (sem rodar de novo).
    if (aplicadas.size === 0 && arquivos.includes('001_init.sql')) {
      const { rows: t } = await client.query("SELECT to_regclass('public.membros') AS existe");
      if (t[0].existe) {
        await client.query('INSERT INTO schema_migrations (nome) VALUES ($1)', ['001_init.sql']);
        aplicadas.add('001_init.sql');
        console.log('Banco já existente: 001_init.sql registrada como aplicada.');
      }
    }

    const pendentes = arquivos.filter((a) => !aplicadas.has(a));
    if (!pendentes.length) {
      console.log('Banco já está atualizado.');
      return;
    }

    for (const arquivo of pendentes) {
      console.log(`Executando ${arquivo}...`);
      const sql = fs.readFileSync(path.join(PASTA, arquivo), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (nome) VALUES ($1)', [arquivo]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`${arquivo}: ${err.message}`);
      }
    }
    console.log('Migrations aplicadas com sucesso.');
  } catch (err) {
    console.error('Erro ao aplicar migration:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
