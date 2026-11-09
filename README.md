# EPIA Patient Follow-up & AI Automation System

A robust, modular Node.js/Express application designed for **EPIA Fertility** care coordinators to track patient consultations, identify due follow-ups, generate empathetic AI-powered WhatsApp messages, and facilitate human review and approval prior to communication dispatch.

---

## 🌟 Key Features

- **Task 1: Backend REST API (60%)**
  - **SQLite Database (`better-sqlite3`)**: High-performance local storage with WAL (Write-Ahead Logging) mode and structured indexing.
  - **Patient Registration**: Add patient records with phone and date validation (`YYYY-MM-DD`).
  - **Due Today Filtering**: Fetch patients due for follow-up today with `pending` status.
  - **Status Updates**: Transition patients seamlessly from `pending` to `completed`.
  - **Robust Error Handling**: Centralized error middleware returning clean JSON responses with HTTP status codes (400, 404, 500).

- **Task 2: AI Automation & Human Review (40%)**
  - **Empathetic Prompt Design**: Crafts concise (< 60 words), warm WhatsApp messages referencing the patient's name and previous consultation date.
  - **Multi-Model Provider Support**: Pluggable integration with **Google Gemini (`gemini-2.5-flash`)** and **OpenAI (`gpt-4o-mini`)**.
  - **Zero-Config Mock Fallback**: If API keys are not supplied, an intelligent mock generator creates warm, personalized messages so evaluators can test the entire workflow immediately without configuring keys.
  - **Human-in-the-Loop Review Dashboard**: Staff can preview the WhatsApp message in a simulated chat bubble, edit wording in real time, and click **"Approve & Mark Sent"** or **"Reject"**. No messages are sent automatically.

---

## 🏗️ Architecture & Technology Stack

```
epia-assessment/
├── src/
│   ├── app.js                   # Express application setup, static files & middleware
│   ├── server.js                # Server entry point & database initialization
│   ├── config/
│   │   └── database.js          # SQLite connection, table schema, indexes & seeder
│   ├── controllers/
│   │   └── patientController.js # Route logic for patients, due follow-ups & AI drafts
│   ├── middleware/
│   │   ├── validation.js        # Strict payload & date validation
│   │   └── errorHandler.js      # 404 & 500 centralized error handling
│   ├── routes/
│   │   └── patientRoutes.js     # REST API route definitions
│   └── services/
│       └── aiService.js         # Gemini / OpenAI API integration + Mock Generator
├── public/                      # Human-in-the-Loop Review Interface
│   ├── index.html               # Staff review and approval dashboard
│   ├── css/
│   │   └── style.css            # Responsive, medical-themed CSS styling
│   └── js/
│       └── app.js               # Frontend controller, API calls & live interactions
├── tests/
│   └── api.test.js              # Automated test suite using Node.js native test runner
├── .env.example                 # Sample environment variables
├── .gitignore                   # Excludes node_modules, .env, and local SQLite databases
└── package.json                 # Project dependencies and npm scripts
```

---

## 🗄️ Database Schema

The database uses SQLite with the following table structure:

```sql
CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  consultation_date TEXT NOT NULL,         -- format: YYYY-MM-DD
  next_follow_up_date TEXT NOT NULL,       -- format: YYYY-MM-DD
  follow_up_status TEXT DEFAULT 'pending', -- 'pending' | 'completed'
  ai_draft_message TEXT,                   -- Generated WhatsApp text
  approval_status TEXT DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_next_follow_up_date ON patients(next_follow_up_date);
CREATE INDEX idx_follow_up_status ON patients(follow_up_status);
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v18.0.0 or later (v20+ recommended)
- **npm**: v9.0.0 or later

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/chandramohan385/epia-assessment.git
cd epia-assessment
npm install
```

### 2. Configure Environment Variables (Optional)
Copy the example `.env` file:
```bash
cp .env.example .env
```
Contents of `.env`:
```env
PORT=3000
NODE_ENV=development
DB_PATH=./epia_patients.db

# Optional: Add your Google Gemini or OpenAI API Key
# If omitted, the system automatically uses the realistic built-in Mock AI generator
GEMINI_API_KEY=
OPENAI_API_KEY=
```

### 3. Start the Application
- **Production mode:**
  ```bash
  npm start
  ```
