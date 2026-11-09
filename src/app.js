const express = require('express');
const cors = require('cors');
const path = require('path');
const patientRoutes = require('./routes/patientRoutes');
const { notFoundHandler, globalErrorHandler } = require('./middleware/errorHandler');

const app = express();

// Security and utility middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend UI (Staff Review & Approval Dashboard)
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api', patientRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'EPIA Patient Follow-up System'
  });
});

// Centralized error handling
app.use(notFoundHandler);
app.use(globalErrorHandler);

module.exports = app;
