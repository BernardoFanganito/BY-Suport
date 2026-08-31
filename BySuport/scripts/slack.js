// Ticket Creator 5.3.1 - Slack robusto
// Substitua o arquivo: scripts/slack.js

const TC32 = '[TC 5.3.1]';

let tcTentativas = 0;
let tcPreenchimentoFinalizado = false;

// Controle da limpeza após envio
let tc53ObservandoEnvio = false;
let tc53ObserverEnvio = null;
let tc53TimeoutEnvio = null;

function tcNormalizar(txt) {
  return String(txt || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function tcDefinirValorReact(el, valor) {
  if (!el || valor == null) return false;

  valor = String(valor || '').trim();

  if (!valor) return false;

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
      ev = new InputEvent(type, {
        bubbles: true,
        cancelable: true,
        inputType: extra.inputType || 'insertText',
        data: extra.data ?? null
      });
    } else if (type.startsWith('key')) {
      ev = new KeyboardEvent(type, {
        bubbles: true,
        cancelable: true,
        key: extra.key || ' ',
        code: extra.code || 'Space'
      });
    } else {
      ev = new Event(type, {
        bubbles: true,
        cancelable: true
      });
    }

    el.dispatchEvent(ev);
  };

  el.scrollIntoView({
    block: 'center',
    inline: 'nearest'
  });

  el.focus();
  el.click();

  setValue('');

  fire('input', {
    inputType: 'deleteContentBackward',
    data: ''
  });

  fire('keydown', {
    key: valor[0] || 'a'
  });

  fire('beforeinput', {
    inputType: 'insertText',
    data: valor
  });

  setValue(valor);

  fire('input', {
    inputType: 'insertText',
    data: valor
  });

  fire('keyup', {
    key: valor[valor.length - 1] || 'a'
  });

  fire('change');

  /*
    Slack/Block Kit às vezes mostra o valor, mas mantém o campo
    como inválido até detectar uma alteração adicional.

    A extensão adiciona um espaço e depois o remove,
    simulando uma edição manual.
  */
  setTimeout(() => {
    if (!document.body.contains(el)) return;

    el.focus();

    setValue(valor + ' ');

    fire('input', {
      inputType: 'insertText',
      data: ' '
    });

    fire('change');

    setTimeout(() => {
      if (!document.body.contains(el)) return;

      setValue(valor);

      fire('input', {
        inputType: 'deleteContentBackward',
        data: null
      });

      fire('change');
      fire('blur');

      el.blur();
    }, 140);
  }, 160);

  return true;
}

function tcObterModalSlack() {
  return document.querySelector('.ReactModal__Content') ||
    document.querySelector('[role="dialog"][aria-label]') ||
    document.querySelector('[role="dialog"]');
}

function tcCampoEstaVisivel(el) {
  if (!el) return false;

  const r = el.getBoundingClientRect();

  return r.width > 0 && r.height > 0;
}

function tcObterCamposTexto(modal) {
  return Array.from(
    modal.querySelectorAll('input, textarea')
  ).filter((el) => {
    const type = (
      el.getAttribute('type') || 'text'
    ).toLowerCase();

    return (
      tcCampoEstaVisivel(el) &&
      ![
        'hidden',
        'file',
        'checkbox',
        'radio',
        'submit',
        'button'
      ].includes(type) &&
      !el.disabled
    );
  });
}

function tcObterTextoProximo(el) {
  const textos = [];

  let atual = el;

  for (let i = 0; i < 5 && atual; i++) {
    textos.push(
      atual.innerText ||
      atual.textContent ||
      ''
    );

    atual = atual.parentElement;
  }

  const parent = el.parentElement;

  if (parent && parent.previousElementSibling) {
    textos.push(
      parent.previousElementSibling.innerText ||
      parent.previousElementSibling.textContent ||
      ''
    );
  }

  return tcNormalizar(textos.join(' '));
}

