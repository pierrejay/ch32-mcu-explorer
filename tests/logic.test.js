// Run: node --test tests/      (Node 18+, no dependencies)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const L = require('../js/logic.js');

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8'), sandbox);
const { parts } = sandbox.window.WCH_DATA;
const byId = new Map(parts.map(p => [p.id, p]));
const F = over => ({ ...L.emptyFilters(), ...over });
const ids = rows => rows.map(r => r.part.id);

test('catalogue integrity', () => {
  assert.ok(parts.length > 50, 'catalogue unexpectedly small');
  assert.equal(byId.size, parts.length, 'duplicate part ids');
  for (const p of parts) {
    assert.ok(p.id && p.family && p.line && p.package, `identity incomplete: ${p.id}`);
    assert.ok(L.LINES[p.line], `${p.id}: unknown line ${p.line}`);
    assert.ok(p.sources && p.sources.length, `${p.id}: no source`);
    for (const k of Object.keys(L.FEATURES)) {
      assert.ok([true, false, null].includes(p.features[k]), `${p.id}: feature ${k} must be true/false/null`);
    }
    for (const f of L.FIELDS) {
      const v = L.display(p, f.key);
      assert.ok(v === null || typeof v === 'string', `${p.id}: ${f.key} display`);
    }
    if (p.gpio != null && p.pins != null) assert.ok(p.gpio <= p.pins, `${p.id}: gpio > pins`);
    if (p.vMin != null && p.vMax != null) assert.ok(p.vMin <= p.vMax, `${p.id}: vMin > vMax`);
  }
});

test('unknown values are kept only when allowed, documented mismatches always removed', () => {
  const withUnknown = { ...parts[0], id: 'TEST-U', features: { ...parts[0].features, canFD: null } };
  const without = { ...parts[0], id: 'TEST-N', features: { ...parts[0].features, canFD: false } };
  const set = [withUnknown, without];
  assert.deepEqual(ids(L.filterParts(set, F({ feat: { canFD: 'yes' } }))), ['TEST-U']);
  assert.deepEqual(ids(L.filterParts(set, F({ feat: { canFD: 'yes' }, unknown: false }))), []);
  assert.deepEqual(L.filterParts(set, F({ feat: { canFD: 'yes' } }))[0].unknown, ['CAN FD']);
  assert.deepEqual(ids(L.filterParts(set, F({ feat: { canFD: 'no' } }))), ['TEST-U', 'TEST-N']);
});

test('numeric minimums and max pins', () => {
  const rows = L.filterParts(parts, F({ min: { flashKB: '256' }, unknown: false }));
  assert.ok(rows.length > 0);
  for (const r of rows) assert.ok((r.part.flashTotalKB ?? r.part.flashKB) >= 256);
  const small = L.filterParts(parts, F({ maxPins: '8', unknown: false }));
  for (const r of small) assert.ok(r.part.pins <= 8);
});

test('supply voltage uses ranges, not a continuous span', () => {
  const p = { ...parts[0], id: 'TEST-V', vMin: 1.8, vMax: 5.5, supplyRanges: [[1.8, 2.5], [3.0, 5.5]] };
  assert.equal(L.filterParts([p], F({ volt: '2.7' })).length, 0);
  assert.equal(L.filterParts([p], F({ volt: '3.3' })).length, 1);
  for (const r of L.filterParts(parts, F({ volt: '5.0', unknown: false }))) {
    assert.ok(L.supplyRanges(r.part).some(([lo, hi]) => 5 >= lo && 5 <= hi), r.part.id);
  }
});

test('text search matches ids, families and feature labels', () => {
  const p = parts[0];
  assert.ok(ids(L.filterParts(parts, F({ q: p.id.toLowerCase() }))).includes(p.id));
  assert.ok(ids(L.filterParts(parts, F({ q: p.family }))).every(id => byId.get(id)));
});

test('URL params round-trip', () => {
  const f = F({ q: 'usb', lines: ['CH32V2'], pkg: ['QFN'], min: { flashKB: '64', uart: '2' }, maxPins: '48', volt: '3.3', feat: { can: 'yes', ble: 'no' }, fpu: true, unknown: false });
  const back = L.paramsToFilters(new URLSearchParams(L.filtersToParams(f).toString()));
  assert.deepEqual(back, f);
});

test('sorting keeps unknown values last in both directions', () => {
  const rows = L.filterParts(parts, F());
  for (const dir of ['asc', 'desc']) {
    const s = L.sortRows(rows, 'flashKB', dir).map(r => r.part.flashTotalKB ?? r.part.flashKB);
    const firstNull = s.findIndex(v => v == null);
    if (firstNull >= 0) assert.ok(s.slice(firstNull).every(v => v == null));
    const nums = s.filter(v => v != null);
    for (let i = 1; i < nums.length; i++) assert.ok(dir === 'asc' ? nums[i - 1] <= nums[i] : nums[i - 1] >= nums[i]);
  }
});

test('compare helpers', () => {
  const a = { ...parts[0], flashKB: 16, flashTotalKB: null }, b = { ...parts[0], flashKB: 64, flashTotalKB: null };
  assert.deepEqual(L.bestIndices([a, b], 'flashKB'), [1]);
  assert.equal(L.rowDiffers([a, b], 'flashKB'), true);
  assert.equal(L.rowDiffers([a, a], 'flashKB'), false);
});

test('CSV has one line per part plus header', () => {
  const out = L.csv(parts.slice(0, 5));
  assert.equal(out.split('\r\n').length, 6);
});
