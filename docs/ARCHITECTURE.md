# Arquitetura — Ojanuan

## Visão Geral

O Ojanuan é uma aplicação **full-stack monorepo** organizada em duas camadas principais:

```
┌──────────────────────────────────────────────────────────────┐
│                      CLIENTE (Browser)                       │
│   React 19 SPA + PWA  ·  Vite 6  ·  react-router-dom 7     │
└───────────────────────────┬──────────────────────────────────┘
                            │ HTTP /api/*
                            │ (proxy Vite em dev: /api → NestJS /api/v1)
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                   BACKEND — NestJS 10                        │
│   Porta 3000  ·  Prefixo: /api/v1  ·  JWT Guard Global      │
│                                                              │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│   │   Auth   │  │  Care    │  │  Users   │  │Invitations│  │
│   │ Module   │  │  Module  │  │  Module  │  │  Module  │  │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│        └─────────────┴──────────────┴──────────────┘        │
│                           │                                  │
│              ┌────────────▼───────────┐                      │
│              │   Prisma ORM Client    │                      │
│              └────────────┬───────────┘                      │
└───────────────────────────┬──────────────────────────────────┘
                            │ SSL (sslmode=require)
                            ▼
┌──────────────────────────────────────────────────────────────┐
│              Neon PostgreSQL (Serverless)                     │
│              Região: us-east-1  ·  Provider: postgresql      │
└──────────────────────────────────────────────────────────────┘
```

---

## Fluxo de Desenvolvimento

```
npm run dev
      │
      ├─► NestJS (porta 3000)
      │     └─ /api/v1/*  (rotas reais com banco de dados)
      │     └─ /docs      (Swagger UI interativo)
      │
      └─► Vite (porta 5173)
            └─ /api/* → proxy → http://localhost:3000/api/v1/*
```

---

## Fluxo de Autenticação JWT

```
┌──────────┐     POST /api/v1/auth/login      ┌──────────────┐
│  Cliente │  ──────────────────────────────► │   NestJS     │
│          │  ◄──────────────────────────────  │  AuthService │
│          │    { accessToken, user }          └──────────────┘
│          │                                          │
│  Salva   │                              bcrypt.compare(senha)
│  token   │                              jwt.sign({ sub, role })
│  em      │
│localStorage
└──────────┘

┌──────────┐   Authorization: Bearer <JWT>    ┌──────────────┐
│  Cliente │  ──────────────────────────────► │  JwtAuthGuard│
│          │                                  │  (Global)    │
│          │                                  └──────┬───────┘
│          │     Response 200 / 401                  │ válido
│          │  ◄──────────────────────────────  ┌─────▼──────┐
└──────────┘                                   │ Controller │
                                               └────────────┘
```

**Token JWT**:
- Algoritmo: `HS256`
- Payload: `{ sub: userId, role: "PROFESSIONAL"|"PATIENT", email }`
- Expiração: `8h`
- Armazenamento: `localStorage` (chave: `ojanuan_token`)

**Rotas públicas** (não exigem JWT):
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/invitation/:token`
- `GET /api/v1/invitations/:token`
- `POST /api/v1/invitations/:token/accept`
- `GET /api/v1/health`

---

## Modelo de Dados

```
┌──────────────────┐       ┌──────────────────────┐
│      User        │       │  ProfessionalSettings │
│──────────────────│ 1   1 │──────────────────────│
│ id (cuid)        │◄─────►│ professionalId        │
│ fullName         │       │ pixKey                │
│ email (unique)   │       │ sessionDefaultPrice   │
│ password (bcrypt)│       │ cancellationLimitHours│
│ role (enum)      │       └──────────────────────┘
│ cpf              │
│ crp              │       ┌──────────────────────┐
│ address          │       │  ProfessionalPatient  │
│ isDeleted        │ 1   N │──────────────────────│
└──────┬───────────┘◄─────►│ professionalId        │
       │                   │ patientId             │
       │ 1                 └──────────────────────┘
       │
       │ N          ┌──────────────────────┐
       └───────────►│   Consultation       │
                    │──────────────────────│
                    │ id                   │
                    │ professionalId       │
                    │ patientId            │
                    │ dateTime             │
                    │ sessionPrice         │
                    │ billingType (enum)   │
                    │ status (enum)        │
                    │ paymentStatus (enum) │
                    │ patientNameForTax    │
                    │ patientCpfForTax     │
                    │ paymentConfirmedAt   │
                    └──────────────────────┘