function tcMontarCamposPorLabel(campos) {
  const mapa = {};

  for (const campo of campos) {
    const contexto = tcObterTextoProximo(campo);

    if (!mapa.titulo && contexto.includes('titulo')) {
      mapa.titulo = campo;
    } else if (
      !mapa.situacao &&
      contexto.includes('situacao')
    ) {
      mapa.situacao = campo;
    } else if (
      !mapa.exemplo &&
      contexto.includes('exemplo')
    ) {
      mapa.exemplo = campo;
    } else if (
      !mapa.erro &&
      (
        contexto.includes('erro retornado') ||
        contexto.includes('erro')
      )
    ) {
      mapa.erro = campo;
    } else if (
      !mapa.testado &&
      (
        contexto.includes('testado') ||
        contexto.includes('verificado')
      )
    ) {
      mapa.testado = campo;
    } else if (
      !mapa.plataforma &&
      contexto.includes('plataforma')
    ) {
      mapa.plataforma = campo;
    } else if (
      !mapa.usuario &&
      contexto.includes('usuario de suporte')
    ) {
      mapa.usuario = campo;
    } else if (
      !mapa.imagens &&
      (
        contexto.includes('links de imagens') ||
        contexto.includes('prints') ||
        contexto.includes('videos') ||
        contexto.includes('gifs')
      )
    ) {
      mapa.imagens = campo;
    }
  }

  /*
    Fallback pela ordem fixa dos campos no workflow.
  */
  mapa.titulo = mapa.titulo || campos[0];
  mapa.situacao = mapa.situacao || campos[1];
  mapa.exemplo = mapa.exemplo || campos[2];
  mapa.erro = mapa.erro || campos[3];
  mapa.testado = mapa.testado || campos[4];
  mapa.plataforma = mapa.plataforma || campos[5];
  mapa.usuario = mapa.usuario || campos[6];
  mapa.imagens = mapa.imagens || campos[7];

  return mapa;
}

function tcMarcarAmbientes(modal, dados) {
  const ambienteTexto = tcNormalizar(
    dados.ambientes || 'Quente'
  );

  const checks = Array.from(
    modal.querySelectorAll(
      'input[type="checkbox"]'
    )
  );

  checks.forEach((chk) => {
    const label = tcNormalizar(
      (
        chk.closest('label') &&
        chk.closest('label').innerText
      ) ||
      (
        chk.parentElement &&
        chk.parentElement.innerText
      ) ||
      ''
    );

    const deveMarcar =
      (
        label.includes('todos') &&
        ambienteTexto.includes('todos')
      ) ||
      (
        label.includes('quente') &&
        ambienteTexto.includes('quente')
      ) ||
      (
        label.includes('beta') &&
        ambienteTexto.includes('beta')
      ) ||
      (
        label.includes('alpha') &&
        ambienteTexto.includes('alpha')
      );

    if (deveMarcar && !chk.checked) {
      chk.click();

      console.log(
        TC32,
        'Ambiente marcado:',
        label
      );
    }
  });
}

function tcPreencherSlack() {
  if (tcPreenchimentoFinalizado) return;

  chrome.storage.session.get(
    ['dados_fluxo_ia_pendente'],
    ({ dados_fluxo_ia_pendente }) => {
      const dados = dados_fluxo_ia_pendente;

      if (!dados || tcPreenchimentoFinalizado) {
        return;
      }

      const modal = tcObterModalSlack();

      if (!modal) return;

      const campos = tcObterCamposTexto(modal);

      if (campos.length < 3) return;

      tcTentativas++;

      console.log(
        TC32,
        `Modal encontrado. Campos: ${campos.length}. Tentativa: ${tcTentativas}`
      );

      const mapa = tcMontarCamposPorLabel(campos);

      const preenchidos = [];

      const preencher = (chave, valor) => {
        if (
          mapa[chave] &&
          tcDefinirValorReact(
            mapa[chave],
            valor
          )
        ) {
          preenchidos.push(chave);

          console.log(
            TC32,
            'Campo preenchido:',
            chave
          );
        }
      };

      preencher('titulo', dados.titulo);
      preencher('situacao', dados.situacao);
      preencher('exemplo', dados.exemplo);
      preencher('erro', dados.erro);
      preencher('testado', dados.testado);
      preencher('plataforma', dados.plataforma);
      preencher('usuario', dados.usuario);
      preencher('imagens', dados.imagens);

      tcMarcarAmbientes(modal, dados);

      /*
        Após preencher os campos principais, interrompe
        novas tentativas nesta página.

        Os dados do storage ainda são preservados até que
        o envio seja realmente concluído.
      */
      if (
        preenchidos.includes('titulo') &&
        preenchidos.includes('situacao')
      ) {
        setTimeout(() => {
          tcPreenchimentoFinalizado = true;

          console.log(
            TC32,
            'Preenchimento finalizado:',
            preenchidos.join(', ')
          );
        }, 900);
      }
    }
  );
}

