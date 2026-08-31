// Ticket Creator - Bling Status Page (status.bling.com.br)
// Só roda quando a própria extensão abre essa aba (nunca por navegação manual do usuário).
//
// O site migrou de plataforma (era Freshstatus, agora é Atlassian Statuspage) —
// os seletores abaixo foram atualizados pra essa estrutura nova (agosto/2026).

const TS_LOG = '[TC STATUS]';

function tsNormalizar(texto) {
  return String(texto || '').replace(/\s+/g, ' ').trim();
}

function tsElementoVisivel(el) {
  if (!el) return false;
  const estilo = window.getComputedStyle(el);
  return estilo.display !== 'none' && estilo.visibility !== 'hidden' && el.offsetParent !== null;
}

// Preenche um campo simulando digitação real (native setter + eventos sintéticos),
// pra garantir que qualquer validação JS do formulário perceba a mudança.
function tsDefinirValor(el, valor) {
  if (!el) return false;
  valor = String(valor || '').trim();

  const proto = el.tagName === 'TEXTAREA'
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');

  const setValue = (v) => {
    if (descriptor && descriptor.set) {
      descriptor.set.call(el, v);
    } else {
      el.value = v;
    }
  };

  const fire = (type, extra = {}) => {
    let ev;
    if (type === 'input' || type === 'beforeinput') {
      ev = new InputEvent(type, { bubbles: true, cancelable: true, inputType: extra.inputType || 'insertText', data: extra.data ?? null });
    } else {
      ev = new Event(type, { bubbles: true, cancelable: true });
    }
    el.dispatchEvent(ev);
  };

  el.focus();
  setValue('');
  fire('input', { inputType: 'deleteContentBackward', data: '' });
  fire('beforeinput', { inputType: 'insertText', data: valor });
  setValue(valor);
  fire('input', { inputType: 'insertText', data: valor });
  fire('change');
  return true;
}

function tsEsperarPor(condicaoFn, { tentativasMax = 100, intervaloMs = 150 } = {}) {
  return new Promise((resolve) => {
    let tentativas = 0;
    const t = setInterval(() => {
      tentativas += 1;
      const resultado = condicaoFn();
      if (resultado) {
        clearInterval(t);
        resolve(resultado);
      } else if (tentativas >= tentativasMax) {
        clearInterval(t);
        resolve(null);
      }
    }, intervaloMs);
  });
}

function tsPaginaMostrando404() {
  const texto = document.body ? document.body.textContent : '';
  return /error 404/i.test(texto) || (/\b404\b/.test(texto) && /not found/i.test(texto));
}

// Sinal de que a página do Statuspage carregou de verdade: o body sempre
// ganha uma classe com "status" nela, mesmo quando não há nenhum incidente
// ativo no momento (que é o estado mais comum no dia a dia).
function tsPaginaCarregou() {
  return document.readyState === 'complete' && document.body && /status/i.test(document.body.className || '');
}

