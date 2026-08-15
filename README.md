<div align="center">
  <h1>🌿 Ojanuan</h1>
  <p><strong>Plataforma de Gestão Terapêutica e Vínculo Psicólogo–Paciente</strong></p>
  <p>
    <img src="https://img.shields.io/badge/NestJS-10-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" />
    <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
    <img src="https://img.shields.io/badge/Prisma-5-2D3748?style=for-the-badge&logo=prisma&logoColor=white" />
    <img src="https://img.shields.io/badge/PostgreSQL-Neon-008bb9?style=for-the-badge&logo=postgresql&logoColor=white" />
    <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  </p>
</div>

---

## ✨ O que é o Ojanuan?

**Ojanuan** — fusão de *Ojá* (Iorubá: tecido que protege o bebê) e *Nuã* (Guarani: acolher) — é uma aplicação web full-stack desenvolvida sob o padrão **Mobile-First** e desenhada para unir:

- **Gestão Operacional & Financeira**: Agendamento de consultas, liquidação PIX e relatórios de livro-caixa para consolidação do Carnê-Leão.
- **Acompanhamento Clínico & Acolhimento**: Painel de autoavaliação diária de bem-estar, mural de orientações terapêuticas e chat com notificação de mensagens não lidas em tempo real.
- **Conformidade LGPD & Segurança**: Soft-delete híbrido que atende aos direitos do titular de dados e preserva registros fiscais obrigatórios, com validação de DTOs, guards de autenticação JWT e sanitização de inputs.

---

## 🗂 Arquitetura do Projeto

```text
apps/
├── api/                        # Backend NestJS (REST API)
│   ├── prisma/
│   │   └── schema.prisma       # Modelos Prisma & PostgreSQL (Neon DB)
│   ├── test/
│   │   └── integration.spec.ts # Suíte oficial de testes E2E de integração
│   ├── src/
│   │   ├── auth/               # Autenticação JWT e gestão de convites
│   │   ├── care/               # Consultas, autoavaliações, chat, relatórios
│   │   ├── invitations/        # Criação e aceite de convites
│   │   ├── users/              # Perfil de usuário e exclusão de conta (LGPD)
│   │   ├── common/             # Guards JWT, decoradores e Prisma Service
│   │   └── main.ts             # Bootstrap da aplicação e Swagger UI
│   ├── .env.example            # Modelo de variáveis de ambiente da API
│   └── package.json
├── src/                        # Frontend React 19 (Mobile-First + Desktop)
│   ├── components/             # LayoutBase, UI Kit (Button, Card, Modal, Skeleton)
│   ├── context/                # AuthContext (Estado de autenticação global)
│   ├── hooks/                  # Custom Hooks (ex: useChatPolling)
│   ├── pages/                  # Telas de Pacientes, Psicólogos e Autenticação
│   ├── services/               # Axios API client
│   └── types/                  # Tipos TypeScript globais
├── docs/                       # Documentação técnica detalhada
│   ├── ARCHITECTURE.md         # Diagramas e fluxos de dados
│   ├── BACKEND.md              # Rotas, DTOs e regras de negócio
│   └── FRONTEND.md             # Guia de componentes e estilização
├── vite.config.ts              # Configuração do Vite + Proxy /api → NestJS
├── .gitignore                  # Regras globais de exclusão do Git (Gold Standard)
└── README.md
```

---

## 🚀 Como Rodar Localmente

### Pré-requisitos

- **Node.js** 20+
- **npm** 10+
- Banco de dados PostgreSQL (Recomendado: [Neon](https://neon.tech) — gratuito)

### 1. Instalar dependências

```bash
# Na raiz do workspace
npm install

# No backend NestJS
cd api && npm install
```

### 2. Configurar variáveis de ambiente

Copie os arquivos de exemplo para configurar o ambiente local:

```bash
# Na pasta api/
cp api/.env.example api/.env
```

**`api/.env`** (obrigatório):
```env
DATABASE_URL="postgresql://user:password@ep-sample.neon.tech/neondb?sslmode=require"
PORT=3000
JWT_SECRET="sua-chave-secreta-jwt"
WEB_ORIGIN="http://localhost:5173"
```

Em produção, configure `WEB_ORIGIN` com a origem exata do frontend e use um
`JWT_SECRET` aleatório de ao menos 32 caracteres. O procedimento de deploy sem
interromper sessões, a criação segura do primeiro administrador e a política de
convites estão em [docs/SECURITY.md](docs/SECURITY.md).

### 3. Sincronizar Banco de Dados

```bash
cd api
npx prisma generate
npx prisma db push
```

### 4. Executar em Desenvolvimento

**Início Simultâneo (API NestJS + Web React):**
```bash
npm run dev
```

Endereços disponíveis:
- 🌐 **Frontend Web**: `http://localhost:5173`
- ⚙️ **API REST NestJS**: `http://localhost:3000/api/v1`
- 📖 **Swagger UI (Documentação Interativa)**: `http://localhost:3000/docs`

---

## 🧪 Suíte de Testes de Integração E2E

Para rodar a suíte automatizada que valida 100% dos fluxos (autenticação, convites, chat, relatórios e Soft-Delete):

```bash
npm run test:e2e
```

---

## 🛡️ Segurança e Boas Práticas

- **Proteção de Segredos**: Arquivos `.env` e chaves privadas estão estritamente ignorados pelo `.gitignore`.
- **Validação de Entrada (`ValidationPipe`)**: Propriedades não declaradas em DTOs são rejeitadas automaticamente com `400 Bad Request`.
- **Autenticação JWT & Hash `bcrypt`**: Senhas criptografadas com salt rounds 12.
- **Auditoria de Qualidade**: 0 erros de compilação em `tsc --noEmit` e `nest build`.

---

## 📋 Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Inicia a API NestJS e o Frontend React simultaneamente |
| `npm run dev:api` | Inicia apenas a API NestJS com hot-reload |
| `npm run dev:web` | Inicia apenas o frontend Vite React |
| `npm run test:e2e` | Executa a suíte de testes de integração E2E no backend |
| `npm run lint` | Executa a verificação estática de tipos TypeScript |
| `npm run build` | Gera o bundle otimizado de produção do frontend (`dist/`) |
| `cd api && npm run build` | Compila o backend NestJS (`dist/`) |

---

## 🤝 Licença e Uso

Este repositório está pronto para ser versionado e publicado no GitHub sob os mais altos padrões de engenharia de software.
