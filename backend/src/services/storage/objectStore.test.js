const test = require('node:test');
const assert = require('node:assert/strict');
const { assertObjectKey, shouldCopyStoredObject } = require('./objectStore');

test('对象键拒绝空路径和目录穿越', () => {
  assert.equal(assertObjectKey('bucket/a.png'), 'bucket/a.png');
  assert.equal(assertObjectKey('\\bucket\\a.png'), 'bucket/a.png');
  assert.throws(() => assertObjectKey(''), /非法对象键/);
  assert.throws(() => assertObjectKey('../secret'), /非法对象键/);
  assert.throws(() => assertObjectKey('bucket/../../etc/passwd'), /非法对象键/);
});

test('导入时记录已在、对象缺失才补写', () => {
  assert.equal(shouldCopyStoredObject({
    existing: false,
    strategy: 'skip',
    objectMissing: true,
    hasPackageFile: true,
  }), true);
  assert.equal(shouldCopyStoredObject({
    existing: true,
    strategy: 'skip',
    objectMissing: true,
    hasPackageFile: true,
  }), true);
  assert.equal(shouldCopyStoredObject({
    existing: true,
    strategy: 'skip',
    objectMissing: false,
    hasPackageFile: true,
  }), false);
  assert.equal(shouldCopyStoredObject({
    existing: true,
    strategy: 'overwrite',
    objectMissing: false,
    hasPackageFile: true,
  }), true);
  assert.equal(shouldCopyStoredObject({
    existing: false,
    strategy: 'overwrite',
    objectMissing: true,
    hasPackageFile: false,
  }), false);
});
