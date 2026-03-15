require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'invincible';
let SESSION_TOKEN = require('crypto').randomBytes(32).toString('hex');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware for admin auth
const authAdmin = (req, res, next) => {
  const password = req.headers['x-admin-password'];
  const token = req.headers['x-admin-token'];
  
  if (password === ADMIN_PASSWORD || token === SESSION_TOKEN) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// API: Public State
app.get('/api/state', async (req, res) => {
  try {
    const current = await db.getCurrentVideo();
    const next = await db.getNextVideos();
    // console.log('State polled:', { current: current?.title, nextCount: next.length });
    res.json({ current, next });
  } catch (err) {
    console.error('State poll error:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Admin Operations
app.post('/api/admin/schedule', authAdmin, async (req, res) => {
  const { title, url, startTime, duration } = req.body;
  console.log('Adding schedule:', { title, url, startTime, duration });
  
  if (!title || !url || !startTime) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  
  try {
    const dur = duration ? parseInt(duration) : 86400; // Default to 24h if not provided
    await db.addScheduleEntry(title, url, parseInt(startTime), dur);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/schedule', authAdmin, async (req, res) => {
  try {
    const schedule = await db.getSchedule();
    res.json(schedule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/schedule/:id', authAdmin, async (req, res) => {
  try {
    await db.deleteScheduleEntry(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, token: SESSION_TOKEN });
  } else {
    res.status(401).json({ success: false });
  }
});

db.initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`TV Channel Lite running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error("Failed to initialize database", err);
});
