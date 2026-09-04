const LINK_SHORTCUT_SLACK = "https://app.slack.com/client/T03CN9FN057/C073MSB1GNP";

// Guarda nome + usuário de suporte de cada empresa já consultada nesta aba,
// pra não precisar consultar de novo se a gente confundir os chats simultâneos.
const nomesEmpresaCache = {};

// Escuta atualizações de status vindas do background para mudar o texto de ajuda (tooltip) do ícone
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'atualizarStatusBotao') {
    const btnIa = document.getElementById('btn-fluxo-ia');
    if (btnIa) btnIa.title = message.status;
  }
  if (message.action === 'nomeEmpresaConsultado') {
    clearTimeout(window._byConsultaTimeout);
    console.log('[BY Support] Resposta da consulta recebida:', message);

    if (message.idEmpresa && message.nome) {
      const tokenValido = message.token && message.token !== 'TOKEN_NAO_LOCALIZADO';
      const anterior = nomesEmpresaCache[message.idEmpresa];
            const novosDados = {
        nome: message.nome,
        token: tokenValido ? message.token : (anterior ? anterior.token : null)
      };
      nomesEmpresaCache[message.idEmpresa] = novosDados;
      // Persiste no storage de sessão pra sobreviver a recarregamentos da extensão
      chrome.storage.session.get(['bySuportTokenCache'], (res) => {
        const cacheStorage = (res && res.bySuportTokenCache) || {};
        cacheStorage[message.idEmpresa] = novosDados;
        chrome.storage.session.set({ bySuportTokenCache: cacheStorage });
      });
    } else {
      console.log('[BY Support] ATENÇÃO: mensagem chegou sem nome ou sem idEmpresa — o badge não vai aparecer.', message);
    }
    if (message.ativo === false) {
      alert('Usuário de suporte não está ativo para ' + (message.nome || 'este cliente') + '.');
    }
    atualizarBadgeNomeEmpresa();
  }
  if (message.action === 'exibirListaIncidentes') {
    const btnInstabilidade = document.getElementById('btn-instabilidade');
    if (btnInstabilidade) {
      btnInstabilidade.disabled = false;
      btnInstabilidade.title = 'Ver instabilidades ativas';
    }
    if (message.erro) {
      alert('A página de status do Bling não carregou corretamente dessa vez. Clica no botão de instabilidades de novo pra tentar outra vez.');
    } else {
      criarModalIncidentes(message.incidentes);
    }
  }
  if (message.action === 'emailVinculadoResultado') {
    const modal = document.getElementById('modal-incidentes');
    if (message.sucesso) {
      mostrarToast('E-mail vinculado ao incidente com sucesso!');
      if (modal) modal.remove();
    } else {
      const msg = document.getElementById('msg-incidente');
      if (msg) msg.textContent = message.motivo || 'Não foi possível vincular. Tenta de novo?';
      const btnVincular = document.getElementById('btn-vincular-incidente');
      if (btnVincular) { btnVincular.disabled = false; btnVincular.textContent = 'Vincular e-mail'; }
    }
  }
});

// Paleta de cores neon — a mesma empresa sempre cai na mesma cor nesta aba.
function corParaEmpresa(nome) {
  const paleta = ['#39FF14', '#00FFF7', '#FF10F0', '#FFEA00', '#FF6EC7', '#18FFEA', '#FF9100'];
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = (hash * 31 + nome.charCodeAt(i)) >>> 0;
  return paleta[hash % paleta.length];
}

// Aviso curto e discreto no canto da tela (não trava a tela como um alert()).
function mostrarToast(texto) {
  let toast = document.getElementById('toast-by-support');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-by-support';
    toast.className = 'toast-by-support';
    document.body.appendChild(toast);
  }
  toast.textContent = texto;
  toast.style.opacity = '1';
  clearTimeout(toast._timeoutSumir);
  toast._timeoutSumir = setTimeout(() => { toast.style.opacity = '0'; }, 2200);
}

