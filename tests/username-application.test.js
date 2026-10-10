/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const bcrypt = require('bcryptjs');

const readSource = relativePath => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

test('student signup ignores username and stores only supported identity fields', async () => {
  const dbServicePath = require.resolve('../database/services/dbService');
  const controllerPath = require.resolve('../lib/api/controllers/authController');
  const originalDbService = require(dbServicePath);
  const originalController = require.cache[controllerPath];
  let authRequest;
  let storedProfile;
  let loginPasswordHash;
  const loginUser = {
    id: 'student-1',
    email: 'student@example.test',
    metadata_json: JSON.stringify({
      user_metadata: { name: 'Student Example', role: 'student', username: 'legacy-name' },
      app_metadata: {},
    }),
  };

  require.cache[dbServicePath].exports = {
    ...originalDbService,
    getDatabaseClient: () => ({
      execute: async () => ({
        rows: [{ ...loginUser, password_hash: loginPasswordHash }],
      }),
    }),
    getAuthService: () => ({
      auth: {
        admin: {
          createUser: async request => {
            authRequest = request;
            return { data: { user: { id: 'student-1', user_metadata: request.user_metadata } }, error: null };
          },
        },
      },
    }),
    writePortalData: async (key, value) => {
      storedProfile = { key, value };
    },
  };
  delete require.cache[controllerPath];

  try {
    const { login, signup, studentSignup } = require(controllerPath);
    const requestBody = {
      email: 'student@example.test',
      password: 'secret',
      name: 'Student Example',
      username: 'unused-name',
      prn: 'PRN-123',
      cohortId: 'cohort-1',
      role: 'student',
    };
    const makeResponse = () => ({
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    });

    const studentResponse = makeResponse();
    await studentSignup({ body: requestBody }, studentResponse);

    assert.equal(studentResponse.statusCode, 200);
    assert.equal(authRequest.user_metadata.prn, 'PRN-123');
    assert.equal(storedProfile.key, 'student_profile:student@example.test');
    assert.equal(storedProfile.value.prn, 'PRN-123');
    assert.equal(Object.hasOwn(authRequest.user_metadata, 'username'), false);
    assert.equal(Object.hasOwn(storedProfile.value, 'username'), false);

    const signupResponse = makeResponse();
    await signup({ body: requestBody }, signupResponse);

    assert.equal(signupResponse.statusCode, 200);
    assert.equal(Object.hasOwn(authRequest.user_metadata, 'username'), false);

    const originalJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'application-test-secret';
    try {
      loginPasswordHash = await bcrypt.hash('secret', 4);
      const loginResponse = makeResponse();
      await login({ body: { email: loginUser.email, password: 'secret' } }, loginResponse);

      assert.equal(loginResponse.statusCode, 200);
      assert.equal(Object.hasOwn(loginResponse.body.user.user_metadata, 'username'), false);
    } finally {
      if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = originalJwtSecret;
    }
  } finally {
    delete require.cache[controllerPath];
    if (originalController) require.cache[controllerPath] = originalController;
    require.cache[dbServicePath].exports = originalDbService;
  }
});

test('signup UI and profile services do not expose or resolve usernames', () => {
  const signup = readSource('components/StudentSignup.tsx');
  const studentController = readSource('lib/api/controllers/studentController.js');
  const relationalDataService = readSource('database/services/relationalDataService.js');
  const dbService = readSource('database/services/dbService.js');

  assert.doesNotMatch(signup, /\busername\b/i);
  assert.doesNotMatch(studentController, /\busername\b/i);
  assert.doesNotMatch(relationalDataService, /(?:SELECT|INSERT|UPDATE|DELETE)[^'"\n]*\busernames\b/i);
  assert.doesNotMatch(dbService, /(?:SELECT|INSERT|UPDATE|DELETE)[^'"\n]*\busernames\b/i);
});
