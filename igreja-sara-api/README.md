# API — Sistema de Gestão da Igreja Sara Encontro com Deus

Backend em Node.js/Express + PostgreSQL para o sistema cujo mockup está em `html.html`.

## 1. Pré-requisitos
- Node.js 18+
- PostgreSQL 14+ (local ou hospedado — Supabase, Neon, Railway, RDS etc.)

## 2. Instalação

```bash
npm install
cp .env.example .env
```

Edite o `.env` com a string de conexão do seu banco (`DATABASE_URL`) e um `JWT_SECRET` forte.

## 3. Criar as tabelas (migration)

```bash
npm run migrate
```

Isso executa `migrations/001_init.sql` (o schema completo: membros, células, célula de 12,
parceiros de Deus, fichas de conversão, consolidação, Instituto de Vencedores,
frequência de cultos e eventos).

## 4. Criar o primeiro usuário (administrador)

Defina `ADMIN_EMAIL` e `ADMIN_SENHA` no `.env` e rode:

```bash
npm run seed
```

## 5. Rodar a API

```bash
npm run dev     # com reload automático (nodemon)
# ou
npm start
```

A API sobe em `http://localhost:3000` (ou na porta definida em `PORT`).

## 6. Autenticação

Todas as rotas (exceto `/api/auth/login` e `/api/health`) exigem um token JWT.

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"secretaria@saraencontro.org.br","senha":"sua-senha"}'
```

A resposta traz um `token`. Use-o nas próximas chamadas:

```bash
curl http://localhost:3000/api/membros \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

## 7. Principais endpoints

| Módulo (tela do mockup)      | Rota base                     |
|-------------------------------|--------------------------------|
| Login                         | `POST /api/auth/login`         |
| Painel                        | `GET /api/dashboard/resumo`    |
| Membros                       | `/api/membros`                 |
| Parceiros de Deus             | `/api/parceiros`               |
| Células                       | `/api/celulas`                 |
| Frequência da célula          | `/api/celulas/:id/frequencia`  |
| Célula de 12                  | `/api/celula-doze/...`         |
| Raio X mensal                 | `GET /api/raiox/:celulaId`     |
| Ficha de conversão            | `/api/fichas-conversao`        |
| Consolidação (Kanban)         | `/api/consolidacao`            |
| Instituto de Vencedores       | `/api/instituto/...`           |
| Frequência de cultos          | `/api/cultos`                  |
| Eventos                       | `/api/eventos`                 |

Todas seguem o padrão REST: `GET` (listar/detalhar), `POST` (criar), `PUT` (atualizar),
`DELETE` (remover), onde fizer sentido.

## 8. Permissões

O middleware `permitir(...)` (`src/middleware/auth.js`) já restringe a rota de
**Parceiros de Deus** a `administrador` e `secretaria`, por ser um dado mais sensível.
Ajuste/adicione outras restrições por perfil (`pastor`, `lider`) conforme a igreja decidir
quem pode ver/editar cada módulo.

## 9. O que ainda falta (fora do escopo desta API)

- Trocar o `html.html` estático por um front-end que consuma esses endpoints
  (fetch/axios) em vez dos dados fixos.
- Interface de recuperação de senha (hoje só existe o link "Fale com o administrador").
- Geração do PDF do Raio X mensal (a rota já devolve os dados prontos em JSON).
- Deploy do banco, da API e do front em um provedor definitivo, com HTTPS e backups.
