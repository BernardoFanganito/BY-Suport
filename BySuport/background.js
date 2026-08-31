// ==========================================
// ORQUESTRADOR SEQUENCIAL PRIVILEGIADO (BACKGROUND)
// ==========================================

let respostaOctadeskPendente = null;
let dadosGeminiObtidos = null;
let tokenBlingObtido = null;
let idAbaOctadesk = null;
let idEmpresaPendente = null;

const consultasUsuarioSuportePendentes = {};
const consultasIncidentesPendentes = {};

chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[BY Support BG] Mensagem recebida:', request.action, '| sender.id:', sender.id?.slice(0, 8), '| runtime.id:', chrome.runtime.id?.slice(0, 8));

  if (!sender.id || sender.id !== chrome.runtime.id) {
    console.log('[BY Support BG] BLOQUEADO — sender inválido');
    return false;
  }

  if (request.action === 'openBlingTab') {
    chrome.tabs.create({ url: request.url, index: sender.tab.index + 1, active: true });
    return;
  }

  if (request.action === 'openSlackTab') {
    chrome.tabs.create({ url: request.url, index: sender.tab.index + 1, active: true });
    sendResponse({ sucesso: true });
    return;
  }

  if (request.action === 'dispararFluxoTotalSequencial') {
    respostaOctadeskPendente = sendResponse;
    dadosGeminiObtidos = null;
    // Só zera o token se não chegou um tokenCacheInjetado desta mesma empresa
    if (tokenBlingObtido === null || request.idEmpresa !== idEmpresaPendente) {
      tokenBlingObtido = null;
    }
    console.log('[BY Support BG] dispararFluxoTotalSequencial — tokenBlingObtido no início:', tokenBlingObtido ? 'TEM TOKEN' : 'null', '| idEmpresa:', request.idEmpresa);
    idAbaOctadesk = sender.tab.id;
    idEmpresaPendente = request.idEmpresa;

    chrome.storage.local.get(['chave_gemini'], (config) => {
      const chaveGemini = config.chave_gemini;
      const urlGeminiReal = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${chaveGemini}`;

      fetch(urlGeminiReal, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: request.contents })
      })
      .then(async res => {
        if (res.ok) {
          const json = await res.json();
          dadosGeminiObtidos = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } else {
          dadosGeminiObtidos = '{"titulo_situacao": "Suporte Operacional", "situacao": "Coleta concluída"}';
        }

        console.log('[BY Support BG] IA concluída — tokenBlingObtido:', tokenBlingObtido ? 'TEM TOKEN' : 'null');

        if (tokenBlingObtido !== null) {
          console.log('[BY Support BG] Usando token do cache — NÃO abre o Bling.');
          if (respostaOctadeskPendente) {
            respostaOctadeskPendente({ sucesso: true, geminiRaw: dadosGeminiObtidos, token: tokenBlingObtido });
            respostaOctadeskPendente = null;
          }
          return;
        }

        console.log('[BY Support BG] Token null — abrindo Bling.');
        chrome.tabs.sendMessage(idAbaOctadesk, { action: 'atualizarStatusBotao', status: "BUSCANDO TOKEN BLING... 🔑" });
        const urlBlingAuto = `https://www.bling.com.br/adm.empresa.php?buscaid=${idEmpresaPendente}&from=fluxo_ia_auto`;
        chrome.tabs.create({ url: urlBlingAuto, index: sender.tab.index + 1, active: true });
      })
      .catch(() => {
        dadosGeminiObtidos = '{"titulo_situacao": "Suporte Técnico", "situacao": "Conferência de logs operacionais"}';
        if (tokenBlingObtido !== null) {
          if (respostaOctadeskPendente) {
            respostaOctadeskPendente({ sucesso: true, geminiRaw: dadosGeminiObtidos, token: tokenBlingObtido });
            respostaOctadeskPendente = null;
          }
          return;
        }
        const urlBlingAuto = `https://www.bling.com.br/adm.empresa.php?buscaid=${idEmpresaPendente}&from=fluxo_ia_auto`;
        chrome.tabs.create({ url: urlBlingAuto, index: sender.tab.index + 1, active: true });
      });
    });

    return true;
  }

  if (request.action === 'tokenCacheInjetado') {
    console.log('[BY Support BG] tokenCacheInjetado recebido — token:', request.token ? 'TEM TOKEN' : 'null');
    tokenBlingObtido = request.token;
    if (respostaOctadeskPendente && dadosGeminiObtidos !== null) {
      respostaOctadeskPendente({ sucesso: true, geminiRaw: dadosGeminiObtidos, token: tokenBlingObtido });
      respostaOctadeskPendente = null;
    }
    return;
  }

  if (request.action === 'tokenPreCapturadoReal') {
    tokenBlingObtido = request.token;
    chrome.tabs.remove(sender.tab.id, () => {
      if (idAbaOctadesk) {
        chrome.tabs.update(idAbaOctadesk, { active: true }, () => {
          if (respostaOctadeskPendente && dadosGeminiObtidos !== null) {
            respostaOctadeskPendente({ sucesso: true, geminiRaw: dadosGeminiObtidos, token: tokenBlingObtido });
            respostaOctadeskPendente = null;
          }
        });
      }
    });
  }

  if (request.action === 'consultarUsuarioSuporte') {
    const abaOctadeskQuePediu = sender.tab.id;
    chrome.tabs.create({ url: request.url, index: sender.tab.index + 1, active: true }, (novaAba) => {
      consultasUsuarioSuportePendentes[novaAba.id] = abaOctadeskQuePediu;
      console.log('[BY Support BG] Consulta iniciada. Aba Bling:', novaAba.id, '| Aba Octadesk:', abaOctadeskQuePediu);
    });
    return;
  }

  if (request.action === 'usuarioSuporteConsultado') {
    console.log('[BY Support BG] Resultado recebido do Bling (aba', sender.tab.id, '):', request);
    const abaQuePediu = consultasUsuarioSuportePendentes[sender.tab.id];
    delete consultasUsuarioSuportePendentes[sender.tab.id];
    chrome.tabs.remove(sender.tab.id, () => {
      if (abaQuePediu) {
        chrome.tabs.update(abaQuePediu, { active: true }, () => {
          chrome.tabs.sendMessage(abaQuePediu, {
            action: 'nomeEmpresaConsultado',
            nome: request.nome,
            idEmpresa: request.idEmpresa,
            token: request.token,
            ativo: request.ativo
          });
        });
      }
    });
  }

  if (request.action === 'listarIncidentesInstabilidade') {
    const abaOctadeskQuePediu = sender.tab.id;
    chrome.tabs.create({ url: 'https://status.bling.com.br/', index: sender.tab.index + 1, active: false }, (novaAba) => {
      consultasIncidentesPendentes[novaAba.id] = { abaOctadesk: abaOctadeskQuePediu };
    });
    return;
  }

  if (request.action === 'incidentesListados') {
    const pendente = consultasIncidentesPendentes[sender.tab.id];
    if (pendente) {
      chrome.tabs.sendMessage(pendente.abaOctadesk, {
        action: 'exibirListaIncidentes',
        incidentes: request.incidentes,
        erro: request.erro || null
      });
    }
    return;
  }

  if (request.action === 'vincularEmailIncidente') {
    const abaStatusDoRemetente = Object.keys(consultasIncidentesPendentes).find(
      (abaId) => consultasIncidentesPendentes[abaId].abaOctadesk === sender.tab.id
    );
    if (abaStatusDoRemetente) {
      chrome.tabs.sendMessage(Number(abaStatusDoRemetente), {
        action: 'vincularEmailIncidente',
        id: request.id,
        email: request.email
      });
    } else {
      chrome.tabs.sendMessage(sender.tab.id, {
        action: 'emailVinculadoResultado',
        sucesso: false,
        motivo: 'A aba de status do Bling não está mais aberta. Clique de novo no botão de instabilidades.'
      });
    }
    return;
  }

  if (request.action === 'emailVinculadoResultado') {
    const pendente = consultasIncidentesPendentes[sender.tab.id];
    delete consultasIncidentesPendentes[sender.tab.id];
    chrome.tabs.remove(sender.tab.id, () => {});
    if (pendente) {
      chrome.tabs.sendMessage(pendente.abaOctadesk, {
        action: 'emailVinculadoResultado',
        sucesso: request.sucesso,
        motivo: request.motivo || ''
      });
    }
    return;
  }
});