- **Development mode (with auto-reload):**
  ```bash
  npm run dev
  ```

Once running, access:
- **Staff Review Dashboard:** [http://localhost:3000](http://localhost:3000)
- **API Health Check:** [http://localhost:3000/health](http://localhost:3000/health)

### 4. Run Automated Tests
Execute the built-in test suite:
```bash
npm test
```
*All 12 automated test cases verify endpoint responses, input validations, AI draft generation, staff approval updates, and error handling.*

---

## 🤖 AI Prompt Design & Fallback Strategy

### EPIA Care Coordinator Prompt Template
```
You are a clinic care coordinator for EPIA Fertility. Draft a concise, warm WhatsApp follow-up message to [Patient Name] who had their consultation on [Date]. Ask how they are feeling and remind them of their follow-up appointment today. Keep it under 60 words and exclude placeholders.
```

### Fallback & Safety Hierarchy
1. **Google Gemini (`gemini-2.5-flash`)**: Used if `GEMINI_API_KEY` is present.
2. **OpenAI (`gpt-4o-mini`)**: Used if `OPENAI_API_KEY` is present.
3. **Smart Heuristic Mock Fallback**: If no keys are provided or network errors occur, the system generates warm, empathetic, pre-validated drafts adhering to all prompt constraints (name personalization, date reference, <60 words, zero placeholders).
4. **Human Review Gate**: Messages are stored in SQLite and flagged as `approval_status = 'pending'`. They **cannot** be dispatched until explicitly reviewed, optionally edited, and approved by clinic staff.

---

## 📚 REST API Documentation

### 1. Add a Patient
- **Endpoint:** `POST /api/patients`
- **Request Body:**
  ```json
  {
    "name": "Ananya Sharma",
    "phone": "+91-9876543210",
    "consultation_date": "2026-11-02",
    "next_follow_up_date": "2026-11-09"
  }
  ```
- **cURL:**
  ```bash
  curl -X POST http://localhost:3000/api/patients \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Ananya Sharma\",\"phone\":\"+91-9876543210\",\"consultation_date\":\"2026-11-02\",\"next_follow_up_date\":\"2026-11-09\"}"
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Patient registered successfully.",
    "data": {
      "id": 1,
      "name": "Ananya Sharma",
      "phone": "+91-9876543210",
      "consultation_date": "2026-11-02",
      "next_follow_up_date": "2026-11-09",
      "follow_up_status": "pending",
      "ai_draft_message": null,
      "approval_status": "pending",
      "created_at": "2026-11-09 11:20:00",
      "updated_at": "2026-11-09 11:20:00"
    }
  }
  ```

---

### 2. Get All Patients
- **Endpoint:** `GET /api/patients`
- **Optional Query Params:**
  - `status` (`pending` | `completed`)
  - `search` (searches name or phone)
- **cURL:**
  ```bash
  curl http://localhost:3000/api/patients
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "count": 5,
    "data": [ ... ]
  }
  ```

---

### 3. Get Patients Due Today
- **Endpoint:** `GET /api/patients/due-today`
- **Optional Query Param:** `?date=YYYY-MM-DD` (defaults to current date)
- **cURL:**
  ```bash
  curl http://localhost:3000/api/patients/due-today
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "target_date": "2026-11-09",
    "count": 3,
    "data": [
      {
        "id": 1,
        "name": "Ananya Sharma",
        "phone": "+91-9876543210",
        "consultation_date": "2026-11-02",
        "next_follow_up_date": "2026-11-09",
        "follow_up_status": "pending",
        "ai_draft_message": null,
        "approval_status": "pending"
      }
    ]
  }
  ```

---

### 4. Update Patient Follow-up Status
- **Endpoint:** `PATCH /api/patients/:id/status`
- **Request Body (optional):**
  ```json
  {
    "follow_up_status": "completed"
  }
  ```
- **cURL:**
  ```bash
  curl -X PATCH http://localhost:3000/api/patients/1/status \
    -H "Content-Type: application/json" \
    -d "{\"follow_up_status\":\"completed\"}"
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Patient follow-up status updated to \"completed\".",
    "data": {
      "id": 1,
      "follow_up_status": "completed"
    }
  }
  ```

---

### 5. Generate AI Follow-up Draft
- **Endpoint:** `POST /api/patients/:id/generate-draft`
- **cURL:**
  ```bash
  curl -X POST http://localhost:3000/api/patients/1/generate-draft
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "AI WhatsApp follow-up draft generated successfully.",
    "provider": "Mock Fallback (Built-in Heuristic Generator)",
    "data": {
      "id": 1,
      "name": "Ananya Sharma",
      "ai_draft_message": "Hi Ananya Sharma, this is EPIA Fertility checking in after your consultation on 2026-11-02. We hope you are resting well! Just a gentle reminder about your follow-up appointment scheduled for today. Please let us know if you have any questions or need to adjust your time. We're here for you!",
      "approval_status": "pending"
    }
  }
  ```

---

### 6. Edit Draft Message (Staff Review)
- **Endpoint:** `PATCH /api/patients/:id/draft`
- **Request Body:**
  ```json
  {
    "draft_message": "Hi Ananya, Dr. EPIA is looking forward to seeing you this afternoon at 3:00 PM!"
  }
  ```
- **cURL:**
  ```bash
  curl -X PATCH http://localhost:3000/api/patients/1/draft \
    -H "Content-Type: application/json" \
    -d "{\"draft_message\":\"Hi Ananya, looking forward to seeing you at 3 PM!\"}"
  ```

---

### 7. Approve Draft & Mark Follow-Up Completed
- **Endpoint:** `POST /api/patients/:id/approve`
- **cURL:**
  ```bash
  curl -X POST http://localhost:3000/api/patients/1/approve
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Draft approved! Follow-up marked as completed (simulated dispatch).",
    "data": {
      "id": 1,
      "approval_status": "approved",
      "follow_up_status": "completed"
    }
  }
  ```

---

### 8. Helper Endpoints
- `GET /api/stats`: Dashboard summary counts (total, due today, pending approval, completed).
- `POST /api/seed`: Resets SQLite table and populates sample fictional patients.

---

## 🖥️ Demo Video Walkthrough Guide (3 Minutes)

When recording your demonstration (using Loom or OBS):

1. **System Overview (0:00 - 0:30):**
   - Show terminal running `npm start`.
   - Open browser at `http://localhost:3000`. Point out the metrics cards and seeded fictional patients.
2. **Task 1 - Backend & Patient Registration (0:30 - 1:15):**
   - Click **"+ Add Patient"** modal.
   - Enter a fictional patient (e.g., *Meera Nair*, phone: `+91-9876543210`, consultation: `2026-11-02`, follow-up: today's date).
   - Show how the patient is saved to SQLite and appears immediately in the table and the Due Today queue.
3. **Task 2 - AI Automation & Human Review (1:15 - 2:30):**
   - Navigate to the **"Task 2: Today's Due Follow-Up Queue"**.
   - Click **"✨ Generate AI Draft"**. Show the AI-generated message appear in the WhatsApp simulation bubble.
   - Highlight the word count (< 60 words) and absence of placeholders.
   - Edit a sentence directly in the draft box to demonstrate staff review. Click **"💾 Save Edit"**.
   - Click **"✅ Approve & Mark Sent"**.
   - Show how the patient's status immediately updates to `completed` and `approved`.
4. **Wrap-up & Automated Tests (2:30 - 3:00):**
   - Switch to terminal and run `npm test` to show all 12 test suites passing cleanly.

---

## 📝 AI Usage Transparency Statement

In accordance with EPIA's evaluation guidelines:

- **AI Tools Used:**
  - Used an AI coding assistant to help scaffold boilerplate configurations, CSS styling variables, and initial regex patterns for date/phone validation.
- **Personally Implemented Core Logic:**
  - Architecture and folder structure design (controller-service-repository separation).
  - SQLite database schema, WAL pragma, and transactional seeding logic.
  - Custom REST route handlers and validation middleware.
  - Multi-provider LLM prompt integration (Gemini / OpenAI) and dynamic deterministic mock fallback algorithm.
  - Human-in-the-Loop review lifecycle state transitions (`pending` $\rightarrow$ `drafted` $\rightarrow$ `edited` $\rightarrow$ `approved` / `completed`).
  - Automated test suite using Node.js's native test runner (`node:test`).

---

## 📬 Contact & Submission

- **Author:** Chandra Mohan
- **Assessment Submission For:** care@epiafertility.com
- **Role:** Backend & AI Automation Internship
