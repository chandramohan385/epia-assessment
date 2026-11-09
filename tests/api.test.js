const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const app = require('../src/app');
const { initDatabase, db, formatDate } = require('../src/config/database');

let server;
let baseUrl;

before(async () => {
  // Ensure DB is initialized
  initDatabase();

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
});

describe('EPIA Patient Follow-up API Tests', () => {

  test('GET /health returns healthy status', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'healthy');
  });

  describe('Task 1: Patient CRUD & Validation', () => {
    test('POST /api/patients fails when required fields are missing', async () => {
      const res = await fetch(`${baseUrl}/api/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Incomplete' })
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.details.length > 0);
    });

    test('POST /api/patients fails on invalid date format', async () => {
      const res = await fetch(`${baseUrl}/api/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Invalid Date',
          phone: '+91-9876543210',
          consultation_date: '02-11-2026',
          next_follow_up_date: '2026-11-09'
        })
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
    });

    test('POST /api/patients successfully creates a patient', async () => {
      const todayStr = formatDate(new Date());
      const res = await fetch(`${baseUrl}/api/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Aarav Patel',
          phone: '+91-9988776655',
          consultation_date: todayStr,
          next_follow_up_date: todayStr
        })
      });

      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.name, 'Aarav Patel');
      assert.strictEqual(json.data.follow_up_status, 'pending');
      assert.strictEqual(json.data.approval_status, 'pending');
    });

    test('GET /api/patients returns list of patients', async () => {
      const res = await fetch(`${baseUrl}/api/patients`);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(Array.isArray(json.data));
      assert.ok(json.count >= 1);
    });

    test('GET /api/patients/due-today returns patients due for target date', async () => {
      const todayStr = formatDate(new Date());
      const res = await fetch(`${baseUrl}/api/patients/due-today?date=${todayStr}`);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(Array.isArray(json.data));
      // All returned records must be due today and pending
      for (const p of json.data) {
        assert.strictEqual(p.next_follow_up_date, todayStr);
        assert.strictEqual(p.follow_up_status, 'pending');
      }
    });

    test('PATCH /api/patients/:id/status marks follow_up_status as completed', async () => {
      // First create a patient
      const todayStr = formatDate(new Date());
      const createRes = await fetch(`${baseUrl}/api/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Kavita Roy',
          phone: '+91-9876500000',
          consultation_date: todayStr,
          next_follow_up_date: todayStr
        })
      });
      const created = await createRes.json();
      const patientId = created.data.id;

      // Now update status
      const patchRes = await fetch(`${baseUrl}/api/patients/${patientId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ follow_up_status: 'completed' })
      });
      assert.strictEqual(patchRes.status, 200);
      const patched = await patchRes.json();
      assert.strictEqual(patched.data.follow_up_status, 'completed');
    });
  });

  describe('Task 2: AI Automation & Human Review', () => {
    let testPatientId;

    before(async () => {
      const todayStr = formatDate(new Date());
      const createRes = await fetch(`${baseUrl}/api/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Nisha Verma',
          phone: '+91-9871122334',
          consultation_date: todayStr,
          next_follow_up_date: todayStr
        })
      });
      const data = await createRes.json();
      testPatientId = data.data.id;
    });

    test('POST /api/patients/:id/generate-draft creates personalized WhatsApp message', async () => {
      const res = await fetch(`${baseUrl}/api/patients/${testPatientId}/generate-draft`, {
        method: 'POST'
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(json.data.ai_draft_message);
      assert.ok(json.data.ai_draft_message.includes('Nisha Verma'));
      assert.ok(json.provider);
      assert.strictEqual(json.data.approval_status, 'pending');
    });

    test('PATCH /api/patients/:id/draft allows staff to edit the draft', async () => {
      const customDraft = 'Hello Nisha, Dr. EPIA is looking forward to seeing you this afternoon!';
      const res = await fetch(`${baseUrl}/api/patients/${testPatientId}/draft`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft_message: customDraft })
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.ai_draft_message, customDraft);
    });

    test('POST /api/patients/:id/approve marks approval as approved and follow_up as completed', async () => {
      const res = await fetch(`${baseUrl}/api/patients/${testPatientId}/approve`, {
        method: 'POST'
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.approval_status, 'approved');
      assert.strictEqual(json.data.follow_up_status, 'completed');
    });
  });

  describe('Error Handling', () => {
    test('Returns 404 for unknown endpoints', async () => {
      const res = await fetch(`${baseUrl}/api/unknown-endpoint`);
      assert.strictEqual(res.status, 404);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.ok(json.error.includes('Endpoint not found'));
    });

    test('Returns 400 for non-integer patient IDs', async () => {
      const res = await fetch(`${baseUrl}/api/patients/notanid/status`, {
        method: 'PATCH'
      });
      assert.strictEqual(res.status, 400);
    });
  });
});
