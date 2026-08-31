// Ticket Creator 7.0.5 - Bling ISOLATED WORLD

const TC_BLING = '[TC 7.0.5]';
let tcTokenJaEnviado = false;

function tcNormalizarUsuarioSuporte(texto) {
  return String(texto || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tcExtrairToken(texto) {
  texto = tcNormalizarUsuarioSuporte(texto);
  if (!texto) return '';
  const completo = texto.match(/suportesys@[^\s]+\s+[^\s]+/i);
  if (completo) return tcNormalizarUsuarioSuporte(completo[0]);
  const apenasLogin = texto.match(/suportesys@[^\s]+/i);
  if (apenasLogin) return tcNormalizarUsuarioSuporte(apenasLogin[0]);
  return '';
}

function tcMascararToken(valor) {
  const login = String(valor || '').split(' ')[0];
  return login ? `${login} ***` : '***';
}

function tcLerDadosConsulta() {
  let nomeEl = document.getElementById('nome');
  if (!nomeEl) {
    const labels = Array.from(document.querySelectorAll('label'));
    const labelNome = labels.find((l) => {
      const t = tcNormalizarUsuarioSuporte(l.textContent);
      return t === 'nome' || t.startsWith('nome ') || t.startsWith('nome*');
    });
    if (labelNome) {
      const forAttr = labelNome.getAttribute('for');
      if (forAttr) nomeEl = document.getElementById(forAttr);
    }
  }
  const nome = nomeEl ? tcNormalizarUsuarioSuporte(nomeEl.value || '') : '';
  const idEmpresa = new URLSearchParams(window.location.search).get('buscaid') || '';
  console.log(TC_BLING, 'Dados de consulta — nome:', nome || '(NÃO ENCONTRADO)', '| idEmpresa:', idEmpresa || '(NÃO ENCONTRADO)');
  return { nome, idEmpresa };
}

function tcEhFluxoConsulta() {
  return window.location.href.includes('from=consulta_usuario');
}

function tcEnviarToken(token, origem = 'desconhecida') {
  if (tcTokenJaEnviado) return;
  token = tcExtrairToken(token);
  if (!token) {
    console.log(TC_BLING, 'Ignorado, não é usuário de suporte:', origem);
    return;
  }
  tcTokenJaEnviado = true;
  console.log(TC_BLING, 'Enviando token via', origem, tcMascararToken(token));

  if (tcEhFluxoConsulta()) {
    const { nome, idEmpresa } = tcLerDadosConsulta();
    chrome.runtime.sendMessage({ action: 'usuarioSuporteConsultado', token, ativo: true, nome, idEmpresa });
  } else {
    chrome.runtime.sendMessage({ action: 'tokenPreCapturadoReal', token });
  }
}

function tcEnviarFallback() {
  if (tcTokenJaEnviado) return;
  tcTokenJaEnviado = true;
  console.log(TC_BLING, 'Fallback: TOKEN_NAO_LOCALIZADO');
  if (tcEhFluxoConsulta()) {
    const { nome, idEmpresa } = tcLerDadosConsulta();
    chrome.runtime.sendMessage({ action: 'usuarioSuporteConsultado', token: 'TOKEN_NAO_LOCALIZADO', ativo: true, nome, idEmpresa });
  } else {
    chrome.runtime.sendMessage({ action: 'tokenPreCapturadoReal', token: 'TOKEN_NAO_LOCALIZADO' });
  }
}

function tcEnviarInativo() {
  if (tcTokenJaEnviado) return;
  tcTokenJaEnviado = true;
  console.log(TC_BLING, 'Usuário de suporte não ativo para esta conta.');
  const { nome, idEmpresa } = tcLerDadosConsulta();
  chrome.runtime.sendMessage({ action: 'usuarioSuporteConsultado', token: null, ativo: false, nome, idEmpresa });
}

function tcOuvirMainWorld() {
  window.addEventListener('TICKET_CREATOR_TOKEN_COPIADO', (event) => {
    const detail = event.detail;
    const bruto = typeof detail === 'string' ? detail : detail && detail.texto;
    tcEnviarToken(bruto, 'CustomEvent MAIN');
  });
  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const data = event.data || {};
    if (data.fonte !== 'TICKET_CREATOR') return;
    if (data.tipo === 'TOKEN_COPIADO') tcEnviarToken(data.texto, 'postMessage MAIN');
  });
}

function tcEncontrarBotaoUsuarioSuporte() {
  return document.getElementById('usuario_suporte') ||
    Array.from(document.querySelectorAll('a, button, span, div'))
      .find(el => /usu[aá]rio de suporte/i.test(el.textContent || ''));
}

async function tcLerClipboard() {
  try {
    if (!navigator.clipboard || !navigator.clipboard.readText) return '';
    return tcExtrairToken(await navigator.clipboard.readText());
  } catch (e) { return ''; }
}

