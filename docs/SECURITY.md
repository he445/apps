# Segurança e rollout em produção

Este documento registra os controles de segurança e o procedimento de implantação compatível com usuários já ativos.

## Controles aplicados

- O cadastro público aceita apenas `PROFESSIONAL` e `PATIENT`. Contas `ADMIN` são criadas exclusivamente pelo comando de seed com variáveis de ambiente.
- O JWT é validado contra a conta atual no banco; contas desativadas, mudança de papel e mudança de e-mail invalidam a sessão. Tokens emitidos antes desta versão continuam válidos até sua expiração normal de oito horas.
- Tokens emitidos após a migração carregam `tokenVersion`. Ao trocar e-mail ou senha, a versão é incrementada e o cliente recebe um token substituto.
- CORS aceita somente `WEB_ORIGIN` e as origens locais de desenvolvimento; não há mais coringa para domínios Vercel nem credenciais cross-site.
- Novos convites usam token URL-safe de 256 bits, validade de sete dias e uso único. Convites antigos de seis caracteres continuam aceitos para não romper links já enviados.
- Simulação administrativa só aceita contas de teste. A sandbox fica bloqueada em produção, salvo se `ENABLE_SANDBOX_ADMIN=true` for definido de propósito.

## Deploy sem interrupção

1. Confirme que `WEB_ORIGIN` contém a URL exata do frontend em produção. Se houver mais de uma origem autorizada, separe-as por vírgula.
2. Faça backup do banco e aplique primeiro a migração aditiva:

   ```bash
   cd api
   npx prisma migrate deploy
   ```

3. Publique API e frontend na mesma janela. Não é necessário limpar storage, revogar tokens ou derrubar sessões existentes.
4. Verifique `GET /api/v1/health`, login de uma conta existente e o fluxo de convite. Gere novos convites para os próximos pacientes; links antigos não precisam ser substituídos imediatamente.
5. Provisione um administrador apenas se necessário, sem registrar senha em logs:

   ```bash
   ADMIN_EMAIL="admin@empresa.tld" ADMIN_PASSWORD="uma-senha-unica-com-12-ou-mais" npm run prisma:seed
   ```

6. Programe a rotação de qualquer `JWT_SECRET` menor que 32 caracteres. A rotação invalida os JWTs atuais, por isso deve ser comunicada e feita em uma janela controlada.

## Limites conhecidos

O token de acesso fica em `sessionStorage`, reduzindo a persistência após fechar o navegador, mas não substitui proteção contra XSS. Mantenha a política de CSP, dependências e revisão de conteúdo de terceiros sob acompanhamento contínuo.
