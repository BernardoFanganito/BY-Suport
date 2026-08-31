# BY Support

> Extensão Chrome que automatiza fluxos de suporte no Octadesk, Bling e Slack — reduzindo de 18–25 cliques e ~70 segundos para 2–4 cliques e ~15 segundos por atendimento.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?logo=javascript&logoColor=black)
![Gemini AI](https://img.shields.io/badge/Gemini-AI-8E75B2?logo=google&logoColor=white)
![MV3](https://img.shields.io/badge/Manifest-V3-success)

---

## O problema

Analistas de suporte que atendem simultaneamente no Octadesk precisavam alternar manualmente entre três sistemas (Octadesk, Bling e Slack) para registrar cada atendimento — copiando e colando dados, navegando por telas e repetindo as mesmas ações dezenas de vezes por dia.

| | Antes | Depois |
|---|---|---|
| Cliques por atendimento | 18–25 | 2–4 |
| Tempo médio de registro | ~70s | ~15s |
| Padronização dos dados | ❌ Variava por analista | ✅ Sempre estruturado |

---

## Funcionalidades

### 🤖 Fluxo com IA
Lê a conversa do cliente no Octadesk, analisa com Gemini AI e monta automaticamente um fluxo estruturado com título, situação, exemplos (pedidos, NFs, SKUs), erro retornado, o que foi testado e plataforma envolvida. O analista revisa, edita se necessário, e envia ao canal certo do Slack com um clique.

### 🔑 Consulta de usuário de suporte
Botão que acessa o admin do Bling, captura o usuário de suporte do cliente e exibe o nome da empresa em destaque neon no cabeçalho do chat — com cor única por empresa, permitindo identificar rapidamente qual conta está sendo atendida em cada um dos chats simultâneos. O token fica em cache: nas próximas consultas do mesmo chat, o Bling não é aberto novamente.

### 🎫 Abertura rápida de ticket
Localiza o ID da empresa na tela do Octadesk e abre o ambiente correto do cliente no Bling diretamente, sem busca manual.

### ❗ Painel de instabilidades
Lista os incidentes ativos do [status.bling.com.br](https://status.bling.com.br) dentro do próprio Octadesk. O analista pode vincular o e-mail do cliente a um incidente para que ele seja notificado automaticamente quando o problema for resolvido.

---

## Tecnologias

- **Chrome Extension Manifest V3** — service worker, content scripts, storage API
- **JavaScript (ES2022)** — async/await, MutationObserver, chrome.* APIs
- **Gemini 2.5 Flash API** — análise e estruturação do histórico de chat
- **Atlassian Statuspage** — leitura de incidentes ativos via DOM
- `chrome.storage.session` para dados sensíveis (nunca gravados em disco)
- `chrome.storage.local` para configurações persistentes

---

## Instalação

> A extensão é de uso interno e não está disponível na Chrome Web Store.

1. Faça o download ou clone este repositório
2. Abra `chrome://extensions` no Chrome
3. Ative o **Modo do desenvolvedor** (canto superior direito)
4. Clique em **Carregar sem compactação** e selecione a pasta `BySuport`
5. Clique com o botão direito no ícone da extensão → **Opções**
6. Cole sua chave da [API Gemini](https://aistudio.google.com/apikey) e salve

---

## Segurança

Este projeto passou por uma auditoria completa de segurança com checklist de 10 itens:

- ✅ Validação de remetente em todas as mensagens internas (`sender.id`)
- ✅ HTML sem interpolação dinâmica — dados inseridos via `.value`, nunca via `innerHTML`
- ✅ Nenhuma chave de API ou credencial no código-fonte
- ✅ Permissões mínimas no manifest — sem `tabs`, `host_permissions` restritos
- ✅ Dados sensíveis em `chrome.storage.session` (apenas em memória, nunca em disco)
- ✅ Logs mascarados — credenciais nunca expostas no console
- ✅ `postMessage` com validação de origem (`event.source` + `event.origin`)
- ✅ Nenhuma injeção dinâmica de script (`executeScript` não utilizado)
- ✅ Chamadas externas restritas a domínios declarados no manifest
- ✅ Nenhum import de arquivo externo sem validação

---

## Autor

**Bernardo Fanganito** — Analista de Suporte L1 @ Bling ERP  
[github.com/BernardoFanganito](https://github.com/BernardoFanganito)
