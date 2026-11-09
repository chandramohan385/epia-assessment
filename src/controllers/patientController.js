const { db, formatDate, seedInitialData } = require('../config/database');
const { generateFollowUpDraft } = require('../services/aiService');

/**
 * 1. POST /api/patients
 * Adds a new patient record
 */
function createPatient(req, res, next) {
  try {
    const { name, phone, consultation_date, next_follow_up_date } = req.body;

    const query = `
      INSERT INTO patients (name, phone, consultation_date, next_follow_up_date, follow_up_status, approval_status)
      VALUES (?, ?, ?, ?, 'pending', 'pending')
    `;

    const result = db.prepare(query).run(name, phone, consultation_date, next_follow_up_date);
    const newPatient = db.prepare('SELECT * FROM patients WHERE id = ?').get(result.lastInsertRowid);

    return res.status(201).json({
      success: true,
      message: 'Patient registered successfully.',
      data: newPatient
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 2. GET /api/patients
 * Retrieves all patients (with optional query filters: status, search)
 */
function getAllPatients(req, res, next) {
  try {
    const { status, search } = req.query;

    let query = 'SELECT * FROM patients WHERE 1=1';
    const params = [];

    if (status && ['pending', 'completed'].includes(status)) {
      query += ' AND follow_up_status = ?';
      params.push(status);
    }

    if (search && search.trim() !== '') {
      query += ' AND (name LIKE ? OR phone LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    query += ' ORDER BY next_follow_up_date ASC, id DESC';

    const patients = db.prepare(query).all(...params);

    return res.status(200).json({
      success: true,
      count: patients.length,
      data: patients
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 3. GET /api/patients/due-today
 * Retrieves patients whose follow-up is due today and follow_up_status = 'pending'
 * (Supports optional ?date=YYYY-MM-DD query parameter for testing flexibility)
 */
function getDueToday(req, res, next) {
  try {
    const targetDate = req.query.date || formatDate(new Date());

    const query = `
      SELECT * FROM patients 
      WHERE next_follow_up_date = ? 
        AND follow_up_status = 'pending'
      ORDER BY id ASC
    `;

    const duePatients = db.prepare(query).all(targetDate);

    return res.status(200).json({
      success: true,
      target_date: targetDate,
      count: duePatients.length,
      data: duePatients
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 4. PATCH /api/patients/:id/status
 * Updates a patient's follow_up_status to 'completed' (or as specified)
 */
function updatePatientStatus(req, res, next) {
  try {
    const { id } = req.params;
    const follow_up_status = req.body.follow_up_status || 'completed';

    const existing = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: `Patient with ID ${id} not found.`
      });
    }

    const updateQuery = `
      UPDATE patients 
      SET follow_up_status = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `;

    db.prepare(updateQuery).run(follow_up_status, id);
    const updatedPatient = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);

    return res.status(200).json({
      success: true,
      message: `Patient follow-up status updated to "${follow_up_status}".`,
      data: updatedPatient
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 5. POST /api/patients/:id/generate-draft
 * Triggers LLM / Mock draft generation for the patient
 */
async function generateDraft(req, res, next) {
  try {
    const { id } = req.params;
    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: `Patient with ID ${id} not found.`
      });
    }

    const { draft, provider, prompt } = await generateFollowUpDraft(
      patient.name,
      patient.consultation_date
    );

    const updateQuery = `
      UPDATE patients 
      SET ai_draft_message = ?,
          approval_status = 'pending',
          updated_at = datetime('now')
      WHERE id = ?
    `;

    db.prepare(updateQuery).run(draft, id);
    const updatedPatient = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);

    return res.status(200).json({
      success: true,
      message: 'AI WhatsApp follow-up draft generated successfully.',
      provider,
      prompt,
      data: updatedPatient
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 6. PATCH /api/patients/:id/draft
 * Staff edits the draft message text
 */
function editDraft(req, res, next) {
  try {
    const { id } = req.params;
    const { draft_message } = req.body;

    if (!draft_message || typeof draft_message !== 'string' || draft_message.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Field "draft_message" is required and cannot be empty.'
      });
    }

    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
    if (!patient) {
      return res.status(404).json({
        success: false,
        error: `Patient with ID ${id} not found.`
      });
    }

    db.prepare(`
      UPDATE patients 
      SET ai_draft_message = ?, 
          updated_at = datetime('now')
      WHERE id = ?
    `).run(draft_message.trim(), id);

    const updated = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);

    return res.status(200).json({
      success: true,
      message: 'Draft message updated successfully.',
      data: updated
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 7. POST /api/patients/:id/approve
 * Human review approval: Approves draft and marks follow-up as completed
 */
function approveDraft(req, res, next) {
  try {
    const { id } = req.params;
    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: `Patient with ID ${id} not found.`
      });
    }

    if (!patient.ai_draft_message) {
      return res.status(400).json({
        success: false,
        error: 'Cannot approve patient without an existing draft message. Generate a draft first.'
      });
    }

    const updateQuery = `
      UPDATE patients 
      SET approval_status = 'approved',
          follow_up_status = 'completed',
          updated_at = datetime('now')
      WHERE id = ?
    `;

    db.prepare(updateQuery).run(id);
    const updated = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);

    console.log(`[Staff Action] Approved WhatsApp draft for ${patient.name} (${patient.phone}): "${patient.ai_draft_message}"`);

    return res.status(200).json({
      success: true,
      message: 'Draft approved! Follow-up marked as completed (simulated dispatch).',
      data: updated
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 8. POST /api/patients/:id/reject
 * Rejects the current draft
 */
function rejectDraft(req, res, next) {
  try {
    const { id } = req.params;
    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: `Patient with ID ${id} not found.`
      });
    }

    db.prepare(`
      UPDATE patients 
      SET approval_status = 'rejected',
          updated_at = datetime('now')
      WHERE id = ?
    `).run(id);

    const updated = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);

    return res.status(200).json({
      success: true,
      message: 'Draft marked as rejected.',
      data: updated
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 9. GET /api/stats
 * Provides quick dashboard analytics
 */
function getStats(req, res, next) {
  try {
    const todayStr = formatDate(new Date());

    const total = db.prepare('SELECT COUNT(*) as count FROM patients').get().count;
    const dueToday = db.prepare('SELECT COUNT(*) as count FROM patients WHERE next_follow_up_date = ? AND follow_up_status = "pending"').get(todayStr).count;
    const pendingApproval = db.prepare('SELECT COUNT(*) as count FROM patients WHERE ai_draft_message IS NOT NULL AND approval_status = "pending"').get().count;
    const completed = db.prepare('SELECT COUNT(*) as count FROM patients WHERE follow_up_status = "completed"').get().count;

    return res.status(200).json({
      success: true,
      data: {
        total,
        dueToday,
        pendingApproval,
        completed,
        todayDate: todayStr
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 10. POST /api/seed
 * Resets/seeds the database for testing
 */
function resetAndSeed(req, res, next) {
  try {
    db.exec('DELETE FROM patients');
    seedInitialData();
    return res.status(200).json({
      success: true,
      message: 'Database reset and seeded with initial fictional patients.'
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createPatient,
  getAllPatients,
  getDueToday,
  updatePatientStatus,
  generateDraft,
  editDraft,
  approveDraft,
  rejectDraft,
  getStats,
  resetAndSeed
};