const tcObserver = new MutationObserver(() => {
  setTimeout(
    tcPreencherSlack,
    200
  );
});

tcObserver.observe(
  document.body,
  {
    childList: true,
    subtree: true
  }
);

[
  500,
  1000,
  2000,
  3500,
  5000,
  8000
].forEach((ms) => {
  setTimeout(
    tcPreencherSlack,
    ms
  );
});

console.log(
  TC32,
  'Monitor Slack iniciado'
);

// ==========================================
// VALIDAÇÃO DOS CAMPOS DO SLACK
// ==========================================

function tc53SetNativeValue(el, value) {
  const proto = el.tagName === 'TEXTAREA'
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;

  const descriptor = Object.getOwnPropertyDescriptor(
    proto,
    'value'
  );

  if (descriptor && descriptor.set) {
    descriptor.set.call(el, value);
  } else {
    el.value = value;
  }
}

function tc53Fire(el, type, options = {}) {
  try {
    if (
      type === 'input' ||
      type === 'beforeinput'
    ) {
      el.dispatchEvent(
        new InputEvent(type, {
          bubbles: true,
          cancelable: true,
          inputType:
            options.inputType ||
            'insertText',
          data: options.data ?? null
        })
      );
    } else if (type.startsWith('key')) {
      el.dispatchEvent(
        new KeyboardEvent(type, {
          bubbles: true,
          cancelable: true,
          key: options.key || ' ',
          code: options.code || 'Space'
        })
      );
    } else if (type === 'blur') {
      el.dispatchEvent(
        new FocusEvent('blur', {
          bubbles: true,
          relatedTarget: document.body
        })
      );
    } else if (type === 'focus') {
      el.dispatchEvent(
        new FocusEvent('focus', {
          bubbles: true,
          relatedTarget: document.body
        })
      );
    } else {
      el.dispatchEvent(
        new Event(type, {
          bubbles: true,
          cancelable: true
        })
      );
    }
  } catch (e) {
    el.dispatchEvent(
      new Event(type, {
        bubbles: true,
        cancelable: true
      })
    );
  }
}

function tc53RevalidarCampo(
  el,
  index = 0
) {
  if (
    !el ||
    !document.body.contains(el)
  ) {
    return;
  }

  const valor = String(
    el.value || ''
  ).trim();

  if (!valor) return;

  setTimeout(() => {
    try {
      el.scrollIntoView({
        block: 'center',
        inline: 'nearest'
      });

      el.focus();

      tc53Fire(
        el,
        'focus'
      );

      el.click();

      try {
        const fim = valor.length;

        el.setSelectionRange(
          fim,
          fim
        );
      } catch (e) {
        // Alguns tipos de input não suportam seleção.
      }

      tc53Fire(
        el,
        'keydown',
        {
          key: ' ',
          code: 'Space'
        }
      );

      tc53Fire(
        el,
        'beforeinput',
        {
          inputType: 'insertText',
          data: ' '
        }
      );

      tc53SetNativeValue(
        el,
        valor + ' '
      );

      tc53Fire(
        el,
        'input',
        {
          inputType: 'insertText',
          data: ' '
        }
      );

      tc53Fire(
        el,
        'keyup',
        {
          key: ' ',
          code: 'Space'
        }
      );

      tc53Fire(
        el,
        'change'
      );

      setTimeout(() => {
        if (
          !document.body.contains(el)
        ) {
          return;
        }

        tc53Fire(
          el,
          'keydown',
          {
            key: 'Backspace',
            code: 'Backspace'
          }
        );

        tc53Fire(
          el,
          'beforeinput',
          {
            inputType:
              'deleteContentBackward',
            data: null
          }
        );

        tc53SetNativeValue(
          el,
          valor
        );

        tc53Fire(
          el,
          'input',
          {
            inputType:
              'deleteContentBackward',
            data: null
          }
        );

        tc53Fire(
          el,
          'keyup',
          {
            key: 'Backspace',
            code: 'Backspace'
          }
        );

        tc53Fire(
          el,
          'change'
        );

        tc53Fire(
          el,
          'blur'
        );

        el.blur();

        console.log(
          TC32,
          'Campo Slack revalidado:',
          index
        );
      }, 220);
    } catch (e) {
      console.log(
        TC32,
        'Falha ao revalidar campo:',
        e
      );
    }
  }, index * 260);
}

