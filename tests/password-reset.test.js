/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  fingerprintPasswordHash,
  createPasswordResetToken,
  verifyPasswordResetToken,
} = require('../lib/api/services/passwordResetService.ts');

const withJwtSecret = (value, run) => {
  const previous = process.env.JWT_SECRET;
  if (value === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = value;
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  }
};

test('password reset fingerprint depends on the current password hash', () => {
  const first = fingerprintPasswordHash('hash-one');
  const second = fingerprintPasswordHash('hash-two');
  assert.notEqual(first, second);
  assert.equal(first, fingerprintPasswordHash('hash-one'));
});

test('password reset token round-trips user id and fingerprint', () => {
  withJwtSecret('password-reset-test-secret', () => {
    const passwordHash = 'hash-current';
    const token = createPasswordResetToken({ userId: 'user-1', passwordHash });
    assert.ok(token);

    const verified = verifyPasswordResetToken(token);
    assert.equal(verified.ok, true);
    assert.equal(verified.userId, 'user-1');
    assert.equal(verified.fingerprint, fingerprintPasswordHash(passwordHash));

    // A reset (new hash) or reuse after reset no longer matches the bound hash.
    assert.notEqual(verified.fingerprint, fingerprintPasswordHash('hash-after-reset'));
  });
});

test('password reset token is rejected when invalid or when JWT_SECRET is missing', () => {
  withJwtSecret('password-reset-test-secret', () => {
    assert.equal(verifyPasswordResetToken('not-a-jwt').ok, false);
    assert.equal(verifyPasswordResetToken(undefined).ok, false);
  });

  withJwtSecret(undefined, () => {
    assert.equal(createPasswordResetToken({ userId: 'user-1', passwordHash: 'x' }), null);
    assert.equal(verifyPasswordResetToken('anything').ok, false);
  });
});
