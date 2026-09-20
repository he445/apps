import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { Button, Card } from '../components/UI';

/**
 * Self-service password reset does not exist yet: there is no endpoint and no e-mail
 * provider configured. This screen used to post to `/auth/forgot-password`, which the
 * API never implemented, so every attempt failed with a generic error after promising
 * the e-mail had been sent. It now states the real situation and points to the route
 * that actually works.
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
              A redefinição de senha por e-mail ainda não está disponível no Ojanuan.
            </p>
            <p className="text-sm text-[#6D736E] leading-relaxed">
              Se você é <strong className="text-[#2C332D]">paciente</strong>, peça ao seu
              psicólogo para gerar um novo convite de acesso. Se você é{' '}
              <strong className="text-[#2C332D]">psicólogo(a)</strong>, entre em contato
              com o administrador da plataforma para redefinir sua senha.
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