function atualizarBadgeNomeEmpresa() {
  const titulo = document.querySelector('h2[class*="header-title"]');
  if (!titulo) {
    console.log('[BY Support] ATENÇÃO: título do cliente (h2) não encontrado no cabeçalho — badge não pode ser inserido.');
    return;
  }

  if (!titulo.title) titulo.title = titulo.textContent || '';
  titulo.style.maxWidth = '240px';
  titulo.style.overflow = 'hidden';
  titulo.style.textOverflow = 'ellipsis';
  titulo.style.whiteSpace = 'nowrap';
  titulo.style.flexShrink = '0';

  let badge = document.getElementById('badge-nome-empresa');
  if (!badge) {
    badge = document.createElement('span');
    badge.id = 'badge-nome-empresa';
    badge.className = 'badge-nome-empresa';
    titulo.insertAdjacentElement('afterend', badge);

    badge.addEventListener('click', () => {
      const idEmpresaAtual = obterIdEmpresaDaTela();
      const dadosAtuais = idEmpresaAtual && nomesEmpresaCache[idEmpresaAtual];
      if (dadosAtuais && dadosAtuais.token) {
        navigator.clipboard.writeText(dadosAtuais.token).then(() => {
          mostrarToast('Usuário de suporte copiado para a área de transferência');
        });
      }
    });
  }

  const idEmpresa = obterIdEmpresaDaTela();
  const dados = idEmpresa && nomesEmpresaCache[idEmpresa];

  if (dados && dados.nome) {
    if (badge.dataset.nomeAtual !== dados.nome) {
      badge.textContent = dados.nome;
      badge.dataset.nomeAtual = dados.nome;
    }
    const cor = corParaEmpresa(dados.nome);
    badge.style.color = cor;
    badge.style.textShadow = `0 0 6px ${cor}, 0 0 12px ${cor}`;
    badge.style.cursor = dados.token ? 'pointer' : 'default';
    badge.title = dados.token ? 'Clique para copiar o usuário de suporte' : '';
    badge.style.display = 'inline-block';
  } else {
    if (badge.dataset.nomeAtual) {
      badge.textContent = '';
      badge.dataset.nomeAtual = '';
    }
    badge.style.display = 'none';
  }
}

// ==========================================
// 1. INJEÇÃO DOS BOTÕES NO CABEÇALHO DA CONVERSA
// ==========================================
function injetarBotaoTicketCreator() {
  if (document.getElementById('ticket-creator-wrapper')) return;
    const contêineres = Array.from(document.querySelectorAll('div[class*="header-actions-container"], div[class*="_header-actions-container"]'));
  
  const containerAcoes = contêineres.find(c => c.closest('main') || c.closest('[class*="chat-room"]') || c.closest('[class*="conversation"]')) || contêineres[0];
  
  if (containerAcoes) {
    const wrapper = document.createElement('div');
    wrapper.id = 'ticket-creator-wrapper';
    
    const btnIa = document.createElement('button');
    btnIa.id = 'btn-fluxo-ia';
    btnIa.className = 'btn-fluxo-ia-blue';
    btnIa.title = 'Abrir fluxo IA';
    
    const imgIa = document.createElement('img');
    imgIa.src = chrome.runtime.getURL('Slack.png');
    btnIa.appendChild(imgIa);
    btnIa.addEventListener('click', () => dispararFluxoComIA());

    const btn = document.createElement('button');
    btn.id = 'btn-ticket-creator';
    btn.className = 'btn-ticket-creator-green';
    btn.title = 'Registrar suporte';

    const imgSuporte = document.createElement('img');
    imgSuporte.src = chrome.runtime.getURL('logo_exclamacao.png');
    btn.appendChild(imgSuporte);
    btn.addEventListener('click', () => {
      const idEmpresa = obterIdEmpresaDaTela();
      if (idEmpresa) {
        chrome.runtime.sendMessage({ action: 'openBlingTab', url: "https://www.bling.com.br/adm.empresa.php?buscaid=" + idEmpresa + "&from=ticket_creator" });
      } else { alert('ID Empresa não encontrado!'); }
    });

    const btnConsulta = document.createElement('button');
    btnConsulta.id = 'btn-consulta-empresa';
    btnConsulta.className = 'btn-consulta-empresa-purple';
    btnConsulta.title = 'Consultar usuário de suporte';

    const imgConsulta = document.createElement('img');
    imgConsulta.src = chrome.runtime.getURL('usuario_suporte.png');
    btnConsulta.appendChild(imgConsulta);
    btnConsulta.addEventListener('click', () => {
      const idEmpresa = obterIdEmpresaDaTela();
      console.log('[BY Support] Botão consulta clicado. idEmpresa encontrado:', idEmpresa);
      if (idEmpresa) {
        chrome.runtime.sendMessage({ action: 'consultarUsuarioSuporte', url: "https://www.bling.com.br/adm.empresa.php?buscaid=" + idEmpresa + "&from=consulta_usuario" });

        clearTimeout(window._byConsultaTimeout);
        window._byConsultaTimeout = setTimeout(() => {
          console.warn('[BY Support] 15s se passaram sem resposta da consulta. Se isso aconteceu, copia esse console (F12) inteiro e manda pro Bernardo revisar.');
        }, 15000);
      } else { alert('ID Empresa não encontrado!'); }
    });

    const btnInstabilidade = document.createElement('button');
    btnInstabilidade.id = 'btn-instabilidade';
    btnInstabilidade.className = 'btn-instabilidade-red';
    btnInstabilidade.title = 'Ver instabilidades ativas';
    btnInstabilidade.textContent = '❗';
    btnInstabilidade.addEventListener('click', () => {
      btnInstabilidade.disabled = true;
      btnInstabilidade.title = 'Carregando instabilidades...';
      chrome.runtime.sendMessage({ action: 'listarIncidentesInstabilidade' });
    });

    wrapper.appendChild(btnIa);
    wrapper.appendChild(btn);
    wrapper.appendChild(btnConsulta);
    wrapper.appendChild(btnInstabilidade);
    containerAcoes.insertBefore(wrapper, containerAcoes.firstChild);
  }
}

