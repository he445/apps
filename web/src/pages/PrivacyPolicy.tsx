import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { Card } from '../components/UI';
import { PRIVACY_POLICY, PRIVACY_POLICY_VERSION } from '../content/privacyPolicy';

/**
 * Reachable logged in or out, so it sits outside PublicRoute — that guard sends an
 * authenticated visitor to their dashboard, and someone already using the app has to be
 * able to read what they agreed to.
 */
export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#F9F8F4] px-4 py-12">
      <div className="w-full max-w-3xl mx-auto flex flex-col gap-8">

        <div className="flex flex-col items-center text-center gap-2">
          <Logo size="lg" />
          <h1 className="text-2xl font-bold text-[#2C332D]">Política de Privacidade</h1>
          <p className="text-xs text-[#6D736E]">Versão {PRIVACY_POLICY_VERSION}</p>
        </div>

        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-xs text-amber-900 leading-relaxed">
            <strong>Rascunho pendente de revisão jurídica.</strong> Este texto descreve
            fielmente o que o sistema faz, mas ainda não passou por análise de um
            advogado. Revise-o antes de abrir a plataforma ao público.
          </p>
        </div>

        <Card className="shadow-md">
          <div className="flex flex-col gap-7">
            {PRIVACY_POLICY.map((section) => (
              <section key={section.title} className="flex flex-col gap-2">
                <h2 className="text-base font-bold text-[#2C332D]">{section.title}</h2>
                {section.paragraphs.map((paragraph, index) => (
                  <p key={index} className="text-sm text-[#6D736E] leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </Card>

        <div className="text-center">
          <Link
            to="/login"
            className="text-sm font-semibold text-[#6D736E] hover:text-[#2C332D] hover:underline"
          >
            Voltar
          </Link>
        </div>

      </div>
    </div>
  );
}
