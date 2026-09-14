// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyCiphertext, needsRewrap } from './crypto-format.ts';

test('recognizes the recoverable keypair scheme', () => {
  assert.equal(classifyCiphertext('box1:abc'), 'box');
  assert.equal(needsRewrap('box1:abc'), false);
});

test('recognizes legacy device-key notes and marks them for rewrap', () => {
  assert.equal(classifyCiphertext('enc1:abc'), 'legacy');
  assert.equal(needsRewrap('enc1:abc'), true);
});

test('treats pre-encryption and demo rows as plaintext', () => {
  assert.equal(classifyCiphertext('Met with him after liturgy.'), 'plaintext');
  assert.equal(needsRewrap('Met with him after liturgy.'), false);
});

// A note whose body merely mentions a prefix must not be mistaken for
// ciphertext — only a leading prefix counts.
test('only a leading prefix counts', () => {
  assert.equal(classifyCiphertext('he said enc1: was the old format'), 'plaintext');
  assert.equal(classifyCiphertext(' box1:abc'), 'plaintext');
});

test('malformed values read as plaintext rather than throwing', () => {
  assert.equal(classifyCiphertext(''), 'plaintext');
  assert.equal(classifyCiphertext(null), 'plaintext');
  assert.equal(classifyCiphertext(undefined), 'plaintext');
  assert.equal(classifyCiphertext(42), 'plaintext');
  assert.equal(classifyCiphertext({}), 'plaintext');
  assert.equal(needsRewrap(null), false);
});