function obterIdEmpresaDaTela() {
  // Busca o rótulo exato "ID Empresa" (com ou sem asterisco), excluindo tooltips
  // que também têm esse texto mas são elementos com filhos.
  const labels = Array.from(document.querySelectorAll('p, div, span, h3, h4, label'));
  const idLabel = labels.find(el => {
    const texto = el.textContent.trim();
    return (texto === 'ID Empresa' || texto === 'ID Empresa *') && el.children.length === 0;
  });

  if (idLabel) {
    // Tenta o container com qualquer variação de nome (com ou sem underscore prefixado)
    const container = idLabel.closest('[class*="field-container"]');
    if (container) {
      const valueElement = container.querySelector('[class*="_text-overflow"], [class*="text-overflow"]');
      if (valueElement && valueElement.textContent.trim()) {
        return valueElement.textContent.trim().replace(/\D/g, '');
      }
    }
    // Fallback: percorre elementos vizinhos procurando um valor numérico longo
    let proximo = idLabel.nextElementSibling;
    for (let i = 0; i < 5 && proximo; i++) {
      const texto = proximo.textContent.trim().replace(/\D/g, '');
      if (texto.length >= 5) return texto;
      proximo = proximo.nextElementSibling || proximo.parentElement?.nextElementSibling;
    }
  }
  return null;
}

