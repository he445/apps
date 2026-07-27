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
├── invitations/
│   └── invitations.module.ts  # Criação e aceitação de convites
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

### 🔐 Invitations (parcialmente público)

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| `POST` | `/invitations` | JWT (PROFESSIONAL) | Criar convite |
| `GET` | `/invitations/:token` | Público | Visualizar convite |
| `POST` | `/invitations/:token/accept` | Público | Aceitar convite e criar conta |

**POST `/invitations`** — Body:
```json
{ "patientName": "João Silva" }
```
Resposta `201`: objeto `PatientInvitation` com `token` de 6 caracteres e validade de 7 dias.

---

### 🔐 Consultations

| Método | Rota | Role | Descrição |
|--------|------|------|-----------|
| `GET` | `/consultations` | Ambos | Listar consultas do usuário |
| `POST` | `/consultations` | PROFESSIONAL | Agendar consulta |
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

**POST `/assessments`** — Aceita campos em **português ou inglês**:
```json
{
  "humor_geral": 4,
  "qualidade_sono": 3,
  "nivel_energia": 4,
  "nivel_ansiedade": 2,
  "interacao_social": true,
  "nota": "Semana difícil mas melhorei"
}
```
ou equivalente em inglês (`moodScore`, `sleepScore`, `energyScore`, `anxietyScore`, `socialInteraction`, `quickNote`).

Resposta inclui `indice_bem_estar` calculado automaticamente (0–100).

---

### 🔐 Guidelines (Orientações)

| Método | Rota | Role | Descrição |
|--------|------|------|-----------|
| `GET` | `/guidelines/:patientId` | Ambos | Listar orientações de um paciente |
| `POST` | `/guidelines/:patientId` | PROFESSIONAL | Adicionar orientação |

**POST `/guidelines/:patientId`** — Body:
```json
{ "text": "Praticar respiração diafragmática por 10 minutos ao acordar." }
```

---

### 🔐 Chat

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/chat/messages` | Enviar mensagem |
| `GET` | `/chat/messages/sync` | Sincronizar (polling) |

**POST `/chat/messages`** — Body:
```json
{
  "receiverId": "cuid-do-destinatario",
  "text": "Olá, como você está?",
  "messageText": "Olá, como você está?"  // alias aceito
}
```

**GET `/chat/messages/sync`** — Query params:
```
?partnerId=cuid&since=1700000000000
```
Retorna mensagens mais recentes que `since` (timestamp Unix ms). Resposta inclui `{ text, messageText, timestamp, createdAt }` para máxima compatibilidade.

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
