/* WCH RISC-V MCU Explorer — UI. Plain script, no dependencies; works from file:// and any static host. */
(function () {
  'use strict';
  const L = window.WCHLogic;
  const DATA = window.WCH_DATA || { meta: {}, parts: [] };
  const PARTS = DATA.parts.slice().sort((a, b) => L.naturalCmp(a.id, b.id));
  const BY_ID = new Map(PARTS.map(p => [p.id.toUpperCase(), p]));
  const FAMILIES = new Map();
  for (const p of PARTS) { if (!FAMILIES.has(p.family)) FAMILIES.set(p.family, []); FAMILIES.get(p.family).push(p); }
  const MAX_COMPARE = 8;
  const { known } = L;

  /* ── utils ─────────────────────────────────────── */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const enc = encodeURIComponent;
  const store = {
    get(k, d) { try { const v = localStorage.getItem('wch.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('wch.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const getPart = id => BY_ID.get(String(id || '').toUpperCase().trim());
  const UNK = '<span class="q" title="Not established from vendor documents">?</span>';
  const cell = (p, key) => { const v = L.display(p, key); return v === null ? UNK : v === '—' ? '<span class="dash">—</span>' : esc(v); };
  const ICON = {
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
    cols: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>',
    dl: '<path d="M12 3v12m-4-4 4 4 4-4M4 17v3h16v-3"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    doc: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>',
    reset: '<path d="M4 4v6h6"/><path d="M5 15a8 8 0 1 0 2-8.5L4 10"/>',
    cmp: '<path d="M8 3v18M16 3v18M3 8h5M16 16h5"/>',
    alt: '<path d="M4 7h13l-3-3M20 17H7l3 3"/>',
  };
  const icon = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;

  let toastTimer;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }
  function copy(text, msg) {
    const done = () => toast(msg || 'Copied');
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => prompt('Copy:', text));
    else { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { prompt('Copy:', text); } ta.remove(); }
  }
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ── state ─────────────────────────────────────── */
  const DEFAULT_COLS = L.COLUMNS.filter(c => c[1]).map(c => c[0]);
  const state = {
    filters: L.emptyFilters(),
    sort: { key: 'id', dir: 'asc' },
    cols: (store.get('cols', null) || DEFAULT_COLS).filter(k => L.FIELD[k]),
    compare: (store.get('compare', []) || []).filter(id => getPart(id)),
    diffOnly: store.get('diffOnly', false),
    view: '',
  };
  if (!state.cols.includes('id')) state.cols.unshift('id');

  function setCompare(ids) {
    state.compare = [...new Set(ids.map(id => getPart(id)).filter(Boolean).map(p => p.id))].slice(0, MAX_COMPARE);
    store.set('compare', state.compare);
    const b = $('#cmp-count'); b.textContent = state.compare.length; b.hidden = !state.compare.length;
    renderTray();
  }
  function toggleCompare(id) {
    const p = getPart(id); if (!p) return;
    if (state.compare.includes(p.id)) setCompare(state.compare.filter(x => x !== p.id));
    else if (state.compare.length >= MAX_COMPARE) { toast(`Compare holds up to ${MAX_COMPARE} parts`); return; }
    else setCompare([...state.compare, p.id]);
  }

  /* ── routing ───────────────────────────────────── */
  function parseHash() {
    const h = location.hash.replace(/^#/, '') || '/';
    const qi = h.indexOf('?');
    const path = qi < 0 ? h : h.slice(0, qi), qs = qi < 0 ? '' : h.slice(qi + 1);
    const seg = path.split('/').filter(Boolean).map(decodeURIComponent);
    return { view: seg[0] || 'browse', arg: seg.slice(1).join('/'), params: new URLSearchParams(qs) };
  }
  function route() {
    const r = parseHash();
    closeSuggest();
    $$('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.nav === (r.view === 'part' ? '' : r.view)));
    if (r.view === 'part') renderPart(r.arg);
    else if (r.view === 'compare') {
      if (r.arg) setCompare(r.arg.split(',')); else if (state.compare.length) { history.replaceState(null, '', compareHash()); }
      renderCompare();
    } else if (r.view === 'about') renderAbout();
    else {
      state.filters = L.paramsToFilters(r.params);
      const s = (r.params.get('sort') || '').split('.');
      state.sort = L.FIELD[s[0]] ? { key: s[0], dir: s[1] === 'desc' ? 'desc' : 'asc' } : { key: 'id', dir: 'asc' };
      renderBrowse();
    }
    state.view = r.view;
    renderTray();
  }
  const compareHash = () => '#/compare/' + state.compare.map(enc).join(',');
  function browseHash() {
    const q = L.filtersToParams(state.filters);
    if (state.sort.key !== 'id' || state.sort.dir !== 'asc') q.set('sort', state.sort.key + (state.sort.dir === 'desc' ? '.desc' : ''));
    const s = q.toString();
    return '#/' + (s ? '?' + s : '');
  }
  function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }

  /* ── global search ─────────────────────────────── */
  const norm = s => String(s || '').toUpperCase().replace(/[\s\-_]/g, '');
  function suggestions(q, limit = 9) {
    const n = norm(q); if (!n) return { fams: [], parts: [] };
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const fams = [...FAMILIES.keys()].filter(f => norm(f).includes(n)).sort((a, b) => (norm(a).startsWith(n) ? 0 : 1) - (norm(b).startsWith(n) ? 0 : 1) || L.naturalCmp(a, b)).slice(0, 4);
    const scored = [];
    for (const p of PARTS) {
      const id = norm(p.id); let s = -1;
      if (id === n) s = 0; else if (id.startsWith(n)) s = 1; else if (id.includes(n)) s = 2;
      else {
        const h = [p.id, p.family, p.core, p.package, p.usb, p.eth, p.radio, p.line].filter(known).join(' ').toLowerCase();
        if (words.every(w => h.includes(w))) s = 3;
      }
      if (s >= 0) scored.push([s, p]);
    }
    scored.sort((a, b) => a[0] - b[0] || L.naturalCmp(a[1].id, b[1].id));
    return { fams, parts: scored.slice(0, limit).map(x => x[1]) };
  }
  const brief = p => [p.core, L.display(p, 'mhz'), [L.display(p, 'flashKB'), L.display(p, 'ramKB')].filter(Boolean).join(' / '), p.package].filter(Boolean).join(' · ');
  let sugIdx = -1, sugItems = [];
  function openSuggest(q) {
    const ul = $('#gsearch-list');
    const { fams, parts } = suggestions(q);
    sugItems = []; let html = '';
    if (fams.length) {
      html += '<li class="sec" role="presentation">Families</li>';
      for (const f of fams) { sugItems.push({ hash: '#/?q=' + enc(f) }); html += `<li role="option" data-i="${sugItems.length - 1}"><span class="k">${esc(f)}</span><span class="d">${FAMILIES.get(f).length} part${FAMILIES.get(f).length > 1 ? 's' : ''} · ${esc(FAMILIES.get(f)[0].core || '')}</span></li>`; }
    }
    if (parts.length) {
      html += '<li class="sec" role="presentation">Parts</li>';
      for (const p of parts) { sugItems.push({ hash: '#/part/' + enc(p.id) }); html += `<li role="option" data-i="${sugItems.length - 1}"><span class="k">${esc(p.id)}</span><span class="d">${esc(brief(p))}</span></li>`; }
    }
    if (q.trim()) { sugItems.push({ hash: '#/?q=' + enc(q.trim()) }); html += `<li role="option" data-i="${sugItems.length - 1}"><span class="d">Show all results for “${esc(q.trim())}” in Browse</span></li>`; }
    ul.innerHTML = html; ul.hidden = !html; sugIdx = -1;
  }
  function closeSuggest() { const ul = $('#gsearch-list'); if (ul) ul.hidden = true; sugIdx = -1; }
  function moveSuggest(d) {
    if (!sugItems.length) return;
    sugIdx = (sugIdx + d + sugItems.length) % sugItems.length;
    $$('#gsearch-list li[role=option]').forEach(li => li.setAttribute('aria-selected', String(+li.dataset.i === sugIdx)));
  }
  function initSearch() {
    const inp = $('#gsearch');
    inp.addEventListener('input', () => openSuggest(inp.value));
    inp.addEventListener('focus', () => inp.value && openSuggest(inp.value));
    inp.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); moveSuggest(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveSuggest(-1); }
      else if (e.key === 'Escape') { closeSuggest(); inp.blur(); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const exact = getPart(inp.value);
        const hash = sugIdx >= 0 ? sugItems[sugIdx].hash : exact ? '#/part/' + enc(exact.id) : inp.value.trim() ? '#/?q=' + enc(inp.value.trim()) : '#/';
        inp.value = ''; closeSuggest(); inp.blur(); go(hash);
      }
    });
    $('#gsearch-list').addEventListener('mousedown', e => {
      const li = e.target.closest('li[data-i]'); if (!li) return;
      e.preventDefault(); const h = sugItems[+li.dataset.i].hash; inp.value = ''; closeSuggest(); inp.blur(); go(h);
    });
    inp.addEventListener('blur', () => setTimeout(closeSuggest, 120));
    document.addEventListener('keydown', e => {
      if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); inp.focus(); inp.select(); }
    });
  }

  /* ── browse ────────────────────────────────────── */
  const SELECTS = {
    flashKB: ['Min flash', [16, 32, 62, 64, 128, 256, 448, 512, 1024], 'KB'],
    ramKB: ['Min SRAM', [2, 4, 8, 16, 20, 32, 64, 128, 256, 512], 'KB'],
    mhz: ['Min clock', [48, 72, 96, 120, 144, 200, 400], 'MHz'],
    gpio: ['Min GPIO', [6, 12, 16, 20, 24, 32, 40, 48, 64, 80], ''],
    tempMax: ['Max temp ≥', [85, 105, 125], '°C'],
    uart: ['UART ≥', [1, 2, 3, 4, 6, 8], ''],
    spi: ['SPI ≥', [1, 2, 3, 4], ''],
    i2c: ['I²C ≥', [1, 2, 3, 4], ''],
    can: ['CAN ≥', [1, 2, 3], ''],
    adcChannels: ['ADC inputs ≥', [4, 8, 10, 12, 14, 16], ''],
  };
  const PINS = [8, 10, 16, 20, 24, 28, 32, 48, 64, 100];
  const VOLTS = ['1.8', '2.0', '2.5', '3.0', '3.3', '5.0'];

  function selectField(key, label, values, unit, cur) {
    return `<label class="field${known(cur) ? ' set' : ''}" data-fwrap="${key}">${esc(label)}
      <select data-min="${key}"><option value="">Any</option>${values.map(v => `<option value="${v}"${String(cur) === String(v) ? ' selected' : ''}>${v}${unit ? ' ' + unit : ''}</option>`).join('')}</select></label>`;
  }

  function renderBrowse() {
    const f = state.filters;
    const lines = Object.keys(L.LINES).filter(l => PARTS.some(p => p.line === l));
    const featHtml = L.FEATURE_GROUPS.map(g => `<div class="fgroup"><div class="fgroup-t">${esc(g)}</div><div class="pills">${
      Object.entries(L.FEATURES).filter(([, v]) => v[1] === g).map(([k, v]) => `<button type="button" class="pill ${f.feat[k] || ''}" data-feat="${k}" title="Click: required · again: excluded · again: any">${esc(v[0])}</button>`).join('')
    }</div></div>`).join('');

    $('#view').innerHTML = `<div class="browse" id="browse">
      <aside class="filters" aria-label="Filters">
        <div class="filters-head"><h2>Filters</h2><button class="btn ghost small" data-act="reset" type="button">${icon('reset')}Reset</button></div>
        <section class="fsec"><input class="plain" type="search" id="fq" placeholder="Text in part, core, package, USB…" value="${esc(f.q)}" style="width:100%" aria-label="Text filter"></section>
        <section class="fsec"><h3>Product line</h3><div class="pills" id="f-lines">${
          lines.map(l => `<button type="button" class="pill" data-line="${l}" aria-pressed="${f.lines.includes(l)}" title="${esc(L.LINES[l])}">${l} <span class="n"></span></button>`).join('')}</div></section>
        <section class="fsec"><h3>Core &amp; memory</h3>
          <div class="frow">${selectField('flashKB', ...SELECTS.flashKB, f.min.flashKB)}${selectField('ramKB', ...SELECTS.ramKB, f.min.ramKB)}</div>
          <div class="frow">${selectField('mhz', ...SELECTS.mhz, f.min.mhz)}<span></span></div>
          <label class="toggle" style="margin-top:10px"><input type="checkbox" id="ffpu"${f.fpu ? ' checked' : ''}> Hardware floating point (FPU)</label>
        </section>
        <section class="fsec"><h3>Package &amp; electrical</h3>
          <div class="pills" id="f-pkg" style="margin-bottom:8px">${L.PKG_TYPES.filter(t => PARTS.some(p => L.pkgType(p.package) === t)).map(t => `<button type="button" class="pill" data-pkg="${t}" aria-pressed="${f.pkg.includes(t)}">${t} <span class="n"></span></button>`).join('')}</div>
          <div class="frow"><label class="field${known(f.maxPins) ? ' set' : ''}" data-fwrap="maxPins">Max pins<select id="fpins"><option value="">Any</option>${PINS.map(v => `<option${String(f.maxPins) === String(v) ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
            ${selectField('gpio', ...SELECTS.gpio, f.min.gpio)}</div>
          <div class="frow"><label class="field${known(f.volt) ? ' set' : ''}" data-fwrap="volt">Runs at supply<select id="fvolt"><option value="">Any</option>${VOLTS.map(v => `<option value="${v}"${f.volt === v || Number(f.volt) === Number(v) ? ' selected' : ''}>${v} V</option>`).join('')}</select></label>
            ${selectField('tempMax', ...SELECTS.tempMax, f.min.tempMax)}</div>
        </section>
        <section class="fsec"><h3>Peripheral counts</h3>
          <div class="frow">${selectField('uart', ...SELECTS.uart, f.min.uart)}${selectField('spi', ...SELECTS.spi, f.min.spi)}</div>
          <div class="frow">${selectField('i2c', ...SELECTS.i2c, f.min.i2c)}${selectField('can', ...SELECTS.can, f.min.can)}</div>
          <div class="frow">${selectField('adcChannels', ...SELECTS.adcChannels, f.min.adcChannels)}</div>
        </section>
        <section class="fsec"><h3>Features <small>click: need · twice: exclude</small></h3>${featHtml}</section>
        <section class="fsec"><label class="toggle"><input type="checkbox" id="funk"${f.unknown ? ' checked' : ''}><span>Keep parts whose value is unconfirmed<br><span class="muted" style="font-size:12px">Shown with <span class="unkflag">?</span> — a criterion could not be checked against vendor documents.</span></span></label></section>
      </aside>
      <section class="results">
        <div class="rbar">
          <button class="btn filters-toggle" data-act="ftoggle" type="button">${icon('filter')}Filters <span class="badge" id="fcount" hidden></span></button>
          <div class="rcount" id="rcount" aria-live="polite"></div>
          <div class="menu"><button class="btn" data-act="cols" type="button" aria-expanded="false">${icon('cols')}Columns</button><div class="menu-pop" id="colmenu" hidden></div></div>
          <button class="btn" data-act="csv" type="button" title="Download the filtered list as CSV">${icon('dl')}CSV</button>
          <button class="btn" data-act="share" type="button" title="Copy a link to this exact filter set">${icon('link')}Link</button>
        </div>
        <div class="chips-active" id="chips"></div>
        <div class="quick" id="quick"></div>
        <div class="tablewrap" id="tablewrap"></div>
      </section></div>`;
    bindBrowse();
    updateResults();
  }

  let lastRows = [];
  function updateResults() {
    const f = state.filters;
    const rows = L.sortRows(L.filterParts(PARTS, f), state.sort.key, state.sort.dir);
    lastRows = rows;
    const nUnk = rows.filter(r => r.unknown.length).length;
    $('#rcount').innerHTML = `<b>${rows.length}</b> of ${PARTS.length} parts${nUnk ? `<span class="unk" title="At least one criterion could not be checked">· ${nUnk} unconfirmed</span>` : ''}`;
    const n = L.activeFilterCount(f); const fc = $('#fcount'); fc.textContent = n; fc.hidden = !n;

    // facet counts: lines & package types, ignoring their own selection
    const without = (k) => L.filterParts(PARTS, { ...f, [k]: [] });
    const byLine = {}; for (const r of without('lines')) byLine[r.part.line] = (byLine[r.part.line] || 0) + 1;
    $$('#f-lines .pill').forEach(b => { const c = byLine[b.dataset.line] || 0; b.querySelector('.n').textContent = c; b.classList.toggle('zero', !c); b.setAttribute('aria-pressed', String(f.lines.includes(b.dataset.line))); });
    const byPkg = {}; for (const r of without('pkg')) { const t = L.pkgType(r.part.package); byPkg[t] = (byPkg[t] || 0) + 1; }
    $$('#f-pkg .pill').forEach(b => { const c = byPkg[b.dataset.pkg] || 0; b.querySelector('.n').textContent = c; b.classList.toggle('zero', !c); b.setAttribute('aria-pressed', String(f.pkg.includes(b.dataset.pkg))); });
    $$('[data-fwrap]').forEach(w => { const k = w.dataset.fwrap; const v = k === 'maxPins' ? f.maxPins : k === 'volt' ? f.volt : f.min[k]; w.classList.toggle('set', known(v)); });

    renderChips();
    renderQuick(n);
    renderTable(rows);
  }

  function renderChips() {
    const f = state.filters, out = [];
    const chip = (label, act, no) => out.push(`<span class="chip-x${no ? ' no' : ''}">${esc(label)}<button type="button" data-rm="${esc(act)}" aria-label="Remove ${esc(label)}">×</button></span>`);
    if (f.q) chip(`“${f.q}”`, 'q');
    f.lines.forEach(l => chip(l, 'line:' + l));
    f.pkg.forEach(t => chip(t, 'pkg:' + t));
    for (const [k, v] of Object.entries(f.min)) if (known(v)) { const s = SELECTS[k]; chip(`${s[0]} ${v}${s[2] ? ' ' + s[2] : ''}`, 'min:' + k); }
    if (known(f.maxPins)) chip(`≤ ${f.maxPins} pins`, 'maxPins');
    if (known(f.volt)) chip(`Runs at ${f.volt} V`, 'volt');
    if (f.fpu) chip('FPU', 'fpu');
    for (const [k, v] of Object.entries(f.feat)) if (v === 'yes' || v === 'no') chip((v === 'no' ? 'No ' : '') + L.FEATURES[k][0], 'feat:' + k, v === 'no');
    if (out.length > 1) out.push(`<button class="btn ghost small" data-act="reset" type="button">Clear all</button>`);
    $('#chips').innerHTML = out.join('');
  }

  const QUICK = [
    ['Runs at 5 V', 'v=5.0'], ['USB device', 'has=usbDevice'], ['USB host', 'has=usbHost'], ['USB High-Speed', 'has=usbHS'],
    ['USB-C PD', 'has=usbPD'], ['CAN', 'has=can'], ['Ethernet', 'has=ethernet'], ['Bluetooth LE', 'has=ble'],
    ['FPU', 'fpu=1'], ['≤ 8 pins', 'maxpins=8'], ['≥ 105 °C', 'min_tempMax=105'], ['Op-amp', 'has=opamp'],
  ];
  function renderQuick(nActive) {
    const q = $('#quick');
    if (nActive) { q.innerHTML = ''; return; }
    q.innerHTML = `<span class="muted">Start from:</span>${QUICK.map(([l, h]) => `<a class="pill" href="#/?${h}">${esc(l)}</a>`).join('')}`
      + (store.get('hintSeen', false) ? '' : `<p class="hint-line">Type a part number in the top search to open its sheet, narrow the list with the filters, tick rows to compare. <button class="btn ghost small" type="button" data-act="hint-x">Got it</button></p>`);
  }

  function renderTable(rows) {
    const wrap = $('#tablewrap');
    if (!rows.length) {
      wrap.innerHTML = `<div class="empty"><h3>No part matches</h3><p>Relax a criterion — the active filters are listed above.${state.filters.unknown ? '' : ' Parts with unconfirmed values are currently hidden.'}</p><button class="btn" data-act="reset" type="button">${icon('reset')}Reset filters</button></div>`;
      return;
    }
    const cols = state.cols;
    const isNum = k => !!L.FIELD[k].better || ['mhz', 'flashKB', 'ramKB', 'gpio', 'pins'].includes(k);
    const sortAttr = k => state.sort.key === k ? ` aria-sort="${state.sort.dir === 'desc' ? 'descending' : 'ascending'}"` : '';
    const head = `<thead><tr><th class="cb" scope="col"><span class="sr" title="Add to compare">${icon('cmp').replace('class="i"', 'class="i" style="width:14px;height:14px"')}</span></th>${
      cols.map(k => `<th scope="col" data-sort="${k}" class="${k === 'id' ? 'pid' : ''}${isNum(k) ? ' num' : ''}"${sortAttr(k)} title="Sort by ${esc(L.FIELD[k].label)}">${esc(L.FIELD[k].short || L.FIELD[k].label)}</th>`).join('')}</tr></thead>`;
    const cmp = new Set(state.compare);
    const body = rows.map(({ part: p, unknown }) => {
      const sel = cmp.has(p.id);
      return `<tr data-id="${esc(p.id)}"${sel ? ' class="sel"' : ''}><td class="cb"><input type="checkbox" data-cmp="${esc(p.id)}"${sel ? ' checked' : ''} aria-label="Compare ${esc(p.id)}"></td>${
        cols.map(k => {
          if (k === 'id') return `<td class="pid"><a href="#/part/${enc(p.id)}">${esc(p.id)}</a>${unknown.length ? `<span class="unkflag" title="Unconfirmed: ${esc(unknown.join(', '))}">?</span>` : ''}</td>`;
          const v = L.display(p, k);
          const long = ['usb', 'eth', 'radio', 'core', 'timers', 'supply', 'isa'].includes(k);
          return `<td class="${isNum(k) ? 'num' : ''}${long ? ' txt' : ''}"${long && v ? ` title="${esc(v)}"` : ''}>${cell(p, k)}</td>`;
        }).join('')}</tr>`;
    }).join('');
    wrap.innerHTML = `<table class="grid">${head}<tbody>${body}</tbody></table>`;
  }

  function filtersChanged() {
    history.replaceState(null, '', browseHash());
    updateResults();
  }

  function renderColMenu() {
    const m = $('#colmenu');
    m.innerHTML = L.COLUMNS.map(([k]) => `<label><input type="checkbox" data-col="${k}"${state.cols.includes(k) ? ' checked' : ''}${k === 'id' ? ' disabled' : ''}> ${esc(L.FIELD[k].label)}</label>`).join('')
      + `<div style="border-top:1px solid var(--line);margin-top:6px;padding-top:6px"><button class="btn ghost small" type="button" data-act="cols-default">Restore defaults</button></div>`;
  }

  function bindBrowse() {
    const root = $('#browse');
    let tq;
    $('#fq').addEventListener('input', e => { clearTimeout(tq); tq = setTimeout(() => { state.filters.q = e.target.value.trim(); filtersChanged(); }, 120); });
    root.addEventListener('change', e => {
      const t = e.target, f = state.filters;
      if (t.dataset.min) { if (t.value) f.min[t.dataset.min] = t.value; else delete f.min[t.dataset.min]; }
      else if (t.id === 'fpins') f.maxPins = t.value;
      else if (t.id === 'fvolt') f.volt = t.value;
      else if (t.id === 'ffpu') f.fpu = t.checked;
      else if (t.id === 'funk') f.unknown = t.checked;
      else if (t.dataset.cmp) { toggleCompare(t.dataset.cmp); t.closest('tr').classList.toggle('sel', state.compare.includes(t.dataset.cmp)); t.checked = state.compare.includes(t.dataset.cmp); return; }
      else if (t.dataset.col) {
        const k = t.dataset.col;
        state.cols = t.checked ? L.COLUMNS.map(c => c[0]).filter(c => c === k || state.cols.includes(c)) : state.cols.filter(c => c !== k);
        store.set('cols', state.cols); renderTable(lastRows); return;
      } else return;
      filtersChanged();
    });
    root.addEventListener('click', e => {
      const t = e.target.closest('button, th[data-sort], tr[data-id], input, a');
      if (!t) return;
      const f = state.filters;
      if (t.dataset.feat) {
        const k = t.dataset.feat, nx = { undefined: 'yes', yes: 'no', no: undefined }[f.feat[k]];
        if (nx) f.feat[k] = nx; else delete f.feat[k];
        t.className = 'pill ' + (nx || ''); filtersChanged();
      } else if (t.dataset.line) {
        const l = t.dataset.line; f.lines = f.lines.includes(l) ? f.lines.filter(x => x !== l) : [...f.lines, l]; filtersChanged();
      } else if (t.dataset.pkg) {
        const p = t.dataset.pkg; f.pkg = f.pkg.includes(p) ? f.pkg.filter(x => x !== p) : [...f.pkg, p]; filtersChanged();
      } else if (t.dataset.rm) {
        const [kind, k] = t.dataset.rm.split(':');
        if (kind === 'q') f.q = '';
        else if (kind === 'line') f.lines = f.lines.filter(x => x !== k);
        else if (kind === 'pkg') f.pkg = f.pkg.filter(x => x !== k);
        else if (kind === 'min') delete f.min[k];
        else if (kind === 'maxPins') f.maxPins = '';
        else if (kind === 'volt') f.volt = '';
        else if (kind === 'fpu') f.fpu = false;
        else if (kind === 'feat') delete f.feat[k];
        renderBrowseKeepScroll();
      } else if (t.dataset.act === 'hint-x') { store.set('hintSeen', true); t.closest('p').remove(); }
      else if (t.dataset.act === 'reset') { state.filters = L.emptyFilters(); renderBrowseKeepScroll(); }
      else if (t.dataset.act === 'ftoggle') root.classList.toggle('fopen');
      else if (t.dataset.act === 'csv') download(`wch-riscv-mcus-${lastRows.length}.csv`, L.csv(lastRows.map(r => r.part)), 'text/csv;charset=utf-8');
      else if (t.dataset.act === 'share') copy(location.href, 'Link to this filter set copied');
      else if (t.dataset.act === 'cols') { const m = $('#colmenu'); renderColMenu(); m.hidden = !m.hidden; t.setAttribute('aria-expanded', String(!m.hidden)); }
      else if (t.dataset.act === 'cols-default') { state.cols = DEFAULT_COLS.slice(); store.set('cols', state.cols); renderColMenu(); renderTable(lastRows); }
      else if (t.dataset.sort) {
        const k = t.dataset.sort, fld = L.FIELD[k];
        state.sort = state.sort.key === k ? { key: k, dir: state.sort.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: fld.better === 'high' ? 'desc' : 'asc' };
        filtersChanged();
      } else if (t.tagName === 'TR' && !e.target.closest('td.cb')) {
        if (e.ctrlKey || e.metaKey) window.open('#/part/' + enc(t.dataset.id)); else go('#/part/' + enc(t.dataset.id));
      }
    });
    root.addEventListener('click', e => { if (e.target === root && root.classList.contains('fopen')) root.classList.remove('fopen'); });
  }
  function renderBrowseKeepScroll() { const y = window.scrollY; history.replaceState(null, '', browseHash()); renderBrowse(); window.scrollTo(0, y); }
  document.addEventListener('click', e => {
    const m = $('#colmenu'); if (m && !m.hidden && !e.target.closest('.menu')) { m.hidden = true; }
  });

  /* ── tray ──────────────────────────────────────── */
  function renderTray() {
    const t = $('#tray');
    const show = state.compare.length && state.view !== 'compare';
    t.hidden = !show; if (!show) return;
    t.innerHTML = `<span class="lbl">Compare</span><div class="items">${state.compare.map(id => `<span class="it">${esc(id)}<button type="button" data-trm="${esc(id)}" aria-label="Remove ${esc(id)}">×</button></span>`).join('')}</div>
      <a class="btn primary" href="${compareHash()}">${icon('cmp')}Compare ${state.compare.length}</a>
      <button class="btn ghost small" type="button" data-tclear>Clear</button>`;
  }
  $('#tray').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.trm) setCompare(state.compare.filter(x => x !== b.dataset.trm));
    else if ('tclear' in b.dataset) setCompare([]);
    syncCompareMarks();
  });
  function syncCompareMarks() {
    const set = new Set(state.compare);
    $$('tr[data-id]').forEach(tr => { const on = set.has(tr.dataset.id); tr.classList.toggle('sel', on); const cb = tr.querySelector('input[data-cmp]'); if (cb) cb.checked = on; });
    const pb = $('[data-act="pcmp"]'); if (pb) setPartCmpBtn(pb);
  }

  /* ── part page ─────────────────────────────────── */
  function setPartCmpBtn(b) {
    const on = state.compare.includes(b.dataset.id);
    b.classList.toggle('on', on); b.innerHTML = on ? icon('check') + 'In compare' : icon('plus') + 'Add to compare';
  }
  function featureCard(p) {
    return L.FEATURE_GROUPS.map(g => {
      const items = Object.entries(L.FEATURES).filter(([, v]) => v[1] === g).map(([k, v]) => {
        const x = p.features ? p.features[k] : null;
        const cls = x === true ? 'y' : x === false ? 'n' : 'u';
        return `<div class="feat ${cls}"><span class="mark ${cls}" aria-label="${x === true ? 'yes' : x === false ? 'no' : 'unknown'}">${x === true ? '✓' : x === false ? '–' : '?'}</span>${esc(v[0])}</div>`;
      }).join('');
      return items;
    }).join('');
  }
  const specRows = (p, group) => L.FIELDS.filter(f => f.group === group).map(f => `<dt>${esc(f.label)}</dt><dd>${cell(p, f.key)}</dd>`).join('');

  function renderPart(id) {
    const p = getPart(id);
    if (!p) {
      const { parts } = suggestions(id, 6);
      $('#view').innerHTML = `<div class="page"><div class="empty"><h3>No part “${esc(id)}” in the catalogue</h3>${parts.length ? `<p>Closest matches:</p><p>${parts.map(x => `<a class="mono" href="#/part/${enc(x.id)}">${esc(x.id)}</a>`).join(' · ')}</p>` : ''}<p><a href="#/">Back to browse</a></p></div></div>`;
      return;
    }
    document.title = `${p.id} — WCH RISC-V MCU Explorer`;
    const fam = FAMILIES.get(p.family) || [p];
    const ds = (p.sources || [])[0];
    const facts = [['Core', p.core], ['Clock', L.display(p, 'mhz')], ['Flash', L.display(p, 'flashKB')], ['SRAM', L.display(p, 'ramKB')], ['Package', p.package], ['GPIO', L.display(p, 'gpio')], ['Supply', L.display(p, 'supply')]];
    const status = p.status && p.status !== 'active' ? `<span class="status ${esc(p.status)}">${p.status === 'nrnd' ? 'NRND' : esc(p.status)}</span>` : '';
    $('#view').innerHTML = `<div class="page">
      <div class="crumbs"><a href="#/">Browse</a> › <a href="#/?line=${enc(p.line)}">${esc(p.line)}</a> › <a href="#/?q=${enc(p.family)}">${esc(p.family)}</a></div>
      <div class="phead">
        <div><h1>${esc(p.id)}${status}</h1><div class="sub">${[L.LINES[p.line] || p.line, p.isa, p.checkedAt && 'data checked ' + p.checkedAt].filter(Boolean).map(esc).join(' · ')}</div></div>
        <div class="actions">
          <button class="btn" type="button" data-act="pcmp" data-id="${esc(p.id)}"></button>
          <button class="btn" type="button" data-act="alt" title="Open Browse with this part's capabilities as minimum requirements">${icon('alt')}Find alternatives</button>
          ${ds ? `<a class="btn" href="${esc(ds.url)}" target="_blank" rel="noopener">${icon('doc')}Datasheet</a>` : ''}
          <button class="btn ghost" type="button" data-act="plink" title="Copy link">${icon('link')}</button>
        </div>
      </div>
      <div class="facts">${facts.map(([k, v]) => `<div class="fact"><div class="k">${k}</div><div class="v">${known(v) ? esc(v) : UNK}</div></div>`).join('')}</div>
      ${fam.length > 1 ? `<div class="variants"><span class="lbl">${esc(p.family)} variants:</span>${fam.map(x => `<a class="variant${x.id === p.id ? ' cur' : ''}" href="#/part/${enc(x.id)}"><b>${esc(x.id)}</b><span>${esc(x.package || '?')} · ${known(x.gpio) ? x.gpio + ' GPIO' : '? GPIO'}${x.flashKB !== p.flashKB && known(x.flashKB) ? ' · ' + esc(L.display(x, 'flashKB')) : ''}</span></a>`).join('')}
        <a class="btn ghost small" href="#/compare/${fam.map(x => enc(x.id)).join(',')}">Compare all ${fam.length}</a></div>` : ''}
      <div class="pcols">${L.FIELD_GROUPS.filter(g => g !== 'Identity').map(g => `<section class="card"><h2>${esc(g)}</h2><dl class="specs">${specRows(p, g)}</dl></section>`).join('')}</div>
      <div class="pgrid">
        <section class="card span"><h2>Features</h2><div class="featgrid">${featureCard(p)}</div></section>
        ${(p.notes || []).length ? `<section class="card span"><h2>Notes &amp; caveats</h2><ul class="notes">${p.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></section>` : ''}
        <section class="card span"><h2>Sources</h2><ul class="sources">${(p.sources || []).map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title || s.url)}</a>${s.detail ? `<span class="det">${esc(s.detail)}</span>` : ''}</li>`).join('') || '<li class="muted">No source recorded.</li>'}</ul></section>
      </div>
      <div class="legend"><span>${UNK} not established from vendor documents</span><span><span class="dash">—</span> documented absent</span></div>
    </div>`;
    setPartCmpBtn($('[data-act="pcmp"]'));
    $('.page').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.act === 'pcmp') { toggleCompare(p.id); setPartCmpBtn(b); }
      else if (b.dataset.act === 'plink') copy(location.href, 'Link copied');
      else if (b.dataset.act === 'alt') {
        const f = L.emptyFilters();
        for (const k of ['flashKB', 'ramKB', 'gpio']) if (known(p[k]) && p[k] > 0) f.min[k] = String(nearestBelow(SELECTS[k][1], p[k]) ?? '');
        for (const k of ['usbFS', 'usbHS', 'usbSS', 'usbPD', 'ethernet', 'ble', 'rf24', 'can', 'canFD', 'dac', 'sdio', 'extMem']) if (p.features && p.features[k] === true) f.feat[k] = 'yes';
        if (p.fpu && p.fpu !== 'none') f.fpu = true;
        for (const k of Object.keys(f.min)) if (!f.min[k]) delete f.min[k];
        state.filters = f; state.sort = { key: 'flashKB', dir: 'asc' };
        go(browseHash());
        toast('Minimums set from ' + p.id + ' — relax as needed');
      }
    });
    window.scrollTo(0, 0);
  }
  const nearestBelow = (list, v) => { let best = null; for (const x of list) if (x <= v) best = x; return best; };

  /* ── compare ───────────────────────────────────── */
  function renderCompare() {
    document.title = 'Compare — WCH RISC-V MCU Explorer';
    const ps = state.compare.map(getPart).filter(Boolean);
    const adder = `<div class="adder"><input class="plain" type="search" id="cadd" placeholder="Add a part…" autocomplete="off" spellcheck="false" aria-label="Add a part to compare"><ul id="cadd-list" hidden></ul></div>`;
    if (!ps.length) {
      const ex = [['CH32V003F4P6', 'CH32V006K8U7', 'CH32V203C8T6'], ['CH32V203C8T6', 'CH32V307VCT6', 'CH32H417QEU6'], ['CH582M', 'CH592X', 'CH585M']]
        .map(set => set.filter(getPart)).filter(s => s.length > 1);
      $('#view').innerHTML = `<div class="page"><div class="cmp-empty"><h2>Compare parts side by side</h2>
        <p>Tick parts in Browse, use “Add to compare” on a part page, or type a part number below. Up to ${MAX_COMPARE} parts.</p>
        <div style="display:flex;justify-content:center;margin-top:14px">${adder}</div>
        ${ex.length ? `<div class="examples"><span class="muted">Examples</span>${ex.map(s => `<a href="#/compare/${s.map(enc).join(',')}">${s.join(' vs ')}</a>`).join('')}</div>` : ''}
      </div></div>`;
      bindAdder(); return;
    }
    const rows = [];
    const diffCls = d => d ? ' class="diff"' : '';
    for (const g of L.FIELD_GROUPS) {
      const fields = L.FIELDS.filter(f => f.group === g && !(g === 'Identity' && f.key === 'id'));
      const body = fields.map(f => {
        const d = L.rowDiffers(ps, f.key);
        if (state.diffOnly && !d && ps.length > 1) return '';
        const best = new Set(L.bestIndices(ps, f.key));
        return `<tr${diffCls(d && ps.length > 1)}><th scope="row">${esc(f.label)}</th>${ps.map((p, i) => `<td${best.has(i) ? ' class="best"' : ''}>${cell(p, f.key)}</td>`).join('')}</tr>`;
      }).join('');
      if (body) rows.push(`<tr class="grp"><th>${esc(g)}</th><td colspan="${ps.length}"></td></tr>${body}`);
    }
    for (const g of L.FEATURE_GROUPS) {
      const body = Object.entries(L.FEATURES).filter(([, v]) => v[1] === g).map(([k, v]) => {
        const d = L.featureDiffers(ps, k);
        if (state.diffOnly && !d && ps.length > 1) return '';
        return `<tr${diffCls(d && ps.length > 1)}><th scope="row">${esc(v[0])}</th>${ps.map(p => { const x = p.features ? p.features[k] : null; const c = x === true ? 'y' : x === false ? 'n' : 'u'; return `<td><span class="mark ${c}">${x === true ? '✓' : x === false ? '–' : '?'}</span></td>`; }).join('')}</tr>`;
      }).join('');
      if (body) rows.push(`<tr class="grp"><th>Features · ${esc(g)}</th><td colspan="${ps.length}"></td></tr>${body}`);
    }
    rows.push(`<tr class="grp"><th>Notes &amp; sources</th><td colspan="${ps.length}"></td></tr>
      <tr><th scope="row">Notes</th>${ps.map(p => `<td class="long">${(p.notes || []).length ? `<ul>${p.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : '<span class="dash">—</span>'}</td>`).join('')}</tr>
      <tr><th scope="row">Sources</th>${ps.map(p => `<td class="long">${(p.sources || []).map(s => `<div><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title || s.url)}</a></div>`).join('')}</td>`).join('')}</tr>`);

    $('#view').innerHTML = `<div class="page" style="max-width:none">
      <div class="cmp-head"><h1>Compare <span class="muted" style="font-weight:400">${ps.length} part${ps.length > 1 ? 's' : ''}</span></h1>
        ${adder}
        <button class="btn${state.diffOnly ? ' on' : ''}" type="button" data-act="diff" aria-pressed="${state.diffOnly}">Only differences</button>
        <button class="btn" type="button" data-act="ccsv">${icon('dl')}CSV</button>
        <button class="btn" type="button" data-act="clink">${icon('link')}Link</button>
        <button class="btn ghost" type="button" data-act="cclear">Clear</button>
      </div>
      <div class="cmpwrap"><table class="cmp"><thead><tr><th></th>${ps.map(p => `<th><div class="pn"><a href="#/part/${enc(p.id)}">${esc(p.id)}</a><button type="button" data-crm="${esc(p.id)}" title="Remove" aria-label="Remove ${esc(p.id)}">×</button></div><div class="sub">${esc(p.family)} · ${esc(p.package || '?')}</div></th>`).join('')}</tr></thead>
      <tbody>${rows.join('')}</tbody></table></div>
      <div class="legend"><span><span class="mark y">✓</span> yes</span><span><span class="mark n">–</span> documented absent</span><span><span class="mark u">?</span> not established</span><span><span style="display:inline-block;width:12px;height:12px;background:var(--best);border-radius:3px"></span> best value in row</span><span><span style="display:inline-block;width:6px;height:6px;background:var(--accent);border-radius:50%"></span> row differs</span></div>
    </div>`;
    bindAdder();
    $('.page').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.crm) { setCompare(state.compare.filter(x => x !== b.dataset.crm)); history.replaceState(null, '', state.compare.length ? compareHash() : '#/compare'); renderCompare(); }
      else if (b.dataset.act === 'diff') { state.diffOnly = !state.diffOnly; store.set('diffOnly', state.diffOnly); renderCompare(); }
      else if (b.dataset.act === 'ccsv') download(`wch-compare-${ps.length}.csv`, L.csv(ps), 'text/csv;charset=utf-8');
      else if (b.dataset.act === 'clink') copy(location.href.split('#')[0] + compareHash(), 'Comparison link copied');
      else if (b.dataset.act === 'cclear') { setCompare([]); history.replaceState(null, '', '#/compare'); renderCompare(); }
    });
  }
  function bindAdder() {
    const inp = $('#cadd'), ul = $('#cadd-list'); if (!inp) return;
    let items = [], idx = -1;
    const show = () => {
      const { parts } = suggestions(inp.value, 10);
      items = parts.filter(p => !state.compare.includes(p.id));
      ul.innerHTML = items.map((p, i) => `<li data-i="${i}"><b>${esc(p.id)}</b><span>${esc(brief(p))}</span></li>`).join('');
      ul.hidden = !items.length; idx = -1;
    };
    const add = p => { if (!p) return; toggleCompare(p.id); history.replaceState(null, '', compareHash()); renderCompare(); const n = $('#cadd'); if (n) n.focus(); };
    inp.addEventListener('input', show);
    inp.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!items.length) return; idx = (idx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; $$('li', ul).forEach(li => li.setAttribute('aria-selected', String(+li.dataset.i === idx))); }
      else if (e.key === 'Enter') { e.preventDefault(); add(idx >= 0 ? items[idx] : getPart(inp.value) || items[0]); }
      else if (e.key === 'Escape') ul.hidden = true;
    });
    ul.addEventListener('mousedown', e => { const li = e.target.closest('li'); if (li) { e.preventDefault(); add(items[+li.dataset.i]); } });
    inp.addEventListener('blur', () => setTimeout(() => { ul.hidden = true; }, 120));
  }

  /* ── about / data ──────────────────────────────── */
  function renderAbout() {
    document.title = 'Data — WCH RISC-V MCU Explorer';
    const m = DATA.meta || {};
    const lines = Object.keys(L.LINES).filter(l => PARTS.some(p => p.line === l));
    const famRows = lines.map(l => {
      const fams = [...FAMILIES.keys()].filter(f => FAMILIES.get(f)[0].line === l).sort(L.naturalCmp);
      return `<tr><td><a href="#/?line=${enc(l)}"><b>${l}</b></a></td><td>${fams.map(f => `<a href="#/?q=${enc(f)}">${esc(f)}</a> <span class="muted">(${FAMILIES.get(f).length})</span>`).join(', ')}</td><td class="num">${PARTS.filter(p => p.line === l).length}</td></tr>`;
    }).join('');
    const nullRate = (() => {
      let total = 0, nul = 0;
      for (const p of PARTS) for (const f of L.FIELDS) { total++; if (!known(L.raw(p, f))) nul++; }
      return total ? Math.round(100 * nul / total) : 0;
    })();
    $('#view').innerHTML = `<div class="page"><div class="prose">
      <h1>About the data</h1>
      <p><b>${PARTS.length}</b> orderable part numbers across <b>${FAMILIES.size}</b> families. Data last checked <b>${esc(m.checkedAt || '?')}</b>. ${nullRate}% of spec cells are marked unknown.</p>
      <h2>Coverage</h2>
      <table class="simple"><thead><tr><th>Line</th><th>Families (parts)</th><th class="num">Parts</th></tr></thead><tbody>${famRows}</tbody></table>
      <h2>Conventions</h2>
      <ul>
        <li>One row = one orderable part number. Family maxima are never copied onto smaller packages: GPIO, ADC inputs and peripheral counts are per package.</li>
        <li>${UNK} means the value could not be established from a vendor document. <span class="dash">—</span> / ✕ means the vendor documents it as absent. The two are never merged.</li>
        <li><b>Flash</b> is user program flash (CodeFlash). Configurable flash/SRAM splits, DataFlash and boot areas are explained in each part's notes.</li>
        <li><b>Clock</b> is the documented maximum for the main core. Zero-wait-state limits are in notes where documented.</li>
        <li><b>Supply</b> is the main VDD range. Additional domains or narrower ranges required by USB are in notes.</li>
        <li><b>ADC inputs</b> counts external analog channels available on that package.</li>
        <li>Filtering: a part is removed only when a vendor document contradicts a criterion. A part with an unknown value stays in the list, flagged <span class="unkflag">?</span>, unless you untick “Keep parts whose value is unconfirmed”.</li>
      </ul>
      <h2>Sources</h2>
      <p>Each part lists the vendor documents used (datasheet revision, table or section). Specs come from WCH datasheets, WCH product pages/selection tables and the openwch GitHub repositories. Distributor listings are only used to confirm that a part number exists. No pricing or stock data: check your distributor.</p>
      <p>This is an independent project, not affiliated with WCH (Nanjing Qinheng Microelectronics). Always validate against the current datasheet before committing a design — pin multiplexing, clock trees and electrical limits are out of scope here.</p>
      <h2>Updating the catalogue</h2>
      <p>Records live in <code>data/parts/*.json</code> (schema in <code>data/SCHEMA.md</code>). After editing, regenerate the bundled file and run the checks:</p>
      <pre>python3 tools/build_data.py     # validates and writes js/data.js
node --test tests/              # optional, Node 18+</pre>
      <p>The site itself has no build step and no dependencies: open <code>index.html</code> directly, or publish the folder on GitHub Pages.</p>
      <h2>Shortcuts</h2>
      <ul><li><kbd>/</kbd> focuses the part search. Arrow keys + Enter pick a suggestion.</li><li>In Browse, click a column header to sort; Ctrl/⌘-click a row to open it in a new tab.</li><li>Filter sets and comparisons are encoded in the URL — copy it to share.</li></ul>
      <h2>Export</h2>
      <p><button class="btn" type="button" data-act="all-csv">${icon('dl')}Full catalogue (CSV)</button> <button class="btn" type="button" data-act="all-json">${icon('dl')}Full catalogue (JSON)</button></p>
    </div></div>`;
    $('.page').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.act === 'all-csv') download('wch-riscv-mcus.csv', L.csv(PARTS), 'text/csv;charset=utf-8');
      if (b.dataset.act === 'all-json') download('wch-riscv-mcus.json', JSON.stringify(DATA, null, 2), 'application/json');
    });
    window.scrollTo(0, 0);
  }

  /* ── theme & boot ──────────────────────────────── */
  $('#theme-btn').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const nx = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nx; store.set('theme', nx);
  });
  window.addEventListener('hashchange', () => { document.title = 'WCH RISC-V MCU Explorer'; route(); });
  initSearch();
  setCompare(state.compare);
  if (!PARTS.length) { $('#view').innerHTML = '<p class="boot">No data loaded (js/data.js missing).</p>'; return; }
  route();
})();
