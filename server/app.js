const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');

const teacherRoutes = require('./routes/teacher');
const studentRoutes = require('./routes/student');
const authRoutes = require('./routes/auth');
const { ensureDatabaseReady } = require('../database/services/dbService');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());
app.use(async (_req, res, next) => {
  try {
    await ensureDatabaseReady();
    return next();
  } catch (error) {
    console.error('Database initialization failed:', error);
    return res.status(503).json({
      error: 'Database is not ready',
      detail: error.message,
    });
  }
});

// Routes
app.use('/api/teacher', teacherRoutes);
app.use('/api', authRoutes);
app.use('/api/student', studentRoutes);

// Health check endpoints
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Debug students route (from index.js)
const { requireAuth } = require('./middleware/authMiddleware');
const { readPortalData } = require('../database/services/dbService');
app.get('/api/debug/students', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const students = (await readPortalData(`students:${user.id}`)) || [];
    return res.json({ students, count: Array.isArray(students) ? students.length : 0 });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = app;
