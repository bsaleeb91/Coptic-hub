// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvField, toCsv } from './csv.ts';

test('quotes every field and doubles inner quotes', () => {
  assert.equal(csvField('plain'), '"plain"');
  assert.equal(csvField('he said "hi"'), '"he said ""hi"""');
  assert.equal(csvField('a, b\nc'), '"a, b\nc"');
});

test('empty values become empty fields', () => {
  assert.equal(csvField(null), '""');
  assert.equal(csvField(undefined), '""');
  assert.equal(csvField(false), '"false"');
  assert.equal(csvField(0), '"0"');
});

test('text that a spreadsheet would run as a formula is kept as text', () => {
  assert.equal(csvField('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvField('+1 more'), `"'+1 more"`);
  assert.equal(csvField('-'), `"'-"`);
  assert.equal(csvField('@me'), `"'@me"`);
  assert.equal(csvField('a = b'), '"a = b"');
});

test('rows are joined with CRLF after the header', () => {
  assert.equal(toCsv(['a', 'b'], [[1, 'x'], [2, null]]), '"a","b"\r\n"1","x"\r\n"2",""');
});
