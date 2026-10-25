/* ==========================================================================
   api.js — Camada de comunicação do front-end com o backend Sara
   Backend: Spring Boot (http://localhost:8080)

   Como usar no HTML (antes do seu script principal):
     <script src="api.js"></script>

   Exemplos:
     const membros = await SaraAPI.membros.listar();
     await SaraAPI.membros.criar({ nome: 'Maria', status: 'Membro' });
   ========================================================================== */

(function (global) {
  'use strict';

  // --------------------------------------------------------------------------
  // Configuração
  // --------------------------------------------------------------------------
  // Se mudar a porta no application.properties (server.port), altere aqui.
  var API_BASE = 'http://localhost:8080/api';
  var TIMEOUT_MS = 10000;

  // --------------------------------------------------------------------------
  // Requisição base
  // --------------------------------------------------------------------------
  async function requisicao(caminho, opcoes) {
    opcoes = opcoes || {};

    var controle = new AbortController();
    var timer = setTimeout(function () { controle.abort(); }, TIMEOUT_MS);

    var config = {
      method: opcoes.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controle.signal
    };
    if (opcoes.body !== undefined) {
      config.body = JSON.stringify(opcoes.body);
    }

    var resposta;
    try {
      resposta = await fetch(API_BASE + caminho, config);
    } catch (erro) {
      if (erro.name === 'AbortError') {
        throw new Error('O servidor demorou demais para responder.');
      }
      throw new Error(
        'Não foi possível conectar ao servidor. ' +
        'Verifique se o backend e o MySQL estão rodando.'
      );
    } finally {
      clearTimeout(timer);
    }

    if (!resposta.ok) {
      throw new Error(mensagemDeErro(resposta.status));
    }

    // Respostas sem corpo (ex.: 204) não têm JSON para ler
    var texto = await resposta.text();
    return texto ? JSON.parse(texto) : null;
  }

  function mensagemDeErro(status) {
    if (status === 400) return 'Dados inválidos. Confira os campos (principalmente datas).';
    if (status === 409) return 'Não é possível excluir: este registro está em uso (ex.: membro que é líder, co-líder ou anfitrião de uma célula).';
    if (status === 404) return 'Recurso não encontrado.';
    if (status >= 500) return 'Erro no servidor. Verifique o MySQL e o log do Spring.';
    return 'Erro inesperado (' + status + ').';
  }

  // --------------------------------------------------------------------------
  // Recursos da API (um para cada controller do backend)
  // --------------------------------------------------------------------------
  function criarRecurso(caminho) {
    return {
      listar: function () {
        return requisicao(caminho);
      },
      criar: function (dados) {
        return requisicao(caminho, { method: 'POST', body: dados });
      },
      atualizar: function (id, dados) {
        return requisicao(caminho + '/' + id, { method: 'PUT', body: dados });
      },
      excluir: function (id) {
        return requisicao(caminho + '/' + id, { method: 'DELETE' });
      }
    };
  }

  var membros  = criarRecurso('/membros');
  var celulas  = criarRecurso('/celulas');
  var cultos   = criarRecurso('/cultos');
  var eventos  = criarRecurso('/eventos');
  var fichas   = criarRecurso('/novos-convertidos');

  // --------------------------------------------------------------------------
  // Utilitários para o front
  // --------------------------------------------------------------------------

  // Evita que texto vindo do banco seja interpretado como HTML
  function esc(texto) {
    return String(texto == null ? '' : texto).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // "Maria de Fátima Lima" -> "MF"
  function iniciais(nome) {
    return String(nome || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(function (p) { return p[0]; })
      .join('')
      .toUpperCase();
  }

  // "2026-08-30" -> "30/08/2026"
  function dataParaBR(iso) {
    if (!iso) return '';
    var p = String(iso).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
  }

  // "30/08/2026" -> "2026-08-30" (formato que o backend aceita)
  // Se já estiver em ISO (ex.: vindo de <input type="date">), devolve igual.
  function dataParaISO(br) {
    if (!br) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(br)) return br;
    var p = String(br).split('/');
    return p.length === 3 ? p[2] + '-' + p[1] + '-' + p[0] : null;
  }

  // "2026-08-30" -> "ago/2026"
  function dataParaMesAno(iso) {
    if (!iso) return '';
    var meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    var p = String(iso).split('-');
    return p.length === 3 ? meses[parseInt(p[1], 10) - 1] + '/' + p[0] : iso;
  }

  // Devolve o texto do item marcado em um grupo de pills/tags.
  // Ex.: textoSelecionado('#view-novoconvertido .pill-choice') -> "Visitante"
  function textoSelecionado(seletorGrupo) {
    var el = document.querySelector(seletorGrupo + ' .selected');
    return el ? el.textContent.trim() : '';
  }

  // Devolve os textos de todos os itens marcados, separados por vírgula.
  // Ex.: textosSelecionados('.tag-choice') -> "Espiritual, Saúde"
  function textosSelecionados(seletorGrupo) {
    return Array.prototype.map
      .call(document.querySelectorAll(seletorGrupo + ' .selected'), function (el) {
        return el.textContent.trim();
      })
      .join(', ');
  }

  // --------------------------------------------------------------------------
  // Exposição global
  // --------------------------------------------------------------------------
  global.SaraAPI = {
    base: API_BASE,
    membros: membros,
    celulas: celulas,
    cultos: cultos,
    eventos: eventos,
    fichas: fichas
  };

  global.SaraUtil = {
    esc: esc,
    iniciais: iniciais,
    dataParaBR: dataParaBR,
    dataParaISO: dataParaISO,
    dataParaMesAno: dataParaMesAno,
    textoSelecionado: textoSelecionado,
    textosSelecionados: textosSelecionados
  };

})(window);
