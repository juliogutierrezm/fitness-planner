// Simple API Gateway smoke tests for Fitness Planner
// Usage:
//   node scripts/smoke-api.mjs
// Env vars:
//   API_BASE=https://k2ok2k1ft9.execute-api.us-east-1.amazonaws.com/dev
//   ID_TOKEN=eyJ... (Cognito ID token; optional)
//   TEST_USER_ID=USER-ID (optional)
//   WRITE_TESTS=true (enables POST/PUT/DELETE)

import https from 'https';
import http from 'http';
import fs from 'fs';

const API_BASE = process.env.API_BASE || 'https://k2ok2k1ft9.execute-api.us-east-1.amazonaws.com/dev';
let ID_TOKEN = process.env.ID_TOKEN || '';
const TEST_USER_ID = process.env.TEST_USER_ID || '';
const WRITE = /^true$/i.test(process.env.WRITE_TESTS || '');

function req(method, path, body) {
  return new Promise((resolve) => {
    const url = new URL(path, API_BASE);
    const lib = url.protocol === 'http:' ? http : https;
    const payload = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (ID_TOKEN) headers['Authorization'] = `Bearer ${ID_TOKEN}`;
    const options = { method, headers };
    const start = Date.now();
    const r = lib.request(url, options, (res) => {
      let chunks = '';
      res.on('data', (d) => (chunks += d));
      res.on('end', () => {
        const ms = Date.now() - start;
        let snippet = chunks;
        try {
          const j = JSON.parse(chunks);
          snippet = JSON.stringify(j).slice(0, 300);
        } catch {}
        resolve({ status: res.statusCode || 0, headers: res.headers, timeMs: ms, body: snippet });
      });
    });
    r.on('error', (err) => resolve({ status: 0, headers: {}, timeMs: 0, body: String(err) }));
    if (payload) r.write(payload);
    r.end();
  });
}

async function testEndpoint(name, method, path, body) {
  const res = await req(method, path, body);
  const cors = {
    allowOrigin: res.headers['access-control-allow-origin'] || '',
    allowMethods: res.headers['access-control-allow-methods'] || '',
  };
  console.log(`${name} ${method} ${path} -> ${res.status} (${res.timeMs}ms) CORS: ${cors.allowOrigin} ${cors.allowMethods}`);
  console.log(`  Body: ${res.body}`);
  return res.status;
}

async function main() {
  console.log(`API_BASE=${API_BASE}`);
  if (!ID_TOKEN) {
    try {
      const raw = fs.readFileSync('.auth.json', 'utf8');
      const json = JSON.parse(raw);
      ID_TOKEN = json.access_token || json.id_token || '';
    } catch {}
  }
  console.log(`ID_TOKEN=${ID_TOKEN ? '[provided]' : '[none]'}`);
  console.log(`WRITE_TESTS=${WRITE}`);

  // Public OPTIONS checks for CORS
  await testEndpoint('CORS', 'OPTIONS', '/users');
  await testEndpoint('CORS', 'OPTIONS', '/workoutPlans');

  // Auth-protected GETs
  await testEndpoint('Users list', 'GET', '/users');
  if (TEST_USER_ID) {
    await testEndpoint('User by id', 'GET', `/users/${encodeURIComponent(TEST_USER_ID)}`);
    await testEndpoint('Plans by user (nested)', 'GET', `/users/${encodeURIComponent(TEST_USER_ID)}/plan`);
    await testEndpoint('Plans by user (query)', 'GET', `/workoutPlans?userId=${encodeURIComponent(TEST_USER_ID)}`);
  }

  await testEndpoint('Plans by trainer', 'GET', '/workoutPlans/trainer');
  await testEndpoint('Plans by company', 'GET', '/workoutPlans/company');

  if (!WRITE) {
    console.log('Skipping write tests. Set WRITE_TESTS=true to enable.');
    return;
  }

  // Sample write tests (only if authorized and allowed)
  const now = new Date().toISOString();
  const sampleUser = {
    email: `test+${Date.now()}@example.com`,
    givenName: 'Test',
    familyName: 'User',
    role: 'client'
  };
  await testEndpoint('Create user', 'POST', '/users', sampleUser);

  const samplePlan = {
    planId: `plan-${Date.now()}`,
    name: 'Plan de Prueba',
    date: now,
    sessions: [],
    generalNotes: 'Smoke test'
  };
  await testEndpoint('Create workout plan', 'POST', '/workoutPlans', samplePlan);
}

main().catch((e) => { console.error(e); process.exit(1); });
