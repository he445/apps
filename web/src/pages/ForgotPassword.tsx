import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { Button, Card } from '../components/UI';

/**
 * There is no self-service reset: the product has no e-mail provider. Recovery goes
 * through an administrator, who issues a temporary password from the admin panel.
 * This screen used to post to `/auth/forgot-password`, an endpoint the API never
 * implemented, and promised an e-mail that was never sent.
 */
export default function ForgotPassword() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9F8F4] px-4 py-12">
      <div className="w-full max-w-md flex flex-col gap-8 animate-fade-in">

        <div className="flex flex-col items-center text-center gap-2">
          <Logo size="lg" />
          <h2 className="text-xl font-bold text-[#2C332D]">Recuperar Senha</h2>
        </div>

        <Card className="shadow-md">
          <div className="flex flex-col gap-5">
            <p className="text-sm text-[#6D736E] leading-relaxed">
              A redefinição automática por e-mail ainda não está disponível no Ojanuan.
            </p>
            <p className="text-sm text-[#6D736E] leading-relaxed">
              Entre em contato com o administrador da plataforma: ele gera uma senha
              temporária para a sua conta e a envia para você. Ao entrar, troque a senha
              em <strong className="text-[#2C332D]">Perfil</strong>.
            </p>

            <Link to="/login" className="mt-2">
              <Button variant="primary" className="w-full">
                Voltar para o Login
              </Button>
            </Link>
          </div>
        </Card>

      </div>
    </div>
  );
}
