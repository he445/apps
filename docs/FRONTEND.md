# Frontend — Guia Técnico

## Visão Geral

SPA React 19 com TypeScript, roteamento via React Router DOM 7, estilização em CSS puro (Tailwind opcional) e comunicação com o backend via Axios.

- **Dev Server**: Vite 6 em `http://localhost:5173`
- **Proxy em dev**: `/api/*` → `http://localhost:3000/api/v1/*` (NestJS real)
- **PWA**: Service Worker gerado pelo `vite-plugin-pwa` com precache automático

---

## Estrutura de Pastas

Publicado a partir de `web/` (irmã de `api/` na raiz do monorepo).

```
web/src/
├── App.tsx                     # Roteamento principal + AuthContext
├── main.tsx                    # Ponto de entrada React (ReactDOM.createRoot)
├── index.css                   # Estilos globais, variáveis CSS, tokens de design
│
├── components/                 # Componentes reutilizáveis
│   ├── Logo.tsx                # Logo Ojanuan (fonte Caveat, cor #C16E59)
│   ├── LayoutBase.tsx          # Shell da aplicação: sidebar, topbar, área de conteúdo
│   └── UI.tsx                  # Primitivos: Button, Input, Card, Badge, Spinner
│
├── pages/
│   ├── Login.tsx               # Tela de autenticação
│   ├── SignUp.tsx              # Cadastro de novo usuário (PROFESSIONAL ou PATIENT)
│   ├── OnboardingInvite.tsx    # Fluxo de onboarding via convite (/invite/:token)
│   ├── PrivacyPolicy.tsx       # Política de Privacidade (/privacidade)
│   ├── ForgotPassword.tsx      # Recuperação de senha (UI)
│   ├── Profile.tsx             # Configurações de perfil (ambos os papéis)
│   │
│   ├── pro/                    # Telas exclusivas do PROFESSIONAL
│   │   ├── Dashboard.tsx       # Lista de pacientes, próximas consultas, convites
│   │   ├── PatientDetail.tsx   # Detalhe do paciente: histórico, avaliações, orientações, chat
│   │   ├── Finance.tsx         # Histórico financeiro, confirmação de PIX, Carnê-Leão
│   │   └── Schedule.tsx        # Agenda completa e agendamentos por paciente
│   │
│   └── patient/                # Telas exclusivas do PATIENT
│       ├── Dashboard.tsx       # Autoavaliação diária, próxima consulta
│       ├── Progress.tsx        # Gráficos de evolução de bem-estar (Recharts)
│       ├── Chat.tsx            # Canal de mensagens com o psicólogo
│       ├── Finance.tsx         # Histórico de sessões e cobranças
│       └── Schedule.tsx        # Consultas agendadas e solicitações
│
├── content/
│   └── privacyPolicy.ts        # Texto e versão da política, isolados do componente
│
├── hooks/
│   └── useChatPolling.ts       # Short-polling (3s) de mensagens via GET /chat/messages/sync
│
├── services/
│   └── api.ts                  # Instância Axios com interceptors de token e 401
│
├── context/                    # React Contexts globais
│   └── (AuthContext, etc.)
│
└── types/                      # Tipos TypeScript globais
    └── index.ts                # ChatMessage, User, Consultation, Assessment, etc.
```

---

## Rotas da Aplicação

