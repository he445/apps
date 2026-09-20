# Backend — Guia Técnico

## Visão Geral

API REST desenvolvida com **NestJS 10** + **Prisma 5** + **PostgreSQL (Neon)**.

- **Porta padrão**: `3000`
- **Prefixo global**: `/api/v1`
- **Autenticação**: JWT Bearer (guard global — todos os endpoints são protegidos por padrão)
- **Swagger UI**: `http://localhost:3000/docs`

---

## Setup

```bash
# Instalar dependências
cd api && npm install

# Configurar variáveis de ambiente
cp .env.example .env  # ou crie manualmente

# Gerar Prisma Client
npm run prisma:generate

# Aplicar migrações
npm run prisma:migrate

# Iniciar em desenvolvimento (hot-reload)
npm run start:dev
```

**`api/.env`**:
```env
DATABASE_URL="postgresql://user:password@host/db?sslmode=require"
JWT_SECRET="string-longa-e-secreta"
PORT=3000
WEB_ORIGIN="http://localhost:5173"
```

---

## Estrutura de Módulos

```
api/src/
├── app.module.ts           # Módulo raiz (JwtModule global, APP_GUARD)
├── main.ts                 # Bootstrap, Swagger, CORS, ValidationPipe
├── common/
│   ├── auth.ts             # JwtAuthGuard, @Public(), @CurrentUser(), JwtUser
│   └── prisma.service.ts   # PrismaService + PrismaModule
├── auth/
│   └── auth.module.ts      # Registro, login, preview de convite
├── care/
│   └── care.module.ts      # Consultas, avaliações, guidelines, chat, relatórios
├── users/
│   └── users.module.ts     # Perfil, senha, exclusão de conta
└── prisma/
    └── schema.prisma       # Modelos e migrações
```

---

## Endpoints — Referência Completa

> Todos os endpoints usam o prefixo `/api/v1`. O Swagger em `/docs` permite testar interativamente.

### 🔓 Auth (público)

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/auth/register` | Cadastra novo usuário (PROFESSIONAL ou PATIENT) |
| `POST` | `/auth/login` | Autentica e retorna JWT |
| `GET` | `/auth/invitation/:token` | Pré-visualiza convite sem autenticação |

**POST `/auth/register`**
```json
{
  "fullName": "Ana Beatriz",
  "email": "ana@email.com",
  "password": "MinhaSenh@123",
  "role": "PROFESSIONAL",
  "cpf": "123.456.789-00",
  "crp": "06/12345",
  "inviteToken": "ABC123"   // opcional — apenas para PATIENT com convite
}
```
Resposta `201`:
```json
{
  "user": { "id": "...", "fullName": "...", "email": "...", "role": "PROFESSIONAL" },
  "accessToken": "eyJ...",
  "token": "eyJ..."
}
```

**POST `/auth/login`**
```json
{ "email": "ana@email.com", "password": "MinhaSenh@123" }
```
Resposta `200`:
```json
{
  "user": { "id": "...", "name": "...", "role": "...", "pixKey": "...", "sessionPrice": 150 },
  "accessToken": "eyJ...",
  "token": "eyJ..."
}
```

---

### 🔐 Convites

Os convites são servidos pelo módulo `care/`. Existia um módulo `invitations/` separado
com uma segunda implementação das mesmas operações, que nenhum cliente chamava; ele foi
removido.

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| `POST` | `/care/professional/invitations` | JWT (PROFESSIONAL) | Gerar um novo link de convite |
| `GET` | `/auth/invitations/:token` | Público | Pré-visualizar um convite |
| `POST` | `/care/patient/invitations/accept` | JWT (PATIENT) | Aceitar convite e trocar de profissional |

**POST `/care/professional/invitations`** — sem body. Resposta `201`:
```json
{
  "inviteCode": "token-url-safe-de-256-bits",
  "inviteLink": "https://app.exemplo/invite/token-url-safe-de-256-bits"
}
```
Token de uso único, validade de 7 dias. O convite anterior segue válido, para não
quebrar links já enviados.

---

### 🔐 Consultations

| Método | Rota | Role | Descrição |
|--------|------|------|-----------|
| `GET` | `/consultations` | Ambos | Listar consultas do usuário |
| `POST` | `/consultations` | PROFESSIONAL | Agendar consulta |
| `PATCH` | `/consultations/:id` | PROFESSIONAL | Editar data, valor ou tipo de cobrança |
| `PATCH` | `/consultations/:id/cancel` | Ambos | Cancelar consulta |
| `PATCH` | `/consultations/:id/payment` | PROFESSIONAL | Confirmar pagamento PIX |

**POST `/consultations`** — Body:
```json
{
  "patientId": "cuid-do-paciente",
  "dateTime": "2025-09-15T14:00:00.000Z",
  "sessionPrice": "150.00",
  "billingType": "PER_SESSION"
}
```

**Regra de cancelamento**: se o paciente cancelar com menos de `cancellationLimitHours`, o status vai para `PATIENT_NO_SHOW` (cobrança mantida).

---

### 🔐 Assessments (Autoavaliações)

| Método | Rota | Role | Descrição |
|--------|------|------|-----------|
| `POST` | `/assessments` | PATIENT | Registrar autoavaliação |
| `GET` | `/assessments/:patientId` | Ambos | Listar avaliações de um paciente |

**POST `/assessments`** — Body:
```json
{
  "moodScore": 4,
  "sleepScore": 3,
  "energyScore": 4,
  "anxietyScore": 2,
  "socialInteraction": true,
  "note": "Semana difícil mas melhorei"
}
```
Todos os campos são opcionais; os não informados assumem valor neutro. `note` (máx. 150
caracteres) fica cifrado em repouso.

A resposta devolve os mesmos campos mais `wellbeingIndex` (escala 1–5, calculado com a
ansiedade invertida) e `date`. Uma segunda chamada no mesmo dia atualiza o registro
daquele dia em vez de criar outro.

---

### 🔐 Guidelines (Orientações)

| Método | Rota | Role | Descrição |
|--------|------|------|-----------|
| `GET` | `/guidelines/:patientId` | Ambos | Listar orientações de um paciente |
| `POST` | `/guidelines/:patientId` | PROFESSIONAL | Adicionar orientação |

**POST `/guidelines/:patientId`** — Body:
```json
{
  "title": "Respiração ao acordar",
  "text": "Praticar respiração diafragmática por 10 minutos ao acordar."
}
```

`title` (máx. 120 caracteres) é opcional e fica cifrado em repouso, como o conteúdo.
Orientações gravadas antes desse campo existir são exibidas no mural do paciente com o
rótulo genérico "Orientação recebida".

---

### 🔐 Chat

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/chat/messages` | Enviar mensagem |
| `GET` | `/chat/messages/sync` | Sincronizar (polling) |

