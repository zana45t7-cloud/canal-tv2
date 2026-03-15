const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');

const useRemote = process.env.TURSO_DATABASE_URL;
const dbUrl = useRemote || `file:${path.join(__dirname, 'data', 'channel.db')}`;

// Ensure data directory exists for local DB
if (!useRemote) {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

const db = createClient({
  url: dbUrl,
  authToken: process.env.TURSO_AUTH_TOKEN
});

// Initialize tables
async function initDb() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      start_time INTEGER NOT NULL, -- Unix timestamp (UTC)
      duration INTEGER NOT NULL,    -- Duration in seconds
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function addScheduleEntry(title, url, startTime, duration) {
  return await db.execute({
    sql: 'INSERT INTO schedule (title, url, start_time, duration) VALUES (?, ?, ?, ?)',
    args: [title, url, startTime, duration]
  });
}

async function getSchedule() {
  const result = await db.execute('SELECT * FROM schedule ORDER BY start_time ASC');
  return result.rows;
}

async function deleteScheduleEntry(id) {
  return await db.execute({
    sql: 'DELETE FROM schedule WHERE id = ?',
    args: [id]
  });
}

async function getCurrentVideo() {
  const now = Math.floor(Date.now() / 1000);
  
  // Find the latest video that has already started
  const result = await db.execute({
    sql: `
      SELECT * FROM schedule 
      WHERE start_time <= ?
      ORDER BY start_time DESC LIMIT 1
    `,
    args: [now, now]
  });
  
  const video = result.rows.length > 0 ? result.rows[0] : null;
  if (video) {
    video.seekTime = now - video.start_time;
  }
  return video;
}

async function getNextVideos() {
  const now = Math.floor(Date.now() / 1000);
  const result = await db.execute({
    sql: 'SELECT * FROM schedule WHERE start_time > ? ORDER BY start_time ASC',
    args: [now]
  });
  return result.rows;
}

module.exports = {
  initDb,
  addScheduleEntry,
  getSchedule,
  deleteScheduleEntry,
  getCurrentVideo,
  getNextVideos
};