function obterEmailClienteDaTela() {
  const candidatos = Array.from(document.querySelectorAll('p, div, span, label'));
  const rotuloEmail = candidatos.find((el) => el.textContent.trim() === 'Email' && el.children.length === 0);
  if (!rotuloEmail) return '';

  const regexEmail = /[^\s<>"]+@[^\s<>"]+\.[^\s<>"]+/;
  let candidato = rotuloEmail.nextElementSibling;
  for (let tentativa = 0; tentativa < 3 && candidato; tentativa++) {
    const match = (candidato.textContent || '').match(regexEmail);
    if (match) return match[0];
    candidato = candidato.nextElementSibling;
  }
  const pai = rotuloEmail.closest('div');
  if (pai) {
    const match = (pai.textContent || '').match(regexEmail);
    if (match) return match[0];
  }
  return '';
}

function criarModalIncidentes(incidentes) {
  if (document.getElementById('modal-incidentes')) return;

  const overlay = document.createElement('div');
  overlay.id = 'modal-incidentes';
  overlay.className = 'modal-fluxo-overlay';
  overlay.innerHTML = '<div class="modal-fluxo-container"><div class="modal-fluxo-header"><span>Instabilidades ativas</span><span class="modal-fluxo-fechar" id="modal-incidentes-fechar">✕</span></div><div id="lista-incidentes-container"></div><div id="detalhe-incidente-container" style="display:none;"><div class="modal-fluxo-grupo"><label id="rotulo-incidente-selecionado"></label></div><div class="modal-fluxo-grupo"><label>E-mail do cliente para notificação</label><input type="email" id="ipt-email-incidente"></div><div id="msg-incidente" class="msg-incidente"></div><button class="btn-modal-enviar" id="btn-vincular-incidente">Vincular e-mail</button><button class="btn-voltar-incidentes" id="btn-voltar-incidentes">← Voltar para a lista</button></div></div>';

  document.body.appendChild(overlay);
  document.getElementById('modal-incidentes-fechar').addEventListener('click', () => overlay.remove());

  const listaContainer = document.getElementById('lista-incidentes-container');
  const detalheContainer = document.getElementById('detalhe-incidente-container');

  if (!incidentes || incidentes.length === 0) {
    const vazio = document.createElement('p');
    vazio.className = 'msg-incidente';
    vazio.textContent = 'Nenhuma instabilidade ativa no momento.';
    listaContainer.appendChild(vazio);
  } else {
    incidentes.forEach((inc) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'item-incidente';
      item.textContent = inc.titulo;
      item.addEventListener('click', () => {
        listaContainer.style.display = 'none';
        detalheContainer.style.display = 'block';
        document.getElementById('rotulo-incidente-selecionado').textContent = inc.titulo;
        document.getElementById('ipt-email-incidente').value = obterEmailClienteDaTela();
        document.getElementById('msg-incidente').textContent = '';

        const btnVincular = document.getElementById('btn-vincular-incidente');
        btnVincular.disabled = false;
        btnVincular.textContent = 'Vincular e-mail';
        btnVincular.onclick = () => {
          const email = document.getElementById('ipt-email-incidente').value.trim();
          if (!email) {
            document.getElementById('msg-incidente').textContent = 'Informe um e-mail antes de vincular.';
            return;
          }
          btnVincular.disabled = true;
          btnVincular.textContent = 'Vinculando...';
          document.getElementById('msg-incidente').textContent = '';
          chrome.runtime.sendMessage({ action: 'vincularEmailIncidente', id: inc.id, email });
        };
      });
      listaContainer.appendChild(item);
    });
  }

  document.getElementById('btn-voltar-incidentes').addEventListener('click', () => {
    detalheContainer.style.display = 'none';
    listaContainer.style.display = 'block';
  });
}

