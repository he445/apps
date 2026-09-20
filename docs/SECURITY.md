# Segurança e rollout em produção

Este documento registra os controles de segurança e o procedimento de implantação compatível com usuários já ativos.

## Controles aplicados

- O cadastro público aceita apenas `PROFESSIONAL` e `PATIENT`. Contas `ADMIN` são criadas exclusivamente pelo comando de seed com variáveis de ambiente.
- O JWT é validado contra a conta atual no banco; contas desativadas, mudança de papel e mudança de e-mail invalidam a sessão. Tokens emitidos antes desta versão continuam válidos até sua expiração normal de oito horas.
- Tokens emitidos após a migração carregam `tokenVersion`. Ao trocar e-mail ou senha, a versão é incrementada e o cliente recebe um token substituto.
- CORS aceita somente `WEB_ORIGIN` e as origens locais de desenvolvimento; não há mais coringa para domínios Vercel nem credenciais cross-site.
- Novos convites usam token URL-safe de 256 bits, validade de sete dias e uso único. Convites antigos de seis caracteres continuam aceitos para não romper links já enviados.
- Simulação administrativa só aceita contas de teste, e tanto a simulação quanto a geração/limpeza de massa de teste são gravadas em `AuditLog`. O único gate é o papel `ADMIN`, igual ao restante do painel.

## Deploy sem interrupção

1. Confirme que `WEB_ORIGIN` contém a URL exata do frontend em produção. Se houver mais de uma origem autorizada, separe-as por vírgula.
2. Faça backup do banco. As migrations são aplicadas automaticamente: `npm start` roda
   `prisma/deploy.js` antes de subir a API. Para aplicar fora do arranque (ou conferir
   o que está pendente), rode `cd api && npm run migrate:deploy`.

   O script detecta um banco criado com `prisma db push` — sem a tabela de histórico
   `_prisma_migrations`, `migrate deploy` aborta com P3005 e não aplica nada — e nesse
   caso marca a migration inicial como aplicada antes de seguir. As demais migrations
   são aditivas e guardadas por `IF NOT EXISTS`.

   No Render, isso exige que o **Start Command** seja `npm start` (o padrão). Se estiver
   `node dist/main`, as migrations não rodam e o banco volta a ficar defasado.

3. Publique API e frontend na mesma janela. Não é necessário limpar storage, revogar tokens ou derrubar sessões existentes.
4. Verifique `GET /api/v1/health`, login de uma conta existente e o fluxo de convite. Gere novos convites para os próximos pacientes; links antigos não precisam ser substituídos imediatamente.
5. Provisione um administrador apenas se necessário, sem registrar senha em logs:

   ```bash
   ADMIN_EMAIL="admin@empresa.tld" ADMIN_PASSWORD="uma-senha-unica-com-12-ou-mais" npm run prisma:seed
   ```

6. Programe a rotação de qualquer `JWT_SECRET` menor que 32 caracteres. A rotação invalida os JWTs atuais, por isso deve ser comunicada e feita em uma janela controlada.

## Consentimento e direitos do titular (LGPD)

- O cadastro exige aceite da Política de Privacidade (`acceptedPrivacyPolicy`), gravado
  em `User.consentedAt`/`consentVersion`. Sem ele a conta não é criada.
- Contas criadas antes da política ficam com `consentedAt` nulo e caem num aviso
  bloqueante no próximo acesso, com `POST /users/me/consent` para registrar. A página da
  política é acessível nesse estado — ninguém pode aceitar um texto que não consegue ler.
- Ao mudar o texto de forma relevante, atualize `CURRENT_PRIVACY_POLICY_VERSION`
  (`api/src/auth/auth.module.ts`) **e** `PRIVACY_POLICY_VERSION`
  (`web/src/content/privacyPolicy.ts`) juntas.
- `GET /users/me/export` atende o direito de acesso e portabilidade. Deve ser usada
  antes de `DELETE /users/me`, que apaga fisicamente o conteúdo clínico.
- O texto atual é um **rascunho pendente de revisão jurídica** e o contato do
  controlador está como campo a preencher.

## Recuperação de senha

Não há redefinição por e-mail: o produto não tem provedor de envio. O único caminho é
`POST /admin/users/:userId/reset-password`, que gera uma senha temporária, grava só o
hash, incrementa `tokenVersion` (derrubando as sessões do alvo) e registra em
`AuditLog`. A senha aparece uma única vez na resposta e não é armazenada.

## Limites conhecidos

O token de acesso fica em `sessionStorage`, reduzindo a persistência após fechar o navegador, mas não substitui proteção contra XSS. Mantenha a política de CSP, dependências e revisão de conteúdo de terceiros sob acompanhamento contínuo.

`APP_ENCRYPTION_KEY` não tem plano de recuperação: se ela se perder, todo o conteúdo
clínico cifrado torna-se ilegível em definitivo. Guarde-a fora do Render.

O backfill da criptografia (`npm run backfill:encryption`) precisa ser executado uma vez
em produção: o conteúdo gravado antes da criptografia ainda está em texto claro no banco.