| Rota | Componente | Acesso | Descrição |
|------|-----------|--------|-----------|
| `/login` | `Login` | Público | Autenticação |
| `/signup` | `SignUp` | Público | Cadastro de usuário |
| `/invite/:token` | `OnboardingInvite` | Público | Onboarding por convite |
| `/forgot-password` | `ForgotPassword` | Público | Orienta a pedir redefinição ao administrador |
| `/privacidade` | `PrivacyPolicy` | Aberto | Política de Privacidade (sem guard: legível logado e deslogado) |
| `/profile` | `Profile` | Autenticado | Configurações de perfil |
| `/admin/dashboard` | `admin/Dashboard` | ADMIN | Painel Administrativo, métricas, telemetria de rotas, monitor de bugs e sandbox |
| `/pro/dashboard` | `pro/Dashboard` | PROFESSIONAL | Painel do psicólogo |
| `/pro/schedule` | `pro/Schedule` | PROFESSIONAL | Agenda completa e agendamentos por paciente |
| `/pro/patient/:id` | `pro/PatientDetail` | PROFESSIONAL | Detalhe de paciente e diário clínico |
| `/pro/finance` | `pro/Finance` | PROFESSIONAL | Gestão financeira e Carnê-Leão |
| `/patient/dashboard` | `patient/Dashboard` | PATIENT | Painel do paciente |
| `/patient/schedule` | `patient/Schedule` | PATIENT | Visualização de consultas agendadas e solicitações |
| `/patient/progress` | `patient/Progress` | PATIENT | Gráficos de bem-estar |
| `/patient/chat` | `patient/Chat` | Autenticado | Chat clínico |
| `/patient/finance` | `patient/Finance` | PATIENT | Histórico de sessões e PIX |

---

## Serviço de API (`web/src/services/api.ts`)

Instância Axios configurada com:

```typescript
const api = axios.create({
  baseURL: '/api',  // proxy Vite redireciona para /api/v1 do NestJS
  headers: { 'Content-Type': 'application/json' },
});
```

### Interceptor de Request
Anexa automaticamente o JWT de `localStorage`:
```typescript
config.headers.Authorization = `Bearer ${localStorage.getItem('ojanuan_token')}`;
```

### Interceptor de Response (401)
Detecta sessão expirada e desloga **apenas em rotas protegidas**:
```typescript
// Rotas públicas são imunes ao auto-logout:
// /auth/invitation, /invitations, /auth/login, /auth/register
// Páginas públicas: /login, /signup, /invite
```

---

## Hook de Chat Polling (`web/src/hooks/useChatPolling.ts`)

```typescript
const { messages, loading, sendMessage, isPollingActive } = useChatPolling(partnerId);
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `partnerId` | `string \| null` | ID do usuário parceiro (psicólogo ou paciente) |

| Retorno | Tipo | Descrição |
|---------|------|-----------|
| `messages` | `ChatMessage[]` | Mensagens ordenadas por timestamp |
| `loading` | `boolean` | `true` durante a carga inicial |
| `sendMessage` | `(text: string) => Promise<void>` | Envia mensagem com atualização otimista |
| `isPollingActive` | `boolean` | `false` após 5 falhas consecutivas |

**Comportamento**:
- Polling a cada **3 segundos** via `GET /chat/messages/sync?partnerId=&since=`
- **Atualização otimista**: mensagem aparece imediatamente na UI, substituída pelo dado real da API
- **Conversão**: a API devolve `createdAt` (ISO); o hook guarda `timestamp` numérico para ordenar e para servir de cursor `since` do próximo ciclo
- **Auto-pause**: após 5 falhas consecutivas de rede, o polling é pausado e um toast de erro é exibido
- **Reativação automática**: retoma ao enviar uma nova mensagem

---

## Componentes Principais

### `LayoutBase.tsx`
Shell da aplicação autenticada. Contém:
- Sidebar com navegação por papel (PROFESSIONAL/PATIENT)
- Topbar com nome do usuário e avatar
- Área de conteúdo (`<Outlet />` do React Router)
- Gerenciamento de estado de menu mobile

### `UI.tsx`
Primitivos de design system:
```tsx
<Button variant="primary|secondary|ghost|danger" size="sm|md|lg">...</Button>
<Input label="..." error="..." {...register(...)} />
<Card>...</Card>
<Badge variant="success|warning|danger|info">...</Badge>
<Spinner />
```

### `Logo.tsx`
```tsx
<Logo />  // Renderiza "Ojanua n" com o "n" central rotacionado
          // Fonte: Caveat, cor: #C16E59
```

---

## Tipos Globais (`web/src/types/`)

```typescript
interface User {
  id: string;
  fullName: string;
  name: string;          // alias de fullName
  email: string;
  role: 'PROFESSIONAL' | 'PATIENT';
  cpf?: string;
  crp?: string;
  pixKey?: string;
  sessionPrice?: number;
  cancelLimitHours?: number;
}

interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: number;  // Unix ms
}

interface Consultation {
  id: string;
  patientId: string;
  professionalId: string;
  dateTime: string;       // ISO 8601
  sessionPrice: string;
  billingType: 'PIX' | 'INVOICE';
  status: ConsultationStatus;
  paymentStatus: PaymentStatus;
  patientNameForTax: string;
  patientCpfForTax?: string;
}

interface SelfAssessment {
  id: string;
  patientId: string;
  moodScore: number;       // 1-5
  anxietyScore: number;    // 1-5
  sleepScore: number;      // 1-5
  energyScore: number;     // 1-5
  socialInteraction: boolean;
  quickNote?: string;
  createdAt: string;
}
```

---

## Fluxo de Onboarding por Convite

```
Psicólogo cria convite
      │ POST /invitations → { token: "ABCD12" }
      │
      ▼
Paciente recebe link: https://ojanuan.app/invite/ABCD12
      │
      ▼
OnboardingInvite.tsx
      │ GET /auth/invitations/ABCD12
      │ → { patientName, professionalName, expiresAt }
      │
      ▼
Exibe dados do convite
      │
      ▼
Paciente preenche senha e confirma
      │ POST /auth/register { role: "PATIENT", inviteToken: "ABCD12", ... }
      │ → { user, accessToken }
      │
      ▼
Vínculo criado (ProfessionalPatient) + Convite marcado ACCEPTED
Paciente logado automaticamente
```

---

## Estado de Autenticação

O estado de auth é armazenado no `localStorage`:

| Chave | Valor |
|-------|-------|
| `ojanuan_token` | JWT Bearer token |
| `ojanuan_user` | JSON do objeto `User` |

O React Router protege rotas autenticadas verificando `ojanuan_token` no contexto de autenticação (`AuthContext`). Ao detectar `401` em chamada autenticada, o interceptor Axios limpa o storage e redireciona para `/login`.

---

## Gráficos de Progresso (Recharts)

A tela `Progresso.tsx` (PATIENT) e `PacienteDetail.tsx` (PROFESSIONAL) renderizam:

- **LineChart** — evolução de `moodScore`, `sleepScore`, `energyScore`, `anxietyScore` ao longo do tempo
- **RadialBarChart** — índice de bem-estar atual (0–100)

O índice de bem-estar é calculado no backend:
```
indice = ((moodScore + sleepScore + energyScore + (5 - anxietyScore)) / 16) * 100
       + (socialInteraction ? 5 : 0)
```

---

## Guia de Contribuição

### Padrões de código
- **TypeScript strict**: sem `any` explícito
- **Componentes funcionais** com `const` arrow function
- **Props tipadas** com `interface`, não `type`
- **Hooks customizados**: prefixo `use`, arquivo em `src/hooks/`
- **Imports absolutos**: configure `@/` como alias para `src/`

### Convenção de commits
```
feat: adiciona tela de agendamento
fix: corrige cálculo do índice de bem-estar
refactor: extrai componente ModalConfirm
docs: atualiza FRONTEND.md
```

### Adicionando uma nova tela
1. Crie o arquivo em `web/src/pages/pro/` ou `web/src/pages/patient/`
2. Adicione a rota em `App.tsx` dentro do `<Routes>` correto (caminho em inglês)
3. Adicione o link na sidebar em `LayoutBase.tsx`
4. Exporte os tipos necessários em `web/src/types/`

### Adicionando um novo endpoint
1. Adicione a função em `web/src/services/api.ts` ou use `api.get/post/...` diretamente
2. Tipar a resposta com interfaces de `web/src/types/`
3. Tratar erros com `toast.error(err.response?.data?.message || 'Erro desconhecido')`

---

## Performance e PWA

- O bundle principal tem ~794 kB (236 kB gzip) — aceitável para uma SPA com Recharts
- Para reduzir: use `React.lazy` + `Suspense` nas rotas (code-splitting por página)
- O Service Worker (Workbox) faz precache de todos os assets estáticos
- Em modo offline, as telas são exibidas mas os dados ficam indisponíveis (sem cache de API)
