// Ticket Creator 5.0 - Bling MAIN WORLD
// Substitua o arquivo: scripts/bling-adm-main.js

if (window.location.href.includes('from=fluxo_ia_auto') || window.location.href.includes('from=consulta_usuario')) {
  if (!window.ticketCreatorProxyAtivo50) {
    window.ticketCreatorProxyAtivo50 = true;

    const TC = '[TC 5.0][MAIN]';

    const normalizar = (texto) => String(texto || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const extrairToken = (texto) => {
      texto = normalizar(texto);
      const m = texto.match(/suportesys@[^\s]+\s+[^\s]+/i);
      return m ? normalizar(m[0]) : '';
    };

    const montarToken = (login, senha) => {
      login = normalizar(login);
      senha = normalizar(senha);
      if (!login || !senha) return '';
      if (!/^suportesys@/i.test(login)) return '';
      return `${login} ${senha}`.trim();
    };

    // Mostra só o login no console, nunca a senha/hash (evita vazar credencial em logs/gravações de tela)
    const mascararToken = (valor) => {
      const login = String(valor || '').split(' ')[0];
      return login ? `${login} ***` : '***';
    };

    const enviar = (origem, tokenOuLogin, senha) => {
      let token = senha !== undefined
        ? montarToken(tokenOuLogin, senha)
        : extrairToken(tokenOuLogin);

      if (!token) {
        return false;
      }

      console.log(TC, 'Usuário de suporte capturado via', origem, mascararToken(token));

      window.dispatchEvent(new CustomEvent('TICKET_CREATOR_TOKEN_COPIADO', {
        detail: { origem, texto: token }
      }));

      window.postMessage({
        fonte: 'TICKET_CREATOR',
        tipo: 'TOKEN_COPIADO',
        origem,
        texto: token
      }, window.location.origin);

      return true;
    };

    function instalarProxyCopiarUsuarioSuporteHabilitado() {
      const fn = window.copiarUsuarioSuporteHabilitado;
      if (typeof fn !== 'function') return false;
      if (fn.__ticketCreatorProxy50) return true;

      const original = fn;

      const proxy = function(login, senha) {
        try {
          enviar('função copiarUsuarioSuporteHabilitado(login, senha)', login, senha);
        } catch (e) {
          console.log(TC, 'Erro capturando argumentos:', e);
        }
        return original.apply(this, arguments);
      };

      proxy.__ticketCreatorProxy50 = true;
      proxy.__ticketCreatorOriginal = original;

      window.copiarUsuarioSuporteHabilitado = proxy;
      console.log(TC, 'Proxy instalado em copiarUsuarioSuporteHabilitado');
      return true;
    }

    function instalarProxyClipboard() {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText && !navigator.clipboard.writeText.__ticketCreatorProxy50) {
          const originalWriteText = navigator.clipboard.writeText.bind(navigator.clipboard);

          const proxyWriteText = function(text) {
            try {
              enviar('navigator.clipboard.writeText', text);
            } catch (e) {}
            return originalWriteText(text);
          };

          proxyWriteText.__ticketCreatorProxy50 = true;
          navigator.clipboard.writeText = proxyWriteText;
          console.log(TC, 'Proxy instalado em navigator.clipboard.writeText');
        }
      } catch (e) {
        console.log(TC, 'Não conseguiu instalar proxy clipboard:', e);
      }
    }

    function instalarProxyExecCommand() {
      try {
        if (!document.execCommand || document.execCommand.__ticketCreatorProxy50) return;

        const originalExecCommand = document.execCommand.bind(document);

        const proxyExec = function(command, showUI, value) {
          const result = originalExecCommand(command, showUI, value);

          if (String(command || '').toLowerCase() === 'copy') {
            setTimeout(() => {
              try {
                const texto = normalizar(window.getSelection ? String(window.getSelection()) : '');
                enviar('document.execCommand(copy):selection', texto);
              } catch (e) {}
            }, 30);
          }

          return result;
        };

        proxyExec.__ticketCreatorProxy50 = true;
        document.execCommand = proxyExec;
        console.log(TC, 'Proxy instalado em document.execCommand');
      } catch (e) {
        console.log(TC, 'Não conseguiu instalar proxy execCommand:', e);
      }
    }

    function instalarListenersCopy() {
      document.addEventListener('copy', (event) => {
        try {
          if (!event.clipboardData) return;
          enviar('copy-event:text/plain', event.clipboardData.getData('text/plain'));
          enviar('copy-event:text/html', event.clipboardData.getData('text/html'));
        } catch (e) {}
      }, true);
    }

    function avisarPronto() {
      window.postMessage({
        fonte: 'TICKET_CREATOR',
        tipo: 'MAIN_PRONTO_50'
      }, window.location.origin);
    }

    function instalarTudo() {
      instalarProxyClipboard();
      instalarProxyExecCommand();
      const fnOk = instalarProxyCopiarUsuarioSuporteHabilitado();
      if (fnOk) avisarPronto();
      return fnOk;
    }

    instalarListenersCopy();

    let tentativas = 0;
    const timer = setInterval(() => {
      tentativas += 1;
      const ok = instalarTudo();

      if (ok && tentativas > 5) {
        // Continua mais um pouco por segurança, mas não para cedo demais.
      }

      if (tentativas >= 120) {
        clearInterval(timer);
        console.log(TC, 'Fim do monitoramento MAIN');
      }
    }, 100);

    instalarTudo();
    console.log(TC, 'Monitor iniciado');
  }
}