**POST `/chat/messages`** — Body:
```json
{
  "receiverId": "uuid-do-destinatario",
  "text": "Olá, como você está?"
}
```

**GET `/chat/messages/sync`** — Query params:
```
?partnerId=uuid&since=1700000000000
```
Retorna as mensagens mais recentes que `since` (timestamp Unix em ms). Cada mensagem vem
como `{ id, senderId, receiverId, text, isRead, createdAt }` — `text` já decifrado, sem
nenhuma coluna de ciphertext.

---

### 🔐 Reports

| Método | Rota | Role | Descrição |
|--------|------|------|-----------|
| `GET` | `/reports/export` | PROFESSIONAL | Exportar Carnê-Leão por competência |

**GET `/reports/export`** — Query params:
```
?month=9&year=2025
```
Resposta: array de registros agrupados por CPF para o livro-caixa fiscal.

---

### 🔐 Users

| Método | Rota | Descrição |
|--------|------|-----------|
| `PUT` | `/users/profile` | Atualizar perfil |
| `DELETE` | `/users/me` | Excluir conta (LGPD Soft Delete) |

**PUT `/users/profile`** — Body (todos opcionais):
```json
{
  "fullName": "Novo Nome",
  "email": "novo@email.com",
  "currentPassword": "SenhaAtual123",  // obrigatório ao mudar e-mail ou senha
  "newPassword": "NovaSenha456",
  "cpf": "123.456.789-00",
  "crp": "06/12345",
  "address": "Rua das Flores, 42",
  "pixKey": "psicologa@pix.com",
  "sessionDefaultPrice": 160,
  "cancellationLimitHours": 24
}
```

**DELETE `/users/me`** — Body:
```json
{ "password": "SenhaAtual123" }
```
Resultado: anonimização de dados pessoais conforme LGPD. CPF e ID são preservados para fins fiscais.

---

### 🛡️ Admin & Observabilidade (exclusivo para `Role.ADMIN`)

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/admin/overview` | Resumo de KPIs de usuários, consultas, financeiro e lista de psicólogos com pacientes vinculados |
| `GET` | `/admin/telemetry/routes` | Estatísticas agregadas de rotas (hits, latência média em ms, min/max e taxa de erro) |
| `GET` | `/admin/telemetry/errors` | Feed em tempo real dos últimos 100 erros 4xx/5xx da aplicação |
| `POST` | `/admin/impersonate/:userId` | Emite Actor Token seguro (RFC 8693) para testar conta em modo simulação com auditoria |
| `POST` | `/admin/sandbox/seed` | Cria 1 psicólogo de teste + 2 pacientes demo + consultas e avaliações com `isTestUser: true` |
| `DELETE` | `/admin/sandbox/clean` | Remove com total segurança todas as contas e dados com `isTestUser: true` |

---

### 🌐 Health (público)

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/health` | Health check |

Resposta: `{ "status": "ok", "service": "ojanuan-api" }`

---

## Segurança

### Autenticação
- Guard JWT global via `APP_GUARD` no `AppModule`
- Decorator `@Public()` para rotas sem autenticação
- Token inspecionado com `JwtService.verify` em cada request

### Validação de Input
- `ValidationPipe({ whitelist: true, transform: true })` aplicado globalmente
- `whitelist: true` remove campos não declarados nos DTOs automaticamente
- Todos os DTOs usam decorators do `class-validator`

### Proteção de Dados Sensíveis
- Senhas hasheadas com `bcrypt` (rounds=12)
- Verificação de senha obrigatória para mudanças sensíveis (email, senha)
- Soft Delete preserva CPF/ID para o Carnê-Leão

---

## Prisma e Banco de Dados

```bash
# Criar nova migração
cd api
npx prisma migrate dev --name nome-da-migracao

# Aplicar em produção
npx prisma migrate deploy

# Abrir Prisma Studio (GUI)
npx prisma studio

# Regenerar client após alteração no schema
npx prisma generate
```

---

## Convenções de Código

- Cada módulo NestJS é um arquivo único (`*.module.ts`) com Service + Controller + DTO + Module
- Nomenclatura de erros: sempre em português, descritiva para o usuário final
- Logs de erro com `console.error` para rastreabilidade
- Campos opcionais sempre com `?` no TypeScript e `@IsOptional()` no DTO
