/* WCH RISC-V MCU Explorer — pure logic (no DOM). Works as a classic browser script and in Node. */
(function (root) {
  'use strict';

  const known = v => v !== null && v !== undefined && v !== '';

  const LINES = {
    CH32V0: 'CH32V0 · entry, 48 MHz',
    CH32V1: 'CH32V1 · legacy mainstream',
    CH32V2: 'CH32V2 · mainstream USB/CAN',
    CH32V3: 'CH32V3 · high-density, FPU',
    CH32V4: 'CH32V4',
    CH32L1: 'CH32L1 · low power',
    CH32X0: 'CH32X0 · USB PD / mixed-signal',
    CH32X3: 'CH32X3',
    CH32H4: 'CH32H4 · dual-core 400 MHz',
    CH32M: 'CH32M · motor control',
    CH64x: 'CH64x / CH66x · application-specific',
    CH56x: 'CH56x · USB HS/SS, Gigabit',
    CH57x: 'CH57x · BLE',
    CH58x: 'CH58x · BLE + USB',
    CH59x: 'CH59x · BLE',
  };

  /* Feature flags: key → [label, group] */
  const FEATURES = {
    usbFS: ['USB Full-Speed', 'USB'],
    usbHS: ['USB High-Speed', 'USB'],
    usbSS: ['USB SuperSpeed', 'USB'],
    usbHost: ['USB Host', 'USB'],
    usbDevice: ['USB Device', 'USB'],
    usbPD: ['USB-C / PD', 'USB'],
    ethernet: ['Ethernet MAC', 'Network & radio'],
    ethPHY: ['Ethernet PHY on chip', 'Network & radio'],
    ble: ['Bluetooth LE', 'Network & radio'],
    rf24: ['2.4 GHz proprietary', 'Network & radio'],
    can: ['CAN', 'Serial'],
    canFD: ['CAN FD', 'Serial'],
    i2s: ['I²S', 'Serial'],
    sdio: ['SDIO / SDMMC', 'Serial'],
    adc: ['ADC', 'Analog'],
    dac: ['DAC', 'Analog'],
    opamp: ['Op-amp', 'Analog'],
    comparator: ['Comparator', 'Analog'],
    touch: ['Touch sensing', 'Analog'],
    lcd: ['LCD drive', 'Other'],
    extMem: ['External memory bus', 'Other'],
    dvp: ['Camera (DVP)', 'Other'],
    rtc: ['RTC', 'Other'],
    crypto: ['Crypto / TRNG', 'Other'],
    lowPower: ['Sleep / standby modes', 'Other'],
    pioc: ['Programmable IO (PIOC)', 'Other'],
  };
  const FEATURE_GROUPS = ['USB', 'Network & radio', 'Serial', 'Analog', 'Other'];

  const flashTotal = p => known(p.flashTotalKB) ? p.flashTotalKB : p.flashKB;
  const fmtNum = (v, unit) => known(v) ? `${v}${unit ? ' ' + unit : ''}` : null;
  const fmtKB = v => {
    if (!known(v)) return null;
    if (v === 0) return '—';
    if (v >= 1024 && v % 1024 === 0) return `${v / 1024} MB`;
    return `${v} KB`;
  };
  const fmtRange = (lo, hi, unit) => known(lo) && known(hi) ? `${lo} – ${hi} ${unit}` : null;
  const fmtSupply = p => {
    if (Array.isArray(p.supplyRanges) && p.supplyRanges.length) return p.supplyRanges.map(([a, b]) => `${a} – ${b} V`).join(' / ');
    return fmtRange(p.vMin, p.vMax, 'V');
  };
  const fmtText = v => known(v) ? String(v) : null;
  const fmtNone = v => !known(v) ? null : (/^none$/i.test(v) ? '—' : String(v));

  /* Spec fields. `better`: which direction wins in compare highlights. `num`: numeric value used for sort/compare. */
  const FIELDS = [
    { key: 'id', label: 'Part number', group: 'Identity', fmt: fmtText },
    { key: 'family', label: 'Family', group: 'Identity', fmt: fmtText },
    { key: 'line', label: 'Line', group: 'Identity', fmt: fmtText },
    { key: 'status', label: 'Status', group: 'Identity', fmt: fmtText },
    { key: 'core', label: 'Core', group: 'Core & memory', fmt: fmtText },
    { key: 'isa', label: 'ISA', group: 'Core & memory', fmt: fmtText },
    { key: 'cores', label: 'Cores', group: 'Core & memory', fmt: v => fmtNum(v), better: 'high' },
    { key: 'mhz', label: 'Max clock', short: 'MHz', group: 'Core & memory', fmt: v => fmtNum(v, 'MHz'), better: 'high' },
    { key: 'fpu', label: 'FPU', group: 'Core & memory', fmt: fmtNone },
    { key: 'flashKB', label: 'Flash', group: 'Core & memory', get: p => flashTotal(p), better: 'high',
      fmt: (_, p) => known(p.flashTotalKB) && known(p.flashKB) && p.flashTotalKB > p.flashKB ? `${fmtKB(p.flashTotalKB)} (${p.flashKB} zero-wait)` : fmtKB(p.flashKB) },
    { key: 'dataFlashKB', label: 'Data flash', group: 'Core & memory', fmt: fmtKB, better: 'high' },
    { key: 'ramKB', label: 'SRAM', short: 'RAM', group: 'Core & memory', fmt: fmtKB, better: 'high' },
    { key: 'package', label: 'Package', short: 'Pkg', group: 'Package & electrical', fmt: fmtText },
    { key: 'pins', label: 'Pins', group: 'Package & electrical', fmt: v => fmtNum(v) },
    { key: 'packageSize', label: 'Body size', group: 'Package & electrical', fmt: fmtText },
    { key: 'gpio', label: 'GPIO', group: 'Package & electrical', fmt: v => fmtNum(v), better: 'high' },
    { key: 'supply', label: 'Supply', group: 'Package & electrical', get: p => p.vMin, fmt: (_, p) => fmtSupply(p) },
    { key: 'temp', label: 'Temperature', short: 'Temp', group: 'Package & electrical', get: p => p.tempMax, fmt: (_, p) => known(p.tempMin) && known(p.tempMax) ? `${p.tempMin} … ${p.tempMax} °C` : null, better: 'high' },
    { key: 'uart', label: 'UART', group: 'Digital interfaces', fmt: v => fmtNum(v), better: 'high' },
    { key: 'spi', label: 'SPI', group: 'Digital interfaces', fmt: v => fmtNum(v), better: 'high' },
    { key: 'i2c', label: 'I²C', group: 'Digital interfaces', fmt: v => fmtNum(v), better: 'high' },
    { key: 'i2s', label: 'I²S', group: 'Digital interfaces', fmt: v => fmtNum(v), better: 'high' },
    { key: 'can', label: 'CAN', group: 'Digital interfaces', fmt: v => fmtNum(v), better: 'high' },
    { key: 'usb', label: 'USB', group: 'Digital interfaces', fmt: fmtNone },
    { key: 'eth', label: 'Ethernet', short: 'Eth', group: 'Digital interfaces', fmt: fmtNone },
    { key: 'radio', label: 'Radio', group: 'Digital interfaces', fmt: fmtNone },
    { key: 'adc', label: 'ADC', group: 'Analog', get: p => p.adcChannels, fmt: (_, p) => !known(p.adcChannels) ? null : p.adcChannels === 0 ? '—' : `${p.adcChannels} ch${known(p.adcBits) ? ` × ${p.adcBits}-bit` : ''}`, better: 'high' },
    { key: 'dacChannels', label: 'DAC', group: 'Analog', fmt: v => !known(v) ? null : v === 0 ? '—' : `${v} ch`, better: 'high' },
    { key: 'opamps', label: 'Op-amps', group: 'Analog', fmt: v => fmtNum(v), better: 'high' },
    { key: 'comparators', label: 'Comparators', group: 'Analog', fmt: v => fmtNum(v), better: 'high' },
    { key: 'touchChannels', label: 'Touch channels', group: 'Analog', fmt: v => fmtNum(v), better: 'high' },
    { key: 'timers', label: 'Timers', group: 'System', fmt: fmtText },
    { key: 'dmaChannels', label: 'DMA channels', short: 'DMA', group: 'System', fmt: v => fmtNum(v), better: 'high' },
    { key: 'debug', label: 'Debug', group: 'System', fmt: fmtText },
  ];
  const FIELD = Object.fromEntries(FIELDS.map(f => [f.key, f]));
  const FIELD_GROUPS = [...new Set(FIELDS.map(f => f.group))];

  const raw = (p, f) => (f.get ? f.get(p) : p[f.key]);
  const display = (p, key) => { const f = FIELD[key]; return f.fmt(raw(p, f), p); };

  /* Table columns available to the user (default visibility). */
  const COLUMNS = [
    ['id', true], ['core', true], ['mhz', true], ['flashKB', true], ['ramKB', true], ['package', true],
    ['gpio', true], ['supply', true], ['usb', true], ['eth', false], ['radio', true], ['can', true],
    ['uart', false], ['spi', false], ['i2c', false], ['adc', true], ['dacChannels', false], ['opamps', false],
    ['comparators', false], ['temp', false], ['fpu', false], ['isa', false], ['dataFlashKB', false],
    ['pins', false], ['dmaChannels', false], ['family', false], ['line', false],
  ];

  /* Numeric minimum filters: filter key → [field getter, label, unit] */
  const MIN_FILTERS = {
    flashKB: [p => flashTotal(p), 'Flash', 'KB'],
    ramKB: [p => p.ramKB, 'SRAM', 'KB'],
    mhz: [p => p.mhz, 'Clock', 'MHz'],
    gpio: [p => p.gpio, 'GPIO', ''],
    uart: [p => p.uart, 'UART', ''],
    spi: [p => p.spi, 'SPI', ''],
    i2c: [p => p.i2c, 'I²C', ''],
    can: [p => p.can, 'CAN', ''],
    adcChannels: [p => p.adcChannels, 'ADC ch.', ''],
    tempMax: [p => p.tempMax, 'Max temp', '°C'],
  };

  const PKG_TYPES = ['SOP', 'TSSOP', 'QSOP', 'DFN', 'QFN', 'LQFP', 'BGA', 'Other'];
  const pkgType = pkg => {
    if (!pkg) return 'Other';
    const s = String(pkg).toUpperCase();
    for (const t of ['TSSOP', 'QSOP', 'LQFP', 'QFN', 'DFN', 'BGA', 'SOP']) if (s.startsWith(t) || s.includes(t)) return t;
    return 'Other';
  };

  const emptyFilters = () => ({
    q: '', lines: [], pkg: [], min: {}, maxPins: '', volt: '', feat: {}, fpu: false, unknown: true,
  });

  const supplyRanges = p => Array.isArray(p.supplyRanges) && p.supplyRanges.length ? p.supplyRanges
    : known(p.vMin) && known(p.vMax) ? [[p.vMin, p.vMax]] : null;

  function haystack(p) {
    if (p._hay) return p._hay;
    const feats = Object.keys(FEATURES).filter(k => p.features && p.features[k] === true).map(k => FEATURES[k][0]);
    const s = [p.id, p.family, p.line, p.core, p.isa, p.package, p.usb, p.eth, p.radio, p.fpu === 'FP32' ? 'fpu fp32 float' : '', ...feats]
      .filter(known).join(' ').toLowerCase();
    Object.defineProperty(p, '_hay', { value: s, enumerable: false });
    return s;
  }

  /* Returns {ok:boolean, unknown:[labels], fail:[labels]} — ok=false means documented mismatch. */
  function evaluate(p, f) {
    const unknown = [], fail = [];
    const test = (label, v, pred) => { if (!known(v)) unknown.push(label); else if (!pred(v)) fail.push(label); };

    for (const [k, want] of Object.entries(f.feat || {})) {
      if (want !== 'yes' && want !== 'no') continue;
      test(FEATURES[k] ? FEATURES[k][0] : k, p.features ? p.features[k] : null, v => v === (want === 'yes'));
    }
    for (const [k, v] of Object.entries(f.min || {})) {
      const n = Number(v); if (!known(v) || !Number.isFinite(n) || !MIN_FILTERS[k]) continue;
      const [get, label] = MIN_FILTERS[k];
      test(label, get(p), x => x >= n);
    }
    if (known(f.maxPins) && Number(f.maxPins) > 0) test('Pins', p.pins, x => x <= Number(f.maxPins));
    if (known(f.volt) && Number(f.volt) > 0) {
      const V = Number(f.volt);
      test(`Supply ${V} V`, supplyRanges(p), rs => rs.some(([lo, hi]) => V >= lo && V <= hi));
    }
    if (f.fpu) test('FPU', p.fpu, v => v !== 'none');
    return { ok: fail.length === 0, unknown, fail };
  }

  function filterParts(parts, f) {
    const tokens = String(f.q || '').toLowerCase().split(/\s+/).filter(Boolean);
    const out = [];
    for (const p of parts) {
      if (f.lines && f.lines.length && !f.lines.includes(p.line)) continue;
      if (f.pkg && f.pkg.length && !f.pkg.includes(pkgType(p.package))) continue;
      if (tokens.length) { const h = haystack(p); if (!tokens.every(t => h.includes(t))) continue; }
      const r = evaluate(p, f);
      if (!r.ok) continue;
      if (r.unknown.length && !f.unknown) continue;
      out.push({ part: p, unknown: r.unknown });
    }
    return out;
  }

  const naturalCmp = (a, b) => String(a).localeCompare(String(b), 'en', { numeric: true });

  function sortRows(rows, key, dir) {
    const f = FIELD[key] || FIELD.id;
    const d = dir === 'desc' ? -1 : 1;
    return [...rows].sort((A, B) => {
      const a = raw(A.part, f), b = raw(B.part, f);
      if (!known(a) && !known(b)) return naturalCmp(A.part.id, B.part.id);
      if (!known(a)) return 1;
      if (!known(b)) return -1;
      const c = typeof a === 'number' && typeof b === 'number' ? a - b : naturalCmp(a, b);
      return c * d || naturalCmp(A.part.id, B.part.id);
    });
  }

  /* Compare helpers: for a numeric field, which indices hold the best value. */
  function bestIndices(parts, key) {
    const f = FIELD[key]; if (!f || !f.better) return [];
    const vals = parts.map(p => raw(p, f));
    const nums = vals.filter(v => typeof v === 'number');
    if (nums.length < 2 || new Set(nums).size < 2) return [];
    const best = f.better === 'high' ? Math.max(...nums) : Math.min(...nums);
    return vals.map((v, i) => (v === best ? i : -1)).filter(i => i >= 0);
  }
  function rowDiffers(parts, key) {
    const vals = parts.map(p => JSON.stringify(display(p, key)));
    return new Set(vals).size > 1;
  }
  function featureDiffers(parts, key) {
    return new Set(parts.map(p => String(p.features ? p.features[key] : null))).size > 1;
  }

  /* URL hash state <-> filters (compact). */
  function filtersToParams(f) {
    const q = new URLSearchParams();
    if (f.q) q.set('q', f.q);
    if (f.lines.length) q.set('line', f.lines.join(','));
    if (f.pkg.length) q.set('pkg', f.pkg.join(','));
    for (const [k, v] of Object.entries(f.min)) if (known(v)) q.set('min_' + k, v);
    if (known(f.maxPins)) q.set('maxpins', f.maxPins);
    if (known(f.volt)) q.set('v', f.volt);
    const yes = Object.keys(f.feat).filter(k => f.feat[k] === 'yes');
    const no = Object.keys(f.feat).filter(k => f.feat[k] === 'no');
    if (yes.length) q.set('has', yes.join(','));
    if (no.length) q.set('not', no.join(','));
    if (f.fpu) q.set('fpu', '1');
    if (!f.unknown) q.set('strict', '1');
    return q;
  }
  function paramsToFilters(q) {
    const f = emptyFilters();
    const list = k => (q.get(k) || '').split(',').filter(Boolean);
    f.q = q.get('q') || '';
    f.lines = list('line').filter(l => LINES[l]);
    f.pkg = list('pkg').filter(t => PKG_TYPES.includes(t));
    for (const k of Object.keys(MIN_FILTERS)) if (q.has('min_' + k)) f.min[k] = q.get('min_' + k);
    f.maxPins = q.get('maxpins') || '';
    f.volt = q.get('v') || '';
    for (const k of list('has')) if (FEATURES[k]) f.feat[k] = 'yes';
    for (const k of list('not')) if (FEATURES[k]) f.feat[k] = 'no';
    f.fpu = q.get('fpu') === '1';
    f.unknown = q.get('strict') !== '1';
    return f;
  }
  function activeFilterCount(f) {
    return (f.q ? 1 : 0) + f.lines.length + f.pkg.length + Object.values(f.min).filter(known).length
      + (known(f.maxPins) ? 1 : 0) + (known(f.volt) ? 1 : 0) + Object.values(f.feat).filter(v => v === 'yes' || v === 'no').length + (f.fpu ? 1 : 0);
  }

  function csv(parts) {
    const cols = FIELDS.map(f => f.key);
    const fk = Object.keys(FEATURES);
    const head = [...FIELDS.map(f => f.label), ...fk.map(k => FEATURES[k][0]), 'Notes', 'Sources'];
    const esc = v => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
    const rows = parts.map(p => [
      ...cols.map(k => display(p, k) ?? ''),
      ...fk.map(k => p.features && p.features[k] === true ? 'yes' : p.features && p.features[k] === false ? 'no' : ''),
      (p.notes || []).join(' | '),
      (p.sources || []).map(s => s.url).join(' '),
    ]);
    return '﻿' + [head, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
  }

  const api = {
    known, LINES, FEATURES, FEATURE_GROUPS, FIELDS, FIELD, FIELD_GROUPS, COLUMNS, MIN_FILTERS, PKG_TYPES,
    pkgType, emptyFilters, supplyRanges, evaluate, filterParts, sortRows, bestIndices, rowDiffers, featureDiffers,
    display, raw, filtersToParams, paramsToFilters, activeFilterCount, csv, naturalCmp,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WCHLogic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
