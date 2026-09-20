/**
 * Texto da política de privacidade e do termo de consentimento.
 *
 * Fica isolado do componente para poder ser revisado e versionado sem mexer em JSX.
 *
 * IMPORTANTE: `PRIVACY_POLICY_VERSION` precisa ser atualizada junto com
 * `CURRENT_PRIVACY_POLICY_VERSION` em `api/src/auth/auth.module.ts` sempre que o texto
 * mudar de forma relevante. O backend é quem grava a versão aceita em
 * `User.consentVersion`; esta constante existe só para exibir na tela.
 */

export const PRIVACY_POLICY_VERSION = '2026-09-20';

export interface PolicySection {
  title: string;
  paragraphs: string[];
}

export const PRIVACY_POLICY: PolicySection[] = [
  {
    title: 'Quem é o responsável pelos seus dados',
    paragraphs: [
      'O Ojanuan é uma plataforma de acompanhamento terapêutico que liga psicólogos e pacientes. O responsável pelo tratamento dos dados (controlador, na linguagem da LGPD) é a pessoa ou empresa que opera esta instalação do Ojanuan, cujos contatos estão no final desta página.',
      'O seu psicólogo é quem conduz o atendimento clínico e decide o que registrar sobre você. A plataforma fornece a ferramenta e guarda os registros em nome dele.',
    ],
  },
  {
    title: 'Quais dados coletamos',
    paragraphs: [
      'Dados de cadastro: nome completo, e-mail e senha. Para pacientes, CPF, usado na emissão dos registros fiscais do atendimento. Para psicólogos, número de CRP, chave PIX e endereço.',
      'Dados de acompanhamento clínico, informados por você ou pelo seu psicólogo: autoavaliações diárias (humor, sono, energia, ansiedade, interação social e uma anotação opcional), orientações terapêuticas enviadas pelo profissional e mensagens trocadas no chat da plataforma.',
      'Dados de atendimento e cobrança: data e horário das consultas, valor, forma de cobrança e situação do pagamento.',
      'Registros técnicos: data e hora de ações administrativas, endereço IP associado a erros do sistema e informações mínimas necessárias para operar e depurar a aplicação.',
    ],
  },
  {
    title: 'Por que tratamos esses dados, e com qual base legal',
    paragraphs: [
      'As informações de acompanhamento clínico são dados pessoais sensíveis referentes à saúde. Elas são tratadas com base no seu consentimento específico e destacado, nos termos do art. 11, inciso I, da Lei nº 13.709/2018 (LGPD) — é exatamente esse consentimento que você concede ao criar a conta.',
      'Os dados de cadastro e de cobrança são tratados para executar o serviço que você contratou e para cumprir obrigações legais e fiscais do profissional, em especial a escrituração do livro-caixa e do Carnê-Leão.',
      'Não usamos seus dados para publicidade, não os vendemos e não os utilizamos para treinar sistemas de inteligência artificial.',
    ],
  },
  {
    title: 'Quem tem acesso',
    paragraphs: [
      'Seu conteúdo clínico é acessível a você e ao psicólogo ao qual sua conta está vinculada. Nenhum outro paciente ou profissional da plataforma o alcança.',
      'O administrador da plataforma tem acesso a dados operacionais (contas existentes, volume de consultas, erros do sistema) e pode, quando necessário para suporte, redefinir a senha de uma conta. A simulação de contas para testes é restrita a contas marcadas como de teste, e toda ação administrativa desse tipo fica registrada.',
      'Ao trocar de psicólogo, o profissional anterior perde o acesso ao seu histórico na plataforma.',
    ],
  },
  {
    title: 'Como protegemos',
    paragraphs: [
      'O conteúdo clínico — mensagens do chat, anotações das autoavaliações e orientações terapêuticas — é cifrado na aplicação com AES-256-GCM antes de chegar ao banco de dados. Quem tivesse acesso direto ao banco ou a uma cópia dele não leria esse conteúdo.',
      'As senhas nunca são armazenadas: guardamos apenas um resumo criptográfico (bcrypt), que não permite recuperar a senha original.',
      'A comunicação entre o seu navegador e os servidores é feita por HTTPS.',
    ],
  },
  {
    title: 'Onde os dados ficam e com quem são compartilhados',
    paragraphs: [
      'A aplicação é hospedada em provedores de infraestrutura contratados para esse fim, que atuam como operadores e não usam os dados para finalidade própria. Os servidores podem estar localizados fora do Brasil.',
      'Fora esses provedores, não compartilhamos seus dados com terceiros, salvo por determinação legal ou ordem judicial.',
    ],
  },
  {
    title: 'Por quanto tempo guardamos',
    paragraphs: [
      'Enquanto sua conta existir, seus dados permanecem disponíveis para você e para o seu psicólogo.',
      'Ao excluir sua conta, apagamos definitivamente as mensagens do chat, as autoavaliações e as orientações terapêuticas, e substituímos seu nome e e-mail por valores anonimizados.',
      'Os registros de consultas já realizadas são preservados, inclusive o nome e o CPF usados na emissão, porque o psicólogo precisa deles para cumprir obrigações fiscais. Eles deixam de estar associados à sua conta ativa.',
      'A exclusão é irreversível. Antes de excluir, você pode baixar uma cópia completa dos seus dados pela tela de Perfil.',
    ],
  },
  {
    title: 'Seus direitos',
    paragraphs: [
      'A LGPD garante a você, entre outros: confirmar que tratamos seus dados, acessá-los, corrigir dados incompletos ou desatualizados, solicitar a portabilidade, revogar o consentimento e pedir a eliminação dos dados tratados com base nele.',
      'Acesso e portabilidade estão disponíveis diretamente no aplicativo: em Perfil, o botão "Baixar meus dados" gera um arquivo com tudo que temos sobre você, com o conteúdo clínico já decifrado. Correção de cadastro também é feita em Perfil, e a exclusão da conta fica na mesma tela.',
      'Revogar o consentimento equivale a encerrar o uso da plataforma, já que sem ele não é possível manter o acompanhamento clínico. Para os demais pedidos, use o contato abaixo.',
    ],
  },
  {
    title: 'Mudanças nesta política',
    paragraphs: [
      'Se alterarmos esta política de forma relevante, pediremos um novo aceite no seu próximo acesso. Registramos a data e a versão do texto que você aceitou.',
    ],
  },
  {
    title: 'Contato',
    paragraphs: [
      'Dúvidas, solicitações sobre seus dados ou exercício de direitos: fale com o administrador da plataforma ou com o seu psicólogo, que encaminhará o pedido.',
      '[PREENCHER: nome do controlador, e-mail de contato e, se houver, encarregado pelo tratamento de dados (DPO).]',
    ],
  },
];

/** Texto curto ao lado do checkbox no cadastro. */
export const CONSENT_CHECKBOX_LABEL =
  'Li e concordo com a Política de Privacidade e autorizo o tratamento dos meus dados de saúde para o acompanhamento terapêutico, conforme o art. 11, I, da LGPD.';
