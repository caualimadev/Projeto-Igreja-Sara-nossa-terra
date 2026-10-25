/* app.js — telas do sistema Sara ligadas ao backend (criar, editar, excluir) */
(function () {
  'use strict';
  var A = SaraAPI, U = SaraUtil;
  var $ = function (id) { return document.getElementById(id); };
  var val = function (id) { return $(id).value.trim(); };
  var COR = { 'Membro': 'teal', 'Novo convertido': 'gold', 'Parceiro de Deus': 'violet', 'Visitante': 'rose' };
  var MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  var vazio = '<option value="">—</option>';
  var estado = {};   // id em edição por tela (null = criando)
  var cache = {};    // listas carregadas do servidor

  var TITULO = { membros: 'Novo membro', celulas: 'Nova célula', eventos: 'Novo evento' };
  var TITULO_EDIT = { membros: 'Editar membro', celulas: 'Editar célula', eventos: 'Editar evento' };
  var ROTULO = { membros: 'este membro', celulas: 'esta célula', cultos: 'este lançamento de culto', eventos: 'este evento', fichas: 'esta ficha' };
  var IDS = {
    membros: ['m-nome', 'm-tel', 'm-bairro'],
    celulas: ['cel-nome', 'cel-bairro', 'cel-dia', 'cel-lider', 'cel-colider', 'cel-anf'],
    eventos: ['e-nome', 'e-local', 'e-desc', 'e-ini', 'e-fim', 'e-valor'],
    cultos: ['c-data', 'c-presentes'],
    fichas: ['f-nome', 'f-nasc', 'f-endereco', 'f-bairro', 'f-whatsapp', 'f-lider', 'f-acompanhante', 'f-responsavel', 'f-dataficha', 'f-obs']
  };
  var BTN = { // telas cujo formulário já existe no HTML: [seletor do botão salvar, texto padrão]
    cultos: ['#view-cultos .form-actions .btn-primary', 'Registrar'],
    fichas: ['#view-novoconvertido .form-actions .btn-primary', 'Concluir cadastro']
  };

  // ---------------- Helpers de interface ----------------
  function campo(id, label, tipo, ph) {
    return '<div class="field"><label>' + label + '</label><input id="' + id + '" type="' + (tipo || 'text') + '" placeholder="' + (ph || '') + '"></div>';
  }
  function seletor(id, label, opcoes) {
    return '<div class="field"><label>' + label + '</label><select id="' + id + '">' + opcoes + '</select></div>';
  }
  function formCard(tela, html, salvar) {
    var c = document.querySelector('#view-' + tela + ' .content');
    var d = document.createElement('div');
    d.className = 'form-card'; d.id = 'form-' + tela;
    d.style.cssText = 'max-width:none;margin-bottom:22px;display:none';
    d.innerHTML = '<h3 style="margin:0 0 16px;font-size:15px">' + TITULO[tela] + '</h3>' + html +
      '<div class="form-actions"><button class="btn btn-ghost" onclick="cancelar(\'' + tela + '\')">Cancelar</button>' +
      '<button class="btn btn-primary" onclick="' + salvar + '()">Salvar</button></div>';
    c.insertBefore(d, c.firstChild);
  }
  function acoes(rec, id) {
    return '<span class="icon-link" title="Editar" onclick="editar(\'' + rec + '\',' + id + ')">✎</span> ' +
      '<span class="icon-link" title="Excluir" onclick="excluir(\'' + rec + '\',' + id + ')">🗑</span>';
  }
  function nome(m) { return m ? U.esc(m.nome) : '—'; }
  function marcar(sel, textos) {
    Array.prototype.forEach.call(document.querySelector(sel).children, function (el) {
      el.classList.toggle('selected', textos.indexOf(el.textContent.trim()) > -1);
    });
  }
  function ligar(sel, fn) { var b = document.querySelector(sel); if (b) b.onclick = fn; }
  async function executar(fn) { try { await fn(); } catch (e) { alert(e.message); } }

  // ---------------- Formulários ----------------
  formCard('membros',
    '<div class="form-row">' + campo('m-nome', 'Nome completo') + campo('m-tel', 'Telefone', 'text', '(86) 9####-####') + '</div>' +
    '<div class="form-row">' + campo('m-bairro', 'Bairro') +
    seletor('m-status', 'Status', Object.keys(COR).map(function (s) { return '<option>' + s + '</option>'; }).join('')) + '</div>',
    'salvarMembro');

  formCard('celulas',
    '<div class="form-row">' + campo('cel-nome', 'Nome da célula') + campo('cel-bairro', 'Bairro') + '</div>' +
    '<div class="form-row">' + campo('cel-dia', 'Dia e horário', 'text', 'Terças, 19h30') +
    seletor('cel-status', 'Status', '<option>Ativa</option><option>Em multiplicação</option><option>Inativa</option>') + '</div>' +
    '<div class="form-row">' + seletor('cel-lider', 'Líder', vazio) + seletor('cel-colider', 'Co-líder', vazio) + '</div>' +
    '<div class="form-row single">' + seletor('cel-anf', 'Anfitrião', vazio) + '</div>',
    'salvarCelula');

  formCard('eventos',
    '<div class="form-row">' + campo('e-nome', 'Nome do evento') + campo('e-local', 'Local') + '</div>' +
    '<div class="form-row">' + campo('e-ini', 'Data de início', 'date') + campo('e-fim', 'Data de término', 'date') + '</div>' +
    '<div class="form-row">' + campo('e-desc', 'Descrição') + campo('e-valor', 'Valor da inscrição (R$)', 'number') + '</div>',
    'salvarEvento');

  // Cultos: lista de lançamentos + botão cancelar
  document.querySelector('#view-cultos .card').insertAdjacentHTML('beforeend',
    '<div class="eyebrow" style="display:block;margin:18px 0 8px">Últimos lançamentos</div><div id="cultos-lista" style="font-size:13px"></div>');
  document.querySelector('#view-cultos .form-actions').insertAdjacentHTML('afterbegin',
    '<button class="btn btn-ghost" onclick="cancelar(\'cultos\')">Cancelar</button>');

  // Ficha: lista de fichas; "Salvar rascunho" não tem suporte no backend
  document.querySelector('#view-novoconvertido .content').insertAdjacentHTML('beforeend',
    '<div class="form-card" style="margin-top:22px"><h3 style="margin:0 0 10px;font-size:15px">Fichas cadastradas</h3><div id="fichas-lista"></div></div>');
  document.querySelector('#view-novoconvertido .form-actions .btn-ghost').style.display = 'none';

  // ---------------- Cancelar / abrir ----------------
  window.cancelar = function (tela) {
    estado[tela] = null;
    IDS[tela].forEach(function (i) { $(i).value = ''; });
    if (tela === 'membros') $('m-status').selectedIndex = 0;
    if (tela === 'celulas') $('cel-status').selectedIndex = 0;
    if (tela === 'fichas') { marcar('#f-tipo', ['Novo convertido']); marcar('#f-participa', ['Sim']); marcar('#f-oracao', ['Espiritual']); }
    if (BTN[tela]) document.querySelector(BTN[tela][0]).textContent = BTN[tela][1];
    if ($('form-' + tela)) $('form-' + tela).style.display = 'none';
  };
  function abrir(tela, titulo) {
    var f = $('form-' + tela);
    f.style.display = 'block';
    f.querySelector('h3').textContent = titulo;
    f.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  ligar('#view-membros .topbar-actions .btn', function () { cancelar('membros'); abrir('membros', TITULO.membros); });
  ligar('#view-celulas .topbar-actions .btn', function () { cancelar('celulas'); abrir('celulas', TITULO.celulas); });
  ligar('#view-eventos .topbar-actions .btn', function () { cancelar('eventos'); abrir('eventos', TITULO.eventos); });
  ligar('#view-cultos .topbar-actions .btn', function () { cancelar('cultos'); $('c-data').focus(); });
  ligar('#view-novoconvertido .topbar-actions .btn', function () { cancelar('fichas'); });
  ligar('#view-consolidacao .topbar-actions .btn', function () { document.querySelector('[data-target="novoconvertido"]').click(); });

  // ---------------- Carregar dados ----------------
  async function carregarMembros() {
    var ms = cache.membros = await A.membros.listar();
    $('tabela-membros').innerHTML =
      '<tr><th>Membro</th><th>Bairro</th><th>Célula</th><th>Status</th><th>Desde</th><th></th></tr>' +
      (ms.length ? ms.map(function (m) {
        return '<tr><td><div class="person"><div class="pic">' + U.esc(U.iniciais(m.nome)) + '</div><div><div class="name">' + U.esc(m.nome) +
          '</div><div class="meta">' + U.esc(m.telefone) + '</div></div></div></td><td>' + U.esc(m.bairro) + '</td><td>—</td>' +
          '<td><span class="badge ' + (COR[m.status] || 'grey') + '">' + U.esc(m.status) + '</span></td>' +
          '<td class="mono">' + U.dataParaMesAno(m.dataCadastro) + '</td><td style="white-space:nowrap">' + acoes('membros', m.id) + '</td></tr>';
      }).join('') : '<tr><td colspan="6">Nenhum membro cadastrado.</td></tr>');
    document.querySelector('#view-membros .badge.grey').textContent = 'Todos · ' + ms.length;
    var opts = vazio + ms.map(function (m) { return '<option value="' + m.id + '">' + U.esc(m.nome) + '</option>'; }).join('');
    ['cel-lider', 'cel-colider', 'cel-anf'].forEach(function (i) { var v = $(i).value; $(i).innerHTML = opts; $(i).value = v; });
  }

  async function carregarCelulas() {
    var cs = cache.celulas = await A.celulas.listar();
    $('celulas-grid').innerHTML = cs.length ? cs.map(function (c) {
      return '<div class="card celula-card"><div class="top"><div><h3>' + U.esc(c.nome) + '</h3><div class="bairro">' + U.esc(c.bairro) + ' · ' +
        U.esc(c.diaHorario) + '</div></div><span class="badge teal">' + U.esc(c.status) + '</span></div><div class="celula-meta">' +
        '<div><div class="k">Líder</div><div class="v">' + nome(c.lider) + '</div></div>' +
        '<div><div class="k">Co-líder</div><div class="v">' + nome(c.colider) + '</div></div>' +
        '<div><div class="k">Anfitrião</div><div class="v">' + nome(c.anfitriao) + '</div></div></div>' +
        '<div style="text-align:right;margin-top:10px">' + acoes('celulas', c.id) + '</div></div>';
    }).join('') : '<p>Nenhuma célula cadastrada.</p>';
  }

  async function carregarCultos() {
    var cs = cache.cultos = await A.cultos.listar();
    var ord = cs.slice().sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); });
    $('cultos-lista').innerHTML = ord.length ? ord.slice(0, 10).map(function (c) {
      return '<div style="padding:6px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between"><span>' +
        U.dataParaBR(c.data) + ' · ' + U.esc(c.tipo) + ' · <b>' + U.esc(c.totalPresentes) + '</b> presentes</span><span>' + acoes('cultos', c.id) + '</span></div>';
    }).join('') : 'Nenhum culto lançado.';
  }

  async function carregarEventos() {
    var es = cache.eventos = await A.eventos.listar();
    var ord = es.slice().sort(function (a, b) { return String(a.dataInicio).localeCompare(String(b.dataInicio)); });
    $('eventos-grid').innerHTML = ord.length ? ord.map(function (e) {
      var p = String(e.dataInicio || '').split('-');
      return '<div class="card event-card"><div class="event-date"><div class="day">' + (p[2] || '') + '</div><div class="mon">' +
        (MESES[parseInt(p[1], 10) - 1] || '') + '</div></div><div><h3 style="margin:0 0 4px;font-size:15px">' + U.esc(e.nome) +
        '</h3><div style="font-size:13px;color:var(--ink-soft)">' + U.esc(e.local) + (e.descricao ? ' · ' + U.esc(e.descricao) : '') +
        '</div><div style="margin-top:6px">' + acoes('eventos', e.id) + '</div></div></div>';
    }).join('') : '<p>Nenhum evento cadastrado.</p>';
  }

  async function carregarFichas() {
    var fs = cache.fichas = await A.fichas.listar();
    $('fichas-lista').innerHTML = fs.length ? fs.map(function (f) {
      return '<div style="padding:10px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">' +
        '<div><b>' + U.esc(f.nomeCompleto) + '</b><div style="font-size:12px;color:var(--ink-soft)">' + U.esc(f.tipo) + ' · ' +
        U.esc(f.bairro) + ' · ' + U.dataParaBR(f.dataFicha) + '</div></div><div>' + acoes('fichas', f.id) + '</div></div>';
    }).join('') : 'Nenhuma ficha cadastrada.';
  }

  var RECARREGAR = {
    membros: async function () { await carregarMembros(); await carregarCelulas(); },
    celulas: carregarCelulas, cultos: carregarCultos, eventos: carregarEventos, fichas: carregarFichas
  };

  async function carregarTudo() {
    var flag = document.querySelector('.mockup-flag');
    try {
      await carregarMembros();
      await Promise.all([carregarCelulas(), carregarCultos(), carregarEventos(), carregarFichas()]);
      flag.innerHTML = '<span class="dot"></span> Backend conectado ✓ (' + A.base + ')';
    } catch (e) {
      flag.innerHTML = '<span class="dot" style="background:#c0392b"></span> Backend OFFLINE — ' + U.esc(e.message);
    }
  }

  // ---------------- Editar / Excluir ----------------
  var PREENCHER = {
    membros: function (m) {
      $('m-nome').value = m.nome || ''; $('m-tel').value = m.telefone || ''; $('m-bairro').value = m.bairro || ''; $('m-status').value = m.status;
    },
    celulas: function (c) {
      $('cel-nome').value = c.nome || ''; $('cel-bairro').value = c.bairro || ''; $('cel-dia').value = c.diaHorario || '';
      $('cel-status').value = c.status || 'Ativa';
      $('cel-lider').value = c.lider ? c.lider.id : ''; $('cel-colider').value = c.colider ? c.colider.id : ''; $('cel-anf').value = c.anfitriao ? c.anfitriao.id : '';
    },
    cultos: function (c) {
      $('c-data').value = U.dataParaBR(c.data); $('c-presentes').value = c.totalPresentes; marcar('#c-tipo', [c.tipo]);
    },
    eventos: function (e) {
      $('e-nome').value = e.nome || ''; $('e-local').value = e.local || ''; $('e-desc').value = e.descricao || '';
      $('e-ini').value = e.dataInicio || ''; $('e-fim').value = e.dataFim || ''; $('e-valor').value = e.valorInscricao == null ? '' : e.valorInscricao;
    },
    fichas: function (f) {
      $('f-nome').value = f.nomeCompleto || ''; $('f-nasc').value = U.dataParaBR(f.dataNascimento); $('f-endereco').value = f.endereco || '';
      $('f-bairro').value = f.bairro || ''; $('f-whatsapp').value = f.whatsapp || ''; $('f-lider').value = f.nomeLiderCelula || '';
      $('f-acompanhante').value = f.nomeAcompanhante || ''; $('f-responsavel').value = f.responsavelAcompanhamento || '';
      $('f-dataficha').value = U.dataParaBR(f.dataFicha); $('f-obs').value = f.observacao || '';
      marcar('#f-tipo', [f.tipo]); marcar('#f-participa', [f.participaCelula ? 'Sim' : 'Não']);
      marcar('#f-oracao', String(f.necessidadeOracao || '').split(',').map(function (s) { return s.trim(); }));
    }
  };

  window.editar = function (rec, id) {
    var obj = cache[rec].filter(function (x) { return x.id === id; })[0];
    cancelar(rec);
    PREENCHER[rec](obj);
    estado[rec] = id;
    if (BTN[rec]) {
      document.querySelector(BTN[rec][0]).textContent = 'Salvar alterações';
      (rec === 'fichas' ? document.querySelector('[data-target="novoconvertido"]').click() : 0);
      $(rec === 'fichas' ? 'f-nome' : 'c-data').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      abrir(rec, TITULO_EDIT[rec]);
    }
  };

  window.excluir = function (rec, id) {
    if (!confirm('Tem certeza que deseja excluir ' + ROTULO[rec] + '?')) return;
    executar(async function () {
      await A[rec].excluir(id);
      if (estado[rec] === id) cancelar(rec);
      await RECARREGAR[rec]();
    });
  };

  // ---------------- Salvar (cria ou atualiza) ----------------
  async function gravar(rec, dados) {
    var id = estado[rec];
    if (id) {
      var atual = cache[rec].filter(function (x) { return x.id === id; })[0];
      await A[rec].atualizar(id, Object.assign({}, atual, dados));
    } else {
      await A[rec].criar(dados);
    }
    cancelar(rec);
    await RECARREGAR[rec]();
  }

  window.salvarMembro = function () {
    if (!val('m-nome')) return alert('Informe o nome.');
    executar(function () {
      return gravar('membros', { nome: val('m-nome'), telefone: val('m-tel'), bairro: val('m-bairro'), status: val('m-status') });
    });
  };

  window.salvarCelula = function () {
    if (!val('cel-nome')) return alert('Informe o nome da célula.');
    var ref = function (id) { return val(id) ? { id: Number(val(id)) } : null; };
    executar(function () {
      return gravar('celulas', {
        nome: val('cel-nome'), bairro: val('cel-bairro'), diaHorario: val('cel-dia'), status: val('cel-status'),
        lider: ref('cel-lider'), colider: ref('cel-colider'), anfitriao: ref('cel-anf')
      });
    });
  };

  window.salvarCulto = function () {
    var data = U.dataParaISO(val('c-data'));
    if (!data) return alert('Informe a data (dd/mm/aaaa).');
    executar(function () {
      return gravar('cultos', {
        data: data, tipo: U.textoSelecionado('#c-tipo'),
        totalPresentes: parseInt(val('c-presentes'), 10) || 0,
        totalVisitantes: 0
      });
    });
  };

  window.salvarEvento = function () {
    if (!val('e-nome') || !val('e-ini')) return alert('Informe o nome e a data de início.');
    executar(function () {
      return gravar('eventos', {
        nome: val('e-nome'), local: val('e-local'), descricao: val('e-desc'),
        dataInicio: val('e-ini'), dataFim: val('e-fim') || val('e-ini'),
        valorInscricao: val('e-valor') ? Number(val('e-valor')) : null
      });
    });
  };

  window.salvarFicha = function () {
    if (!val('f-nome')) return alert('Informe o nome completo.');
    var edicao = !!estado.fichas;
    executar(async function () {
      await gravar('fichas', {
        tipo: U.textoSelecionado('#f-tipo'), nomeCompleto: val('f-nome'), dataNascimento: U.dataParaISO(val('f-nasc')),
        endereco: val('f-endereco'), bairro: val('f-bairro'), whatsapp: val('f-whatsapp'),
        participaCelula: U.textoSelecionado('#f-participa') === 'Sim',
        nomeLiderCelula: val('f-lider'), nomeAcompanhante: val('f-acompanhante'),
        necessidadeOracao: U.textosSelecionados('#f-oracao').slice(0, 50),
        responsavelAcompanhamento: val('f-responsavel'), observacao: val('f-obs')
      });
      alert(edicao ? 'Ficha atualizada!' : 'Ficha salva com sucesso!');
    });
  };

  carregarTudo();
})();
