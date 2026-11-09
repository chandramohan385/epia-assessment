/**
 * Input validation middleware for patient endpoints
 */

// Helper to validate YYYY-MM-DD date string
function isValidDateString(str) {
  if (typeof str !== 'string') return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(str)) return false;

  const [year, month, day] = str.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

// Helper to validate phone number format
function isValidPhoneNumber(phone) {
  if (typeof phone !== 'string') return false;
  const trimmed = phone.trim();
  // Allow digits, +, -, (), spaces, between 7 and 20 chars
  const regex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,16}$/;
  return regex.test(trimmed);
}

/**
 * Validates payload for creating a patient (POST /api/patients)
 */
function validatePatientInput(req, res, next) {
  const { name, phone, consultation_date, next_follow_up_date } = req.body;
  const errors = [];

  // Name validation
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Field "name" is required and must be at least 2 characters long.');
  } else if (name.trim().length > 100) {
    errors.push('Field "name" cannot exceed 100 characters.');
  }

  // Phone validation
  if (!phone || !isValidPhoneNumber(phone)) {
    errors.push('Field "phone" is required and must be a valid phone number (e.g., +91-9876543210 or +1-555-0199).');
  }

  // Consultation Date validation
  if (!consultation_date || !isValidDateString(consultation_date)) {
    errors.push('Field "consultation_date" is required and must be in YYYY-MM-DD format.');
  }

  // Next Follow-Up Date validation
  if (!next_follow_up_date || !isValidDateString(next_follow_up_date)) {
    errors.push('Field "next_follow_up_date" is required and must be in YYYY-MM-DD format.');
  }

  // Logical date sequence check
  if (
    consultation_date &&
    next_follow_up_date &&
    isValidDateString(consultation_date) &&
    isValidDateString(next_follow_up_date)
  ) {
    if (new Date(next_follow_up_date) < new Date(consultation_date)) {
      errors.push('Field "next_follow_up_date" cannot be earlier than "consultation_date".');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors
    });
  }

  // Clean and sanitize inputs
  req.body.name = name.trim();
  req.body.phone = phone.trim();
  req.body.consultation_date = consultation_date.trim();
  req.body.next_follow_up_date = next_follow_up_date.trim();

  next();
}

/**
 * Validates status update (PATCH /api/patients/:id/status)
 */
function validateStatusUpdate(req, res, next) {
  const { follow_up_status } = req.body;

  // If provided, must be 'pending' or 'completed'
  if (follow_up_status !== undefined) {
    if (!['pending', 'completed'].includes(follow_up_status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid follow_up_status. Must be "pending" or "completed".'
      });
    }
  }

  next();
}

/**
 * Validates patient ID parameter
 */
function validatePatientId(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid patient ID. Must be a positive integer.'
    });
  }
  req.params.id = id;
  next();
}

module.exports = {
  validatePatientInput,
  validateStatusUpdate,
  validatePatientId,
  isValidDateString
};
