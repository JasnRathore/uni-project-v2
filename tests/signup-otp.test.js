/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');
const { ensureDatabaseSchema } = require('../database/services/schemaService.ts');

const schema = fs.readFileSync(path.join(__dirname, '..', 'new_schema.sql'), 'utf8');

test('schema stores signup OTP hashes and email verification state', () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS signup_otps/);
  assert.match(schema, /otp_hash\s+TEXT NOT NULL/);
  assert.match(schema, /attempts\s+INTEGER NOT NULL DEFAULT 0/);
  assert.match(schema, /expires_at\s+TEXT NOT NULL/);
  assert.match(schema, /consumed_at\s+TEXT/);
  assert.match(schema, /email_verified_at\s+TEXT/);
  assert.match(schema, /idx_signup_otps_email/);
});

test('signup OTP lifecycle is database-backed, expiring, and single-use', async () => {
  const db = createClient({ url: 'file::memory:' });
  const dbServicePath = require.resolve('../database/services/dbService.ts');
  const servicePath = require.resolve('../lib/api/services/signupOtpService.ts');
  const originalDbService = require(dbServicePath);
  const originalService = require.cache[servicePath];

  try {
    await ensureDatabaseSchema(db);

    const userColumns = (await db.execute('PRAGMA table_info("users")')).rows.map(row => row.name);
    assert(userColumns.includes('email_verified_at'));

    require.cache[dbServicePath].exports = {
      ...originalDbService,
      getDatabaseClient: () => db,
    };
    delete require.cache[servicePath];
    const {
      generateOtp,
      requestSignupOtp,
      consumeSignupOtp,
      cancelSignupOtp,
      OTP_MAX_ATTEMPTS,
    } = require(servicePath);

    for (let index = 0; index < 20; index += 1) {
      assert.match(generateOtp(), /^\d{6}$/);
    }

    const requested = await requestSignupOtp({ email: 'Signup@Example.test ', role: 'teacher' });
    assert.equal(requested.ok, true);
    assert.match(requested.otp, /^\d{6}$/);

    const stored = (await db.execute('SELECT email, otp_hash, role FROM signup_otps')).rows[0];
    assert.equal(stored.email, 'signup@example.test');
    assert.equal(stored.role, 'teacher');
    assert.notEqual(stored.otp_hash, requested.otp);
    assert.equal(await bcrypt.compare(requested.otp, stored.otp_hash), true);

    const throttled = await requestSignupOtp({ email: 'signup@example.test', role: 'teacher' });
    assert.equal(throttled.ok, false);
    assert.equal(throttled.status, 429);

    const wrong = await consumeSignupOtp({ email: 'signup@example.test', otp: '000000', role: 'teacher' });
    assert.equal(wrong.ok, false);
    assert.equal(wrong.status, 400);
    assert.equal(Number((await db.execute('SELECT attempts FROM signup_otps')).rows[0].attempts), 1);

    const wrongRole = await consumeSignupOtp({ email: 'signup@example.test', otp: requested.otp, role: 'student' });
    assert.equal(wrongRole.ok, false);

    const consumed = await consumeSignupOtp({ email: 'signup@example.test', otp: requested.otp, role: 'teacher' });
    assert.equal(consumed.ok, true);

    const replay = await consumeSignupOtp({ email: 'signup@example.test', otp: requested.otp, role: 'teacher' });
    assert.equal(replay.ok, false);

    const expiredCode = '123456';
    await db.execute({
      sql: `INSERT INTO signup_otps (id, email, role, otp_hash, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        'expired-otp',
        'expired@example.test',
        'student',
        await bcrypt.hash(expiredCode, 4),
        new Date(Date.now() - 1000).toISOString(),
        new Date(Date.now() - 11 * 60 * 1000).toISOString(),
      ],
    });
    const expired = await consumeSignupOtp({ email: 'expired@example.test', otp: expiredCode, role: 'student' });
    assert.equal(expired.ok, false);
    assert.match(expired.error, /expired/i);
    assert.equal(Number((await db.execute("SELECT COUNT(*) AS count FROM signup_otps WHERE id = 'expired-otp'")).rows[0].count), 0);

    const attemptsCode = '654321';
    await db.execute({
      sql: `INSERT INTO signup_otps (id, email, role, otp_hash, attempts, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'attempts-otp',
        'attempts@example.test',
        'teacher',
        await bcrypt.hash(attemptsCode, 4),
        OTP_MAX_ATTEMPTS,
        new Date(Date.now() + 60_000).toISOString(),
        new Date().toISOString(),
      ],
    });
    const locked = await consumeSignupOtp({ email: 'attempts@example.test', otp: attemptsCode, role: 'teacher' });
    assert.equal(locked.ok, false);
    assert.equal(locked.status, 429);

    const cancelledRun = await requestSignupOtp({ email: 'cancel@example.test', role: 'student' });
    assert.equal(cancelledRun.ok, true);
    await cancelSignupOtp('cancel@example.test');
    const afterCancel = await consumeSignupOtp({ email: 'cancel@example.test', otp: cancelledRun.otp, role: 'student' });
    assert.equal(afterCancel.ok, false);
  } finally {
    delete require.cache[servicePath];
    if (originalService) require.cache[servicePath] = originalService;
    require.cache[dbServicePath].exports = originalDbService;
    await db.close();
  }
});