// ==========================================
// 2. DISPARADOR DA IA COM PROMPT ENGENHARADO POR MATRIZ
// ==========================================
async function dispararFluxoComIA() {
  const btnIa = document.getElementById('btn-fluxo-ia');
  const textoChat = obterTextoDaConversa();
  if (!textoChat || textoChat.length < 15) { alert("Abra uma conversa ativa primeiro!"); return; }

  const idEmpresa = obterIdEmpresaDaTela();
  if (!idEmpresa) { alert("Abra a barra lateral contendo o ID Empresa antes!"); return; }

   // Verifica o cache: memória primeiro (mais rápido), depois storage de sessão
  // (persiste entre recarregamentos). A função é async, então pode usar await
  // — garante que o token chegue ao background ANTES de disparar o fluxo.
  const cacheMemoria = nomesEmpresaCache[idEmpresa];
  const tokenMemoria = cacheMemoria && cacheMemoria.token && cacheMemoria.token !== 'TOKEN_NAO_LOCALIZADO'
    ? cacheMemoria.token : null;

  if (tokenMemoria) {
    console.log('[BY Support] Token encontrado na memória — avisando o background.');
    chrome.runtime.sendMessage({ action: 'tokenCacheInjetado', token: tokenMemoria, idEmpresa });
  } else {
    // Memória vazia — aguarda o storage de sessão antes de continuar
    const tokenStorage = await new Promise((resolve) => {
      chrome.storage.session.get(['bySuportTokenCache'], (res) => {
        const cache = (res && res.bySuportTokenCache) || {};
        const dados = cache[idEmpresa];
        const token = dados && dados.token && dados.token !== 'TOKEN_NAO_LOCALIZADO' ? dados.token : null;
        if (token) nomesEmpresaCache[idEmpresa] = dados; // restaura na memória
        resolve(token);
      });
    });
    if (tokenStorage) {
      console.log('[BY Support] Token encontrado no storage de sessão — avisando o background.');
      chrome.runtime.sendMessage({ action: 'tokenCacheInjetado', token: tokenStorage, idEmpresa });
    }
  }

  try {
    btnIa.disabled = true;
    btnIa.style.opacity = "0.4";
    btnIa.title = "REALIZANDO ANÁLISE TÉCNICA PROFUNDA DO CHAT... 🧠";

    const promptLines = [
      "Você é um Engenheiro de Suporte L1 especialista na plataforma Bling.",
      "Analise o histórico de chat e determine com precisão se a situação se trata de uma FALHA DE SISTEMA (Erro/Bug) ou de uma DÚVIDA OPERACIONAL (Como fazer uma configuração ou processo).",
      "",
      "REGRAS CRUCIAIS PARA EVITAR RESPOSTAS GENÉRICAS:",
      "1. PROIBIDO usar palavras soltas como 'Dúvida', 'Problema', 'Suporte', 'Erro' ou 'Falha' sem o contexto do que se trata.",
      "2. Identifique a ação real que o cliente quer executar (Ex: Importar pedidos, emitir nota fiscal, vincular produtos, configurar transportadora).",
      "3. Leia todas as mensagens buscando ativamente por IDs de vendas, códigos de Notas Fiscais, SKUs ou remessas.",
      "4. Diferencie SITUAÇÃO (o que está acontecendo) de TESTADO/VERIFICADO (o que já foi feito para investigar ou tentar resolver) — são campos diferentes, não misture um dentro do outro.",
      "",
      "REGRA ESPECÍFICA PARA 'TESTADO/VERIFICADO': conta como testado/verificado qualquer procedimento de investigação já realizado, seja pelo cliente ou pelo analista — exportações feitas, telas ou configurações conferidas, testes realizados na conta do cliente, ou algo que o próprio cliente relatou ter testado e repassado ao analista. São as AÇÕES já tomadas, não a descrição do problema em si.",
      "",
      "Você deve responder ESTRITAMENTE em formato JSON estruturado puro, sem nenhum tipo de bloco de codigo markdown e sem qualquer texto antes ou depois das chaves.",
      "",
      "{",
      "  \"analise_tecnica_profunda\": \"Obrigatório. Use este espaço para processar seu raciocínio passo a passo. Escreva resumidamente o que o cliente quer fazer, qual é o obstáculo dele, o que já foi testado/verificado e se ele informou algum ID ou código para teste.\",",
      "  \"titulo_situacao\": \"Resumo direto e específico da intenção técnica do cliente. Máximo 10 palavras. Proibido títulos genéricos. Exemplos perfeitos: 'Como importar pedidos manualmente após vincular loja' ou 'Rejeição 203 de ICMS na emissão de nota'.\",",
      "  \"situacao\": \"Descreva de forma completa, em 3 a 5 frases: o que o cliente tentou fazer, em qual tela ou integração, qual a dúvida exata ou erro sistêmico encontrado, e o contexto necessário para quem for continuar o atendimento entender o caso sem precisar reler toda a conversa. Não resuma demais — inclua os detalhes relevantes.\",",
      "  \"exemplo\": \"Varra toda a conversa atrás de códigos, IDs de pedidos, números de Notas Fiscais, SKUs ou remessas — ditos tanto pelo cliente quanto pelo analista. Identifique o número e coloque o tipo dele explicitamente por extenso. PROIBIDO colocar apenas números soltos. Exemplos de formatação esperada: 'Pedido: 12345', 'Nota Fiscal: 999', 'Remessa: 888', 'SKU: ABC-45'. Separe os exemplos por vírgula se houver mais de um. Se não houver nenhum, escreva exatamente: 'Não informado no atendimento.'\",",
      "  \"erro_retornado\": \"Se houver mensagem de erro ou rejeição exata do sistema, copie o texto aqui. Se for uma dúvida operacional de como usar/configurar o sistema, escreva exatamente: 'Não informado (Dúvida Operacional)'.\",",
      "  \"testado_verificado\": \"Liste os procedimentos de investigação já realizados na conta do cliente, pelo cliente ou pelo analista: exportações feitas, configurações conferidas, testes realizados, ou algo que o cliente relatou ter testado e repassado. Seja específico. Exemplos: 'Testada a exportação do pedido 12345 em ambiente Quente', 'Cliente verificou as configurações de frete e confirmou que estavam corretas'. Se nada foi testado ou verificado ainda, escreva exatamente: 'Nenhum teste ou verificação relatado até o momento.'\",",
      "  \"plataforma\": \"Identifique com precisão a plataforma citada. Marketplaces comuns: Shopee, Mercado Livre, Amazon, Magalu, Shein. Transportadoras/fretes: Melhor Envio, Total Express, Jadlog, Correios. Ou o módulo interno do Bling (Ex: Bling Vendas, Bling Notas Fiscais, Bling Logística). Máximo 3 palavras. Se não for possível identificar, escreva 'Bling'.\"",
      "}"
    ];

    const prompt = promptLines.join("\n") + "\n\nHistórico de conversa para auditar:\n" + textoChat;

    chrome.runtime.sendMessage({
      action: 'dispararFluxoTotalSequencial',
      contents: [{ parts: [{ text: prompt }] }],
      idEmpresa: idEmpresa
    }, function(resposta) {
      
      btnIa.disabled = false;
      btnIa.style.opacity = "1";
      btnIa.title = "Abrir fluxo IA";

      let dadosExtraidos = { titulo_situacao: "Dúvida Suporte", situacao: "Análise de Logs", exemplo: "Ver chat", erro_retornado: "Ver anexo", testado_verificado: "Nenhum teste ou verificação relatado até o momento.", plataforma: "Bling" };
      let tokenSuporte = "Não localizado";
      let linksImagens = obterLinksDeImagens();

      if (resposta && resposta.sucesso) {
        if (resposta.geminiRaw) {
          try {
            let textoJSON = resposta.geminiRaw;
            textoJSON = textoJSON.replace(/```json/gi, "").replace(/```/g, "").trim();
            dadosExtraidos = JSON.parse(textoJSON);
          } catch (e) { console.log("Erro de parsing JSON mitigado."); }
        }
        tokenSuporte = resposta.token || "Não localizado";
      }

      criarModalFluxo(dadosExtraidos, linksImagens, tokenSuporte);
    });

  } catch (erro) { 
    btnIa.disabled = false; 
    btnIa.style.opacity = "1"; 
    btnIa.title = "Abrir fluxo IA"; 
  }
}

