const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/patientController');
const {
  validatePatientInput,
  validateStatusUpdate,
  validatePatientId
} = require('../middleware/validation');

// Specific endpoints first to avoid parameterized route collision
router.get('/patients/due-today', getDueToday);
router.get('/patients', getAllPatients);
router.post('/patients', validatePatientInput, createPatient);

// Status and draft management
router.patch('/patients/:id/status', validatePatientId, validateStatusUpdate, updatePatientStatus);
router.post('/patients/:id/generate-draft', validatePatientId, generateDraft);
router.patch('/patients/:id/draft', validatePatientId, editDraft);
router.post('/patients/:id/approve', validatePatientId, approveDraft);
router.post('/patients/:id/reject', validatePatientId, rejectDraft);

// Operational helpers
router.get('/stats', getStats);
router.post('/seed', resetAndSeed);

module.exports = router;