// Cada link de título de incidente aponta pra /incidents/{id} — usa isso como
// âncora em vez de classes, que podem mudar em atualizações do Statuspage.
function tsListarIncidentesAtivos() {
  const links = Array.from(document.querySelectorAll('a[href^="/incidents/"], a[href*="status.bling.com.br/incidents/"]'));
  const vistos = new Set();
  const incidentes = [];

  links.forEach((link) => {
    const href = link.getAttribute('href') || '';
    const match = href.match(/\/incidents\/([a-z0-9]+)\/?(?:$|[?#])/i);
    if (!match) return;
    const id = match[1];
    if (vistos.has(id)) return;
    const titulo = tsNormalizar(link.textContent);
    if (!titulo) return;
    vistos.add(id);
    incidentes.push({ id, titulo });
  });

  return incidentes;
}

// O Statuspage gera o botão "Subscribe" de cada incidente com um id previsível
// (btn-subscribe-modal-{id}) e o modal correspondente (subscribe-modal-{id}) —
// muito mais confiável que tentar adivinhar a estrutura do card.
// Abre o modal do incidente tentando duas estratégias, na ordem:
// 1) Chama a API do próprio modal (jQuery/Bootstrap), se existir na página —
//    é o jeito "oficial", sem depender de simular clique nenhum.
// 2) Simula uma sequência de clique realista (mousedown/mouseup/click), pro
//    caso da página só reagir a eventos que pareçam vir de um clique de verdade.
async function tsAbrirModalIncidente(botaoAbrir, id) {
  const esperarModalVisivel = (tentativasMax) => tsEsperarPor(() => {
    const el = document.getElementById('subscribe-modal-' + id);
    return el && tsElementoVisivel(el) ? el : null;
  }, { tentativasMax, intervaloMs: 150 });

  const jq = window.jQuery || window.$;
  if (jq) {
    try {
      jq('#subscribe-modal-' + id).modal('show');
      console.log(TS_LOG, 'Tentei abrir o modal via jQuery .modal(show).');
    } catch (e) {
      console.log(TS_LOG, 'jQuery .modal(show) lançou erro:', e);
    }
    const modalPorJquery = await esperarModalVisivel(15);
    if (modalPorJquery) return modalPorJquery;
  } else {
    console.log(TS_LOG, 'jQuery não encontrado na página — pulando direto pra simulação de clique.');
  }

  console.log(TS_LOG, 'Simulando clique realista no botão Subscribe.');
  ['pointerdown', 'mousedown', 'mouseup', 'click'].forEach((tipo) => {
    botaoAbrir.dispatchEvent(new MouseEvent(tipo, { bubbles: true, cancelable: true, view: window }));
  });
  botaoAbrir.click();

  return esperarModalVisivel(20);
}

async function tsVincularEmail(id, email) {
  let botaoAbrir = document.getElementById('btn-subscribe-modal-' + id)
    || document.querySelector(`a[href="#subscribe-modal-${id}"]`);

  if (!botaoAbrir) {
    // Plano B: acha o link do título desse incidente (isso sempre funciona,
    // porque foi assim que ele apareceu na lista) e procura por um link/botão
    // de "subscribe" perto dele, em vez de depender só do id bater exatamente.
    console.log(TS_LOG, 'Não achei o botão pelo id exato, tentando pelo link do título. id:', id);
    const linkTitulo = document.querySelector(`a[href*="/incidents/${id}"]`);
    if (linkTitulo) {
      let ancestral = linkTitulo.parentElement;
      for (let nivel = 0; nivel < 6 && ancestral && !botaoAbrir; nivel++) {
        botaoAbrir = Array.from(ancestral.querySelectorAll('a, button')).find((el) => {
          const texto = tsNormalizar(el.textContent).toLowerCase();
          const href = (el.getAttribute('href') || '').toLowerCase();
          const idAttr = (el.id || '').toLowerCase();
          return texto === 'subscribe' || href.includes('subscribe') || idAttr.includes('subscribe');
        });
        ancestral = ancestral.parentElement;
      }
    }
  }

  if (!botaoAbrir) {
    // Log de diagnóstico: lista tudo na página com "subscribe" no id/href/texto,
    // pra dar pra entender exatamente o que mudou da próxima vez que isso falhar.
    const pistas = Array.from(document.querySelectorAll('[id*="subscribe" i], [href*="subscribe" i]'))
      .slice(0, 15)
      .map((el) => ({ tag: el.tagName, id: el.id, href: el.getAttribute('href'), texto: tsNormalizar(el.textContent).slice(0, 40) }));
    console.log(TS_LOG, 'Não encontrei o botão Subscribe. id procurado:', id);
    console.log(TS_LOG, 'Pistas encontradas na página (copia isso se for reportar):', JSON.stringify(pistas, null, 2));
    return { sucesso: false, motivo: 'Não encontrei o botão "Subscribe" desse incidente na tela.' };
  }
  const modalEl = await tsAbrirModalIncidente(botaoAbrir, id);

  if (!modalEl) {
    const modalNaPagina = document.getElementById('subscribe-modal-' + id);
    console.log(TS_LOG, 'Modal não abriu a tempo. jQuery disponível?', !!(window.jQuery || window.$),
      '| Modal existe no DOM?', !!modalNaPagina,
      '| classes do modal:', modalNaPagina ? modalNaPagina.className : '(não existe)');
    return { sucesso: false, motivo: 'O formulário de e-mail não abriu a tempo.' };
  }

  const campoEmail = await tsEsperarPor(
    () => modalEl.querySelector('input[type="email"], input[name*="email" i]'),
    { tentativasMax: 30, intervaloMs: 150 }
  );
  if (!campoEmail) {
    return { sucesso: false, motivo: 'Não encontrei o campo de e-mail no formulário.' };
  }

  tsDefinirValor(campoEmail, email);

  const botaoEnviar = Array.from(modalEl.querySelectorAll('button, input[type="submit"], a')).find(
    (b) => tsNormalizar(b.textContent || b.value || '').toLowerCase() === 'subscribe to incident'
  );
  if (!botaoEnviar) {
    return { sucesso: false, motivo: 'Não encontrei o botão de confirmar a inscrição.' };
  }

  botaoEnviar.click();

  // O modal fechar (ou parar de estar visível) é o sinal de que o envio foi aceito.
  const fechou = await tsEsperarPor(
    () => !tsElementoVisivel(modalEl),
    { tentativasMax: 30, intervaloMs: 200 }
  );

  return fechou
    ? { sucesso: true }
    : { sucesso: false, motivo: 'Enviei o formulário, mas não consegui confirmar se deu certo — vale conferir manualmente.' };
}

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'vincularEmailIncidente') {
    tsVincularEmail(request.id, request.email).then((resultado) => {
      chrome.runtime.sendMessage({
        action: 'emailVinculadoResultado',
        id: request.id,
        sucesso: resultado.sucesso,
        motivo: resultado.motivo || ''
      });
    });
    return true;
  }
});

console.log(TS_LOG, 'Injetado na página de status do Bling.');

const TS_FLAG_RECARREGOU = 'by_support_status_recarregou';

if (tsPaginaMostrando404() && !sessionStorage.getItem(TS_FLAG_RECARREGOU)) {
  console.log(TS_LOG, 'Página carregou como 404 — recarregando uma vez antes de desistir.');
  sessionStorage.setItem(TS_FLAG_RECARREGOU, '1');
  location.reload();
} else if (tsPaginaMostrando404()) {
  console.log(TS_LOG, 'Continua 404 mesmo depois de recarregar — desisto e aviso o Octadesk.');
  chrome.runtime.sendMessage({ action: 'incidentesListados', incidentes: [], erro: 'pagina_404' });
} else {
  tsEsperarPor(
    () => (tsPaginaCarregou() ? tsListarIncidentesAtivos() : null),
    { tentativasMax: 60, intervaloMs: 200 }
  ).then((incidentes) => {
    if (incidentes === null) {
      console.log(TS_LOG, 'A página não terminou de carregar a tempo.');
      chrome.runtime.sendMessage({ action: 'incidentesListados', incidentes: [], erro: 'timeout_carregamento' });
      return;
    }
    console.log(TS_LOG, 'Incidentes encontrados:', incidentes);
    chrome.runtime.sendMessage({ action: 'incidentesListados', incidentes });
  });
}