function obterTextoDaConversa() {
  const seletores = ['div[class*="message-body"]', 'div[class*="message-text"]', 'div[class*="interaction-text"]', 'div[class*="_text-content"]', 'div[class*="chat-bubble"]'];
  let blocos = [];
  for (const s of seletores) { const el = document.querySelectorAll(s); if (el.length > 0) { blocos = Array.from(el); break; } }
  if (blocos.length === 0) { const p = document.querySelector('div[class*="chat-room"], main'); if (p) blocos = Array.from(p.querySelectorAll('p, span, div')); }
  return blocos.map(el => el.textContent.trim()).filter(txt => txt.length > 0 && !txt.includes('Agente atribuído') && !txt.includes('ID Empresa') && !txt.includes('Abertas')).join("\n");
}

function obterLinksDeImagens() {
  return Array.from(document.querySelectorAll('img, a[href*=".png"], a[href*=".jpg"]')).map(img => img.src || img.href).filter(src => src && src.startsWith('http') && !src.includes('avatar') && !src.includes('logo')).join("\n");
}

function criarModalFluxo(dados, imagens, suporteBling) {
  if (document.getElementById('modal-fluxo-ia')) return;
  const overlay = document.createElement('div');
  overlay.id = 'modal-fluxo-ia'; overlay.className = 'modal-fluxo-overlay';
  overlay.innerHTML = '<div class="modal-fluxo-container"><div class="modal-fluxo-header"><span>Conferência de Dados (Esteira Slack Nativa)</span><span class="modal-fluxo-fechar" id="modal-fluxo-fechar">✕</span></div><div class="modal-fluxo-grupo"><label>Título da situação</label><input type="text" id="ipt-fluxo-titulo"></div><div class="modal-fluxo-grupo"><label>Situação (opcional)</label><textarea id="ipt-fluxo-situacao" rows="3"></textarea></div><div class="modal-fluxo-grupo"><label>Exemplo</label><input type="text" id="ipt-fluxo-exemplo"></div><div class="modal-fluxo-grupo"><label>Erro retornado</label><input type="text" id="ipt-fluxo-erro"></div><div class="modal-fluxo-grupo"><label>O que foi testado/verificado?</label><textarea id="ipt-fluxo-testado" rows="2"></textarea></div><div class="modal-fluxo-grupo"><label>Plataforma (opcional)</label><input type="text" id="ipt-fluxo-plataforma"></div><div class="modal-fluxo-grupo"><label>Usuário de suporte (Token do Bling Adm)</label><input type="text" id="ipt-fluxo-usuario"></div><div class="modal-fluxo-grupo"><label>Links de Imagens</label><textarea id="ipt-fluxo-imagens" rows="2"></textarea></div><div class="modal-fluxo-grupo"><label>Ambientes</label><div class="modal-fluxo-checkboxes"><label><input type="checkbox" name="amb-fluxo" value="Todos"> Todos</label><label><input type="checkbox" name="amb-fluxo" value="Quente" checked> Quente</label><label><input type="checkbox" name="amb-fluxo" value="Beta"> Beta</label><label><input type="checkbox" name="amb-fluxo" value="Alpha"> Alpha</label></div></div><button class="btn-modal-enviar" id="btn-modal-enviar">Prosseguir para o Slack 🦘</button></div>';

  document.body.appendChild(overlay);

  document.getElementById('ipt-fluxo-titulo').value = dados.titulo_situacao || '';
  document.getElementById('ipt-fluxo-situacao').value = dados.situacao || '';
  document.getElementById('ipt-fluxo-exemplo').value = dados.exemplo || '';
  document.getElementById('ipt-fluxo-erro').value = dados.erro_retornado || '';
  document.getElementById('ipt-fluxo-testado').value = dados.testado_verificado || '';
  document.getElementById('ipt-fluxo-plataforma').value = dados.plataforma || 'Bling';
  document.getElementById('ipt-fluxo-usuario').value = suporteBling || '';
  document.getElementById('ipt-fluxo-imagens').value = imagens || '';

  document.getElementById('modal-fluxo-fechar').addEventListener('click', () => overlay.remove());
  document.getElementById('btn-modal-enviar').addEventListener('click', () => {
    const ambs = Array.from(document.querySelectorAll('input[name="amb-fluxo"]:checked')).map(c => c.value);
    const pacote = {
      titulo: document.getElementById('ipt-fluxo-titulo').value || "Dúvida Suporte",
      situacao: document.getElementById('ipt-fluxo-situacao').value || "Análise de Logs",
      exemplo: document.getElementById('ipt-fluxo-exemplo').value || "Ver chat",
      erro: document.getElementById('ipt-fluxo-erro').value || "Ver anexo",
      testado: document.getElementById('ipt-fluxo-testado').value || "Nenhum teste ou verificação relatado até o momento.",
      plataforma: document.getElementById('ipt-fluxo-plataforma').value,
      imagens: document.getElementById('ipt-fluxo-imagens').value,
      ambientes: ambs.join(', ') || 'Quente',
      usuario: document.getElementById('ipt-fluxo-usuario').value
    };

    chrome.storage.session.set({ 'dados_fluxo_ia_pendente': pacote }, () => {
      chrome.runtime.sendMessage({ action: 'openSlackTab', url: LINK_SHORTCUT_SLACK });
      overlay.remove();
    });
  });
}

const tracker = new MutationObserver(() => {
  injetarBotaoTicketCreator();
  atualizarBadgeNomeEmpresa();
});
tracker.observe(document.body, { childList: true, subtree: true });
