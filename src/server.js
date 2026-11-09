const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const { initDatabase } = require('./config/database');

const PORT = process.env.PORT || 3000;

// Initialize database schema and seed data
initDatabase();

app.listen(PORT, () => {
  console.log(`
=====================================================
  EPIA Fertility - Patient Follow-up & AI System
=====================================================
  [Server] Running on: http://localhost:${PORT}
  [Dashboard] Access UI at: http://localhost:${PORT}/
  [API Health] http://localhost:${PORT}/health
  [Database] SQLite (better-sqlite3) ready
  [AI Engine] ${process.env.GEMINI_API_KEY ? 'Google Gemini Enabled' : process.env.OPENAI_API_KEY ? 'OpenAI Enabled' : 'Intelligent Mock Fallback Active (Zero Setup Required)'}
=====================================================
  `);
});
