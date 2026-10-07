const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { normalizeKey, parseArtistTitle, slugify } = require('./normalizer');

const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'master_catalog.sqlite');

let _dbInstance = null;

function getDatabase() {
  if (_dbInstance) return _dbInstance;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  _dbInstance = new DatabaseSync(DB_PATH);

  _dbInstance.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      artist TEXT NOT NULL,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      first_seen_at TEXT NOT NULL,
      first_channel TEXT NOT NULL,
      first_url TEXT,
      release_date TEXT,
      release_type TEXT,
      description TEXT,
      heat_score INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sightings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
      channel_name TEXT NOT NULL,
      source_url TEXT,
      seen_at TEXT NOT NULL,
      UNIQUE(song_id, channel_name)
    );

    CREATE INDEX IF NOT EXISTS idx_master_slug ON songs(slug);
    CREATE INDEX IF NOT EXISTS idx_master_heat ON songs(heat_score DESC);
    CREATE INDEX IF NOT EXISTS idx_master_first_seen ON songs(first_seen_at);
    CREATE INDEX IF NOT EXISTS idx_sightings_song ON sightings(song_id);
  `);

  return _dbInstance;
}

/**
 * Evaluates a candidate track against the Master SQLite memory.
 * Distinguishes brand-new releases from recycled pre-release singles.
 */
function evaluateCandidateTrack(item, channelName = "Radar", options = {}) {
  const db = getDatabase();
  const isDryRun = options.isDryRun || false;

  let artist = item.artist;
  let title = item.title;

  if (!artist || !title) {
    const parsed = parseArtistTitle(item.title || "");
    artist = parsed.artist;
    title = parsed.title;
  }

  const slug = normalizeKey(artist, title);
  const nowIso = new Date().toISOString();
  const seenAt = item.uploadedAt || nowIso.slice(0, 10);
  const channel = item.channel || channelName;
  const url = item.url || "";
  const releaseType = item.releaseType || "single";
  const desc = item.description || "";

  // 1. Check if track already exists in Master Catalog
  const findStmt = db.prepare(`SELECT * FROM songs WHERE slug = ?`);
  const existing = findStmt.get(slug);

  if (!existing) {
    // Brand-new discovery
    if (!isDryRun) {
      const insertSong = db.prepare(`
        INSERT INTO songs (artist, title, slug, first_seen_at, first_channel, first_url, release_date, release_type, description, heat_score)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `);
      const result = insertSong.run(artist, title, slug, seenAt, channel, url, seenAt, releaseType, desc);
      const songId = Number(result.lastInsertRowid);

      const insertSighting = db.prepare(`
        INSERT INTO sightings (song_id, channel_name, source_url, seen_at)
        VALUES (?, ?, ?, ?)
      `);
      insertSighting.run(songId, channel, url, seenAt);
    }

    return {
      isNewGlobal: true,
      isRecycledSingle: false,
      isNewSighting: true,
      heatScore: 1,
      sources: [channel],
      songId: existing ? existing.id : null
    };
  }

  // 2. Track exists — Check if it's an old pre-release single reappearing on a new album
  const firstSeenDate = new Date(existing.first_seen_at || existing.created_at);
  const daysDiff = (Date.now() - firstSeenDate.getTime()) / (1000 * 60 * 60 * 24);

  // If first seen more than 7 days ago, this is an old single being re-packaged on an album!
  if (daysDiff > 7) {
    return {
      isNewGlobal: false,
      isRecycledSingle: true,
      firstSeenAt: existing.first_seen_at,
      heatScore: existing.heat_score,
      sources: [existing.first_channel],
      songId: existing.id
    };
  }

  // 3. Track was first seen recently (within last 7 days) — Check if this channel is a new sighting
  const songId = existing.id;
  const findSighting = db.prepare(`SELECT id FROM sightings WHERE song_id = ? AND channel_name = ?`);
  const existingSighting = findSighting.get(songId, channel);

  if (!existingSighting) {
    if (!isDryRun) {
      const insertSighting = db.prepare(`
        INSERT INTO sightings (song_id, channel_name, source_url, seen_at)
        VALUES (?, ?, ?, ?)
      `);
      insertSighting.run(songId, channel, url, seenAt);

      const countStmt = db.prepare(`SELECT COUNT(*) as count FROM sightings WHERE song_id = ?`);
      const heatCount = Number(countStmt.get(songId).count);

      const updateHeat = db.prepare(`UPDATE songs SET heat_score = ? WHERE id = ?`);
      updateHeat.run(heatCount, songId);
    }

    return {
      isNewGlobal: false,
      isRecycledSingle: false,
      isNewSighting: true,
      heatScore: existing.heat_score + 1,
      sources: [channel],
      songId
    };
  }

  return {
    isNewGlobal: false,
    isRecycledSingle: false,
    isNewSighting: false,
    heatScore: existing.heat_score,
    sources: [channel],
    songId
  };
}

function getMasterStats() {
  const db = getDatabase();
  const songCount = Number(db.prepare(`SELECT COUNT(*) as c FROM songs`).get().c);
  const sightingCount = Number(db.prepare(`SELECT COUNT(*) as c FROM sightings`).get().c);
  const consensusCount = Number(db.prepare(`SELECT COUNT(*) as c FROM songs WHERE heat_score > 1`).get().c);

  return {
    totalUniqueSongs: songCount,
    totalSightings: sightingCount,
    consensusSongsCount: consensusCount,
    databasePath: DB_PATH
  };
}

function resetDatabase() {
  const db = getDatabase();
  db.exec(`
    DELETE FROM sightings;
    DELETE FROM songs;
    DELETE FROM sqlite_sequence WHERE name IN ('songs', 'sightings');
  `);
  console.log("[Master DB] Database reset successfully. All historical records cleared.");
}

module.exports = {
  getDatabase,
  evaluateCandidateTrack,
  getMasterStats,
  resetDatabase,
  DB_PATH
};
