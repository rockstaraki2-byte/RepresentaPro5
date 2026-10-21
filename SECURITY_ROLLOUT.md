# RepresentaPRO: ativação das correções de segurança

As novas regras e o novo fluxo de autenticação são incompatíveis com a versão atual do app. Não publique só o arquivo de regras nem só o frontend. Faça a ativação em uma janela coordenada, após preparar os dados abaixo.

## Preparação dos dados atuais

1. Faça um backup exportável do Firestore e confirme que ele pode ser restaurado.
2. Configure Application Default Credentials de uma conta administrativa do Firebase e rode a auditoria somente leitura:

   ```sh
   npm run audit:firestore-tenants -- --project=representapro-b84c3
   ```

3. Resolva os registros sem `empresaRepresentacaoId`, vínculos para empresas inexistentes, IDs de empresa inconsistentes, usuários inválidos e e-mails duplicados ou fora de minúsculas. Não atribua tenant ou dono de pedido por suposição. Para pedidos antigos sem `createdByUserId`, use uma associação revisada com o administrador da empresa.
4. Revogue e substitua qualquer senha de app do Gmail que já tenha sido armazenada em `empresas`. Depois do backup, faça a limpeza dos campos sensíveis no Firestore:

   ```sh
   npm run cleanup:firestore-secrets -- --project=representapro-b84c3
   npm run cleanup:firestore-secrets -- --project=representapro-b84c3 --apply --acknowledge-backup
   ```

   O primeiro comando é dry-run. O segundo apaga somente `senha`, `gmailUser` e `gmailAppPass` nos documentos de `usuarios` e `empresas`; ele não altera hashes nem contas do Firebase Authentication.
5. Rode a auditoria novamente. Antes de ativar as regras, `missingTenantLinks`, `unknownTenantLinks`, `companyIdMismatches`, `invalidCompanyRecords`, `invalidBusinessRecords`, `invalidMetaIds`, `missingOrderOwners`, `unrecognizedOrderOwners`, `invalidUsers`, `nonNormalizedEmails`, `duplicateNormalizedEmails` e `documentsWithLegacySecrets` precisam estar em zero, salvo exceções revisadas e documentadas.

## Configuração de autenticação e navegador

- Ative os provedores Email/Senha e Google no Firebase Authentication e confirme os domínios autorizados da aplicação.
- Confirme que a conta do administrador do sistema é `rockstaraki2@gmail.com` e usa uma conta Google verificada. Esse endereço está vinculado às regras de acesso global.
- Instrua cada pessoa cadastrada a abrir o app, escolher **Criar acesso do convite**, criar uma senha e confirmar o endereço. Para quem já tem conta no Firebase Authentication, use **Esqueci minha senha**.
- Cada representante precisa entrar online pelo menos uma vez neste build e aguardar o carregamento dos dados antes de depender do acesso offline. A sessão e uma cópia local dos dados ficam persistidas no aparelho; orientar o uso apenas em dispositivo confiável e a saída da conta ao compartilhar o aparelho.
- O cache offline fica no armazenamento local do navegador e não é criptografado pela aplicação. Enquanto estiver sem rede, o dispositivo não consegue descobrir que uma conta ou permissão foi revogada; ao reconectar, as regras do Firestore voltam a validar leituras e gravações. Revisar alterações pendentes que forem rejeitadas pelo servidor.
- Restrinja a API key pública do Firebase aos domínios de produção e às APIs Firebase necessárias. A chave web não é uma credencial de autorização.
- Configure Firebase App Check com reCAPTCHA v3 e defina `VITE_FIREBASE_APPCHECK_SITE_KEY` no build de produção. O código ativa App Check quando essa variável existe; a exigência no projeto precisa ser habilitada depois de validar as métricas de tráfego.

## Publicação coordenada

1. Conclua a revisão do PR, rode lint, build e os testes das regras no emulador.
2. Confirme que não há gravações pendentes na versão antiga. A nova versão mantém o app shell e os arquivos estáticos em cache para abrir sem rede, e usa o cache persistente do Firestore para mostrar os últimos dados carregados e enfileirar alterações offline. Ao voltar a conexão, o Firestore sincroniza a fila; conflitos no mesmo documento seguem a política de última gravação prevalecer. O botão **Sair** exige conexão, aguarda gravações pendentes e limpa o cache local; não limpe os dados do navegador enquanto houver alterações aguardando sincronização.
3. Publique os índices de `firestore.indexes.json` e aguarde a criação ficar pronta. Em uma janela de manutenção, publique a nova versão do frontend e aplique `firestore.rules` no projeto `representapro-b84c3`:

   ```sh
   firebase deploy --only firestore:indexes --project representapro-b84c3
   firebase deploy --only firestore:rules --project representapro-b84c3
   ```

   Aplique as regras imediatamente após publicar o frontend. Versões antigas serão bloqueadas quando as regras entrarem; usuários verão indisponibilidade até carregarem o frontend novo e criarem/confirmarem o acesso.
4. Valide login, leitura de cada tenant, criação de pedido, cadastro de cliente, edição de permissões e bloqueio de outro tenant com contas reais de teste. Mantenha um plano de restauração das regras e do build.

## Escopo que continua pendente

As rotas Express em `server.ts` foram mantidas sem alteração conforme a autorização recebida. Autenticação nessas rotas, limitação de requisições, limites de anexos e de consumo de IA precisam de uma alteração separada. Até lá, `/api/email/send`, `/api/cnpj/:cnpj` e `/api/gemini/generate` não ganham proteção por este PR. O cliente deixa de enviar credenciais SMTP por tenant; o envio atual só poderá usar as credenciais globais já configuradas no servidor.
