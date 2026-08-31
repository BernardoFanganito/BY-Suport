document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['chave_gemini'], (res) => {
    if (res.chave_gemini) {
      document.getElementById('chave-gemini').value = res.chave_gemini;
    }
  });
});

document.getElementById('salvar').addEventListener('click', () => {
  const valor = document.getElementById('chave-gemini').value.trim();
  chrome.storage.local.set({ chave_gemini: valor }, () => {
    const status = document.getElementById('status');
    status.textContent = 'Chave salva!';
    setTimeout(() => { status.textContent = ''; }, 2000);
  });
});