┌──────────────────────┐   ┌──────────────────────┐
│   SelfAssessment     │   │      ChatMessage      │
│──────────────────────│   │──────────────────────│
│ id                   │   │ id                   │
│ patientId            │   │ senderId             │
│ moodScore (1-5)      │   │ receiverId           │
│ anxietyScore (1-5)   │   │ messageText          │
│ sleepScore (1-5)     │   │ createdAt            │
│ energyScore (1-5)    │   └──────────────────────┘
│ socialInteraction    │
│ quickNote            │   ┌──────────────────────┐
│ createdAt            │   │   PatientInvitation  │
└──────────────────────┘   │──────────────────────│
                           │ id                   │
┌──────────────────────┐   │ token (6 chars, uniq)│
│     Guideline        │   │ professionalId       │
│──────────────────────│   │ patientName          │
│ id                   │   │ status (enum)        │
│ text                 │   │ expiresAt (7 dias)   │
│ professionalId       │   └──────────────────────┘
│ patientId            │
│ createdAt            │
└──────────────────────┘
```

---

## Stack Tecnológica

| Camada | Tecnologia | Versão | Uso |
|--------|-----------|--------|-----|
| Frontend | React | 19 | UI declarativa |
| Frontend | TypeScript | 5.8 | Tipagem estática |
| Frontend | Vite | 6 | Build + Dev server |
| Frontend | React Router DOM | 7 | Roteamento SPA |
| Frontend | Axios | 1.x | HTTP client |
| Frontend | Recharts | 3 | Gráficos de progresso |
| Frontend | Lucide React | latest | Ícones |
| Frontend | Motion | 12 | Animações |
| Frontend | Sonner | 2 | Toast notifications |
| Frontend | vite-plugin-pwa | 1 | PWA / Service Worker |
| Backend | NestJS | 10 | Framework Node.js |
| Backend | TypeScript | 5.7 | Tipagem estática |
| Backend | Prisma | 5 | ORM |
| Backend | PostgreSQL | 15+ | Banco de dados (Neon) |
| Backend | JWT | `@nestjs/jwt` | Autenticação |
| Backend | bcrypt | 5 | Hash de senhas |
| Backend | class-validator | 0.14 | Validação de DTOs |
| Backend | Swagger UI | `@nestjs/swagger@7` | Documentação interativa |

---

## Decisões de Arquitetura

### Por que NestJS?
Arquitetura modular com injeção de dependência nativa, integração com Prisma e suporte first-class ao OpenAPI/Swagger. Ideal para APIs REST tipadas com TypeScript.

### Por que Neon PostgreSQL?
Banco serverless com cold-start rápido, tier gratuito generoso, suporte SSL nativo e compatibilidade total com Prisma sem configuração adicional.

### Por que PWA?
Pacientes acessam frequentemente no mobile. O Service Worker com Workbox garante cache offline das telas estáticas e notificações futuras.

### Soft Delete Híbrido (LGPD)
Ao excluir conta, o sistema **anonimiza** dados pessoais (nome → "Titular excluído", e-mail → `deleted-{id}@anonymized.invalid`, senha → vazia) mas **mantém** CPF e ID para auditoria fiscal do Carnê-Leão, conforme Lei 9.250/95.

### Modo Simulação Seguro & Actor Token (RFC 8693)
Para suporte e testes sem atrito no Beta, o sistema adota o padrão internacional **RFC 8693**:
- O token JWT emitido carrega o `sub` do usuário simulado e o claim `act` com a identidade do Administrador.
- **Guardrails**: Operações destrutivas (troca de senha, alteração de email e exclusão de conta) são bloqueadas na simulação.
- **Isolamento Sandbox**: Personas de teste são sinalizadas com `isTestUser = true`, blindando usuários reais contra qualquer limpeza de dados.

### Telemetria e Observabilidade em Tempo Real
- `TelemetryInterceptor` global captura de forma não-bloqueante a latência de cada endpoint, contagem de acessos (hits) e exceções não tratadas 4xx/5xx para monitoramento proativo de bugs.