function tc53RevalidarTodosCamposSlack() {
  const modal =
    document.querySelector(
      '.ReactModal__Content'
    ) ||
    document.querySelector(
      '[role="dialog"]'
    );

  if (!modal) return;

  const campos = Array.from(
    modal.querySelectorAll(
      'input, textarea'
    )
  ).filter((el) => {
    const type = (
      el.getAttribute('type') || 'text'
    ).toLowerCase();

    return (
      String(el.value || '').trim() &&
      ![
        'hidden',
        'file',
        'checkbox',
        'radio',
        'submit',
        'button'
      ].includes(type) &&
      !el.disabled
    );
  });

  campos.forEach(
    (el, index) => {
      tc53RevalidarCampo(
        el,
        index
      );
    }
  );

  setTimeout(() => {
    const btnEnviar =
      Array.from(
        modal.querySelectorAll('button')
      ).find((btn) => {
        return (
          tcNormalizar(
            btn.textContent || ''
          ) === 'enviar'
        );
      });

    if (btnEnviar) {
      btnEnviar.focus();

      console.log(
        TC32,
        'Foco final no botão Enviar'
      );
    }
  }, campos.length * 300 + 500);
}

[
  2500,
  4500,
  7500,
  11000,
  15000
].forEach((ms) => {
  setTimeout(
    tc53RevalidarTodosCamposSlack,
    ms
  );
});

// ==========================================
// LIMPEZA DA MEMÓRIA APÓS ENVIO
// ==========================================

function tc53LimparMemoriaDoFluxo() {
  chrome.storage.session.remove(
    ['dados_fluxo_ia_pendente'],
    () => {
      if (chrome.runtime.lastError) {
        console.log(
          TC32,
          'Erro ao limpar a memória:',
          chrome.runtime.lastError.message
        );

        return;
      }

      tcPreenchimentoFinalizado = false;
      tcTentativas = 0;
      tc53ObservandoEnvio = false;

      console.log(
        TC32,
        'Fluxo enviado. Memória limpa.'
      );
    }
  );
}

function tc53AguardarFechamentoDoModal(modal) {
  if (
    !modal ||
    tc53ObservandoEnvio
  ) {
    return;
  }

  tc53ObservandoEnvio = true;

  if (tc53ObserverEnvio) {
    tc53ObserverEnvio.disconnect();
  }

  if (tc53TimeoutEnvio) {
    clearTimeout(
      tc53TimeoutEnvio
    );
  }

  tc53ObserverEnvio =
    new MutationObserver(() => {
      const modalAindaExiste =
        document.body.contains(modal);

      if (modalAindaExiste) {
        return;
      }

      tc53ObserverEnvio.disconnect();
      tc53ObserverEnvio = null;

      if (tc53TimeoutEnvio) {
        clearTimeout(
          tc53TimeoutEnvio
        );

        tc53TimeoutEnvio = null;
      }

      /*
        Aguarda brevemente o Slack concluir
        a atualização da interface.
      */
      setTimeout(
        tc53LimparMemoriaDoFluxo,
        400
      );
    });

  tc53ObserverEnvio.observe(
    document.body,
    {
      childList: true,
      subtree: true
    }
  );

  /*
    Se o modal continuar aberto, significa
    que o envio pode ter sido bloqueado por
    validação.

    Nesse caso os dados são preservados.
  */
  tc53TimeoutEnvio = setTimeout(() => {
    if (tc53ObserverEnvio) {
      tc53ObserverEnvio.disconnect();
      tc53ObserverEnvio = null;
    }

    tc53TimeoutEnvio = null;
    tc53ObservandoEnvio = false;

    console.log(
      TC32,
      'Modal permaneceu aberto. Dados preservados.'
    );
  }, 20000);
}

// Clique no botão Enviar
document.addEventListener(
  'click',
  (ev) => {
    const alvo = ev.target;

    const botao =
      alvo &&
      alvo.closest
        ? alvo.closest('button')
        : null;

    if (!botao) return;

    const texto = tcNormalizar(
      botao.textContent || ''
    );

    if (texto !== 'enviar') {
      return;
    }

    const modal =
      tcObterModalSlack();

    if (
      !modal ||
      !modal.contains(botao)
    ) {
      return;
    }

    /*
      Mantém a validação atual.
    */
    tc53RevalidarTodosCamposSlack();

    /*
      A memória só é limpa se o modal
      realmente fechar depois do envio.
    */
    tc53AguardarFechamentoDoModal(
      modal
    );
  },
  true
);
