const Database = require('better-sqlite3');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../../epia_patients.db');
const db = new Database(dbPath);

// Enable Write-Ahead Logging for better concurrency & performance
db.pragma('journal_mode = WAL');

// Initialize schema
function initDatabase() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      consultation_date TEXT NOT NULL,       -- format: YYYY-MM-DD
      next_follow_up_date TEXT NOT NULL,     -- format: YYYY-MM-DD
      follow_up_status TEXT DEFAULT 'pending', -- 'pending' | 'completed'
      ai_draft_message TEXT,
      approval_status TEXT DEFAULT 'pending',   -- 'pending' | 'approved' | 'rejected'
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_next_follow_up_date 
    ON patients(next_follow_up_date);

    CREATE INDEX IF NOT EXISTS idx_follow_up_status 
    ON patients(follow_up_status);
  `;

  db.exec(createTableQuery);

  // Check if initial seeding is needed
  const countRow = db.prepare('SELECT COUNT(*) as count FROM patients').get();
  if (countRow.count === 0) {
    seedInitialData();
  }
}

// Helper to get formatted date string (YYYY-MM-DD)
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Seed fictional patients for immediate evaluation
function seedInitialData() {
  const today = new Date();

  // Consultation was 7 days ago
  const consultationPast = new Date(today);
  consultationPast.setDate(today.getDate() - 7);

  // Today's date
  const todayStr = formatDate(today);
  const pastConsultStr = formatDate(consultationPast);

  // Future date (+3 days)
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + 3);
  const futureDateStr = formatDate(futureDate);

  // Past follow-up (-3 days)
  const pastFollowUp = new Date(today);
  pastFollowUp.setDate(today.getDate() - 3);
  const pastFollowUpStr = formatDate(pastFollowUp);

  const initialPatients = [
    {
      name: 'Ananya Sharma',
      phone: '+91-9876543210',
      consultation_date: pastConsultStr,
      next_follow_up_date: todayStr,
      follow_up_status: 'pending',
      ai_draft_message: null,
      approval_status: 'pending',
    },
    {
      name: 'Priya Mukherjee',
      phone: '+91-9123456789',
      consultation_date: pastConsultStr,
      next_follow_up_date: todayStr,
      follow_up_status: 'pending',
      ai_draft_message: null,
      approval_status: 'pending',
    },
    {
      name: 'Rohan Mehra',
      phone: '+91-9988776655',
      consultation_date: pastConsultStr,
      next_follow_up_date: todayStr,
      follow_up_status: 'pending',
      ai_draft_message: null,
      approval_status: 'pending',
    },
    {
      name: 'Sneha Patel',
      phone: '+91-9811223344',
      consultation_date: pastConsultStr,
      next_follow_up_date: futureDateStr,
      follow_up_status: 'pending',
      ai_draft_message: null,
      approval_status: 'pending',
    },
    {
      name: 'Vikram Sengupta',
      phone: '+91-9744556677',
      consultation_date: pastFollowUpStr,
      next_follow_up_date: pastFollowUpStr,
      follow_up_status: 'completed',
      ai_draft_message: 'Hi Vikram, following up on your consultation. We are pleased to hear your recovery is progressing smoothly. Let us know if you need any assistance.',
      approval_status: 'approved',
    }
  ];

  const insert = db.prepare(`
    INSERT INTO patients (name, phone, consultation_date, next_follow_up_date, follow_up_status, ai_draft_message, approval_status)
    VALUES (@name, @phone, @consultation_date, @next_follow_up_date, @follow_up_status, @ai_draft_message, @approval_status)
  `);

  const insertMany = db.transaction((patients) => {
    for (const p of patients) insert.run(p);
  });

  insertMany(initialPatients);
  console.log(`[Database] Initialized and seeded with ${initialPatients.length} sample fictional patients.`);
}

module.exports = {
  db,
  initDatabase,
  seedInitialData,
  formatDate
};
