// ==========================================
// 1. ESTEIRA DE AUTOMAÇÃO (MANTIDA 100% FUNCIONAL)
// ==========================================

function iniciarCascataSuporte() {
  const cnpj = sessionStorage.getItem('hyper_stream_cnpj');
  if (!cnpj) return;
  
  sessionStorage.removeItem('hyper_stream_cnpj');

  console.log('Ticket Creator (Hyper-Stream): Iniciando esteira para o CNPJ: ' + cnpj);

  const esteiraCliques = setInterval(() => {
    const btnRegistrar = document.getElementById('btnReportar');
    const inputEmpresa = document.querySelector('input[placeholder="Pesquise aqui..."]');

    if (inputEmpresa) {
      clearInterval(esteiraCliques);
      inputEmpresa.focus();
      
      setTimeout(() => {
        inputEmpresa.value = cnpj;
        inputEmpresa.dispatchEvent(new Event('input', { bubbles: true }));
        inputEmpresa.dispatchEvent(new Event('change', { bubbles: true }));
        
        aguardarDropdownEIncluir();
      }, 150);
      return;
    }

    if (btnRegistrar) btnRegistrar.click();
  }, 100);
}

function aguardarDropdownEIncluir() {
  const intervaloDropdown = setInterval(() => {
    const cadastradoItem = Array.from(document.querySelectorAll('li.Dropdown-item')).find(item => {
      return item.offsetWidth > 0 && item.offsetHeight > 0;
    });
    
    if (cadastradoItem) {
      clearInterval(intervaloDropdown);
      cadastradoItem.click(); 
      
      setTimeout(() => {
        const btnIncluir = document.getElementById('incluirAtendimento');
        if (btnIncluir) {
          btnIncluir.click();
          configurarOpcoesFinais();
        }
      }, 350);
    }
  }, 100);
}

function configurarOpcoesFinais() {
  const intervaloOpcoes = setInterval(() => {
    const chkChat = document.getElementById('registroChat');
    const chkLigacao = document.getElementById('ligacaoTelefonica');

    if (chkChat) {
      clearInterval(intervaloOpcoes);

      if (chkLigacao && chkLigacao.checked) chkLigacao.click();
      if (chkChat && !chkChat.checked) chkChat.click();

      if (window.location.href.includes('idEmpresa=')) {
        window.history.replaceState({}, document.title, "https://www.bling.com.br/suporte.php#add");
      }
    }
  }, 100);
}

// ==========================================
// 2. REGRA ULTRA TURBO: COPIA DUPLA COM TEXTO MACRO REFINADO
// ==========================================

function obterDadosDoTicketReal() {
  const spanTicket = document.querySelector('span[title="Copiar número do Ticket"]');
  if (!spanTicket) return null;

  const numeroTicketReal = spanTicket.textContent.replace('#', '').trim();
  if (!numeroTicketReal) return null;

  return {
    numero: numeroTicketReal,
    url: window.location.href
  };
}

// Escapa caracteres que teriam significado especial em HTML, pra um dado inesperado
// (ex: URL ou número de ticket com aspas/colchetes) nunca quebrar pra fora do link montado abaixo.
function tcEscaparHtml(texto) {
  return String(texto || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function copiarTicketUltraSmart(dados) {
  // FORMATO 1: Para o Slack (Continua colando apenas o link elegante com a hashtag)
  const blobHtml = new Blob([`<a href="${tcEscaparHtml(dados.url)}">#${tcEscaparHtml(dados.numero)}</a>`], { type: 'text/html' });
  
  // FORMATO 2: Para o Octadesk (Texto puro contendo a macro oficial atualizada com # e negrito)
  const textoMacroOctadesk = `Analisei seu caso e encaminhei para nossa Equipe de Engenharia e Soluções Avançadas, pois a situação exige uma análise técnica mais profunda, algo que vai além das configurações básicas que ajustamos por aqui. Entendo que você gostaria de resolver isso imediatamente e peço desculpas pelo inconveniente de ter que aguardar. 

Seu ticket é: **#${dados.numero}**
 
🔎 Como acompanhar:
▪️Pelo e-mail cadastrado no Bling.
▪️Por meio da tela de tickets, acessível no ponto de interrogação (?) > Tickets e telefonia > Meus tickets ou clicando aqui.

⚠️ No momento, não consigo fornecer um prazo exato de retorno, pois dependerá da complexidade da situação, mas tenha certeza de que será o mais rápido possível.`;

  const blobText = new Blob([textoMacroOctadesk], { type: 'text/plain' });
  
  const item = new ClipboardItem({
    'text/html': blobHtml,
    'text/plain': blobText
  });
  
  navigator.clipboard.write([item]).then(() => {
    const btn = document.getElementById('btn-copiar-ticket-creator');
    if (btn) {
      btn.innerText = 'MACRO COPIADA! 🚀';
      btn.style.backgroundColor = '#3FAF6C';
      setTimeout(() => {
        btn.innerText = `COPIAR TICKET #${dados.numero} 📋`;
        btn.style.backgroundColor = '#2F66DF';
      }, 2000);
    }
  }).catch(err => console.error('Erro ao copiar:', err));
}

function gerenciarBotaoCopiar() {
  const dados = obterDadosDoTicketReal();
  const botaoExistente = document.getElementById('btn-copiar-ticket-creator');
  
  if (!dados) {
    if (botaoExistente) botaoExistente.remove();
    return;
  }
  
  if (botaoExistente && botaoExistente.dataset.ticketId === dados.numero) return;
  if (botaoExistente) botaoExistente.remove();
  
  const btn = document.createElement('button');
  btn.id = 'btn-copiar-ticket-creator';
  btn.dataset.ticketId = dados.numero;
  btn.innerText = `COPIAR TICKET #${dados.numero} 📋`;
  
  Object.assign(btn.style, {
    position: 'fixed',
    bottom: '25px',
    right: '25px',
    zIndex: '999999',
    backgroundColor: '#2F66DF',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '30px',
    padding: '12px 24px',
    fontSize: '13px',
    fontWeight: 'bold',
    cursor: 'pointer',
    boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
    transition: 'all 0.2s ease',
    fontFamily: 'sans-serif'
  });
  
  btn.addEventListener('click', () => copiarTicketUltraSmart(dados));
  document.body.appendChild(btn);
}

iniciarCascataSuporte();
window.addEventListener('load', iniciarCascataSuporte);
setInterval(gerenciarBotaoCopiar, 500);
