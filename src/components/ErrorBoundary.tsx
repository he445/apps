/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Sem esta barreira, um erro de render em qualquer página derrubava a árvore
 * inteira e deixava a tela branca, sem mensagem e sem caminho de recuperação.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }


  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private handleReload = () => {
    this.setState({ error: null });
    window.location.assign('/');
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F8F4] px-4">
        <div className="w-full max-w-md bg-white border border-[#7A8B76]/15 rounded-[24px] p-8 flex flex-col gap-4 text-center shadow-xs">
          <h1 className="text-lg font-bold text-[#2C332D]">Algo saiu do lugar por aqui</h1>
          <p className="text-sm text-[#6D736E]">
            Encontramos um erro inesperado ao montar esta tela. Seus dados não foram
            afetados — nada do que você registrou se perdeu.
          </p>
          <button
            onClick={this.handleReload}
            className="mt-2 inline-flex items-center justify-center font-bold rounded-full bg-[#7A8B76] text-white text-sm min-h-[44px] px-6 hover:bg-[#6b7c67] transition-colors cursor-pointer"
          >
            Voltar ao início
          </button>
          {import.meta.env.DEV && (
            <pre className="mt-2 text-left text-[11px] text-[#B54B3C] bg-[#F9F8F4] border border-[#7A8B76]/15 rounded-lg p-3 overflow-x-auto">
              {this.state.error.message}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