function tcDispararCliqueConfiavel(botao) {
  try {
    botao.scrollIntoView({ block: 'center', inline: 'nearest' });
    botao.focus && botao.focus();
    ['pointerdown', 'mousedown', 'mouseup', 'click'].forEach((tipo) => {
      botao.dispatchEvent(new MouseEvent(tipo, { bubbles: true, cancelable: true, view: window }));
    });
    botao.click();
    return true;
  } catch (e) {
    try { botao.click(); return true; } catch (e2) { return false; }
  }
}

console.log(TC_BLING, 'Bling estruturado injetado com sucesso.');

// ==========================================
// FLUXO 1: IA AUTOMÁTICA E CONSULTA DE USUÁRIO DE SUPORTE
// ==========================================
if (window.location.href.includes('from=fluxo_ia_auto') || window.location.href.includes('from=consulta_usuario')) {
  console.log(TC_BLING, 'Modo ativado');
  tcOuvirMainWorld();

  if (tcEhFluxoConsulta()) {
    // Sequência assíncrona em 3 etapas: nome → botão → token
    (async () => {
      // ETAPA 1: espera o nome carregar (sem teto curto)
      const nomePronto = await new Promise((resolve) => {
        const t = setInterval(() => {
          if (tcTokenJaEnviado) { clearInterval(t); resolve(false); return; }
          const el = document.getElementById('nome');
          if (el && el.value && el.value.trim()) { clearInterval(t); resolve(true); }
        }, 100);
        setTimeout(() => { clearInterval(t); resolve(false); }, 25000);
      });

      if (!nomePronto || tcTokenJaEnviado) {
        if (!tcTokenJaEnviado) tcEnviarFallback();
        return;
      }

      console.log(TC_BLING, 'Nome carregado. Buscando botão...');

      // ETAPA 2: espera o botão aparecer (3s após o nome)
      const botaoPronto = await new Promise((resolve) => {
        let ticks = 0;
        const t = setInterval(() => {
          if (tcTokenJaEnviado) { clearInterval(t); resolve(null); return; }
          ticks++;
          const b = tcEncontrarBotaoUsuarioSuporte();
          if (b) { clearInterval(t); resolve(b); return; }
          if (ticks >= 20) { clearInterval(t); resolve(null); }
        }, 100);
      });

      if (tcTokenJaEnviado) return;

      if (!botaoPronto) {
        console.log(TC_BLING, 'Botão não encontrado — usuário de suporte não ativo.');
        tcEnviarInativo();
        return;
      }

      // ETAPA 3: clica e aguarda token via postMessage/CustomEvent ou clipboard
      console.log(TC_BLING, 'Clicando no botão.');
      tcDispararCliqueConfiavel(botaoPronto);

      await new Promise((resolve) => {
        let ticks = 0;
        const t = setInterval(async () => {
          if (tcTokenJaEnviado) { clearInterval(t); resolve(); return; }
          ticks++;
          const clip = await tcLerClipboard();
          if (clip) {
            clearInterval(t);
            tcEnviarToken(clip, 'clipboard após clique');
            resolve();
            return;
          }
          if (ticks === 40) {
            console.log(TC_BLING, 'Segundo clique após 4s sem resultado.');
            tcDispararCliqueConfiavel(botaoPronto);
          }
          if (ticks >= 60) {
            clearInterval(t);
            if (!tcTokenJaEnviado) tcEnviarFallback();
            resolve();
          }
        }, 100);
      });
    })();

  } else {
    // FLUXO IA AUTOMÁTICA: comportamento original sem mudanças
    let tentativas = 0, cliques = 0, ultimoClique = 0;
    const timerIa = setInterval(async () => {
      if (tcTokenJaEnviado) { clearInterval(timerIa); return; }
      tentativas++;
      const clip = await tcLerClipboard();
      if (clip) { clearInterval(timerIa); tcEnviarToken(clip, 'clipboard readText'); return; }
      const botao = tcEncontrarBotaoUsuarioSuporte();
      const agora = Date.now();
      if (botao && cliques < 4 && tentativas >= 6 && (agora - ultimoClique > 1100)) {
        cliques++; ultimoClique = agora; tcDispararCliqueConfiavel(botao);
      }
      if (tentativas >= 150) { clearInterval(timerIa); tcEnviarFallback(); }
    }, 100);
  }
}

// ==========================================
// FLUXO 2: BOTÃO VERDE CLÁSSICO (TICKET MANUAL)
// ==========================================
if (window.location.href.includes('from=ticket_creator')) {
  console.log(TC_BLING, 'Modo ativado: Redirecionamento de Ticket Tradicional');
  const intervaloBotaoVerde = setInterval(() => {
    const cnpjInput = document.getElementById('cnpj') || document.querySelector('input[name="cnpj"]');
    if (cnpjInput && cnpjInput.value.trim() !== '') {
      const cnpjLimpo = cnpjInput.value.replace(/\D/g, '');
      if (cnpjLimpo.length >= 11) {
        clearInterval(intervaloBotaoVerde);
        sessionStorage.setItem('hyper_stream_cnpj', cnpjLimpo);
        window.location.href = 'https://www.bling.com.br/suporte.php#add';
      }
    }
  }, 100);
}
