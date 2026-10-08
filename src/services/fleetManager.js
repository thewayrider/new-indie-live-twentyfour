const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { getMasterStats } = require('../utils/masterDb');

class FleetManager {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '../../');
    this.parentDir = path.resolve(this.projectRoot, '../');

    // Fleet state registry
    this.services = {
      'global-radar': {
        id: 'global-radar',
        name: 'Global 24h Radar',
        description: 'Multi-channel 24h open-web discovery (Bandcamp, YouTube, SoundCloud, Blogs, Deezer, MusicBrainz)',
        market: 'GLOBAL',
        schedule: 'Daily at 06:30 AM',
        command: 'node',
        args: ['src/index.js'],
        cwd: this.projectRoot,
        state: 'idle',
        lastRunStartedAt: null,
        lastRunFinishedAt: null,
        lastExitCode: null,
        lastDurationMs: null,
        logs: []
      },
      'us-radar': {
        id: 'us-radar',
        name: 'US Edition Radar',
        description: 'Curated 24h US indie rock tastemakers (BrooklynVegan, Stereogum, Big Takeover, Gorilla vs Bear, etc.)',
        market: 'US',
        schedule: 'Daily at 07:00 AM',
        command: 'node',
        args: ['src/index.js', '--us'],
        cwd: this.projectRoot,
        state: 'idle',
        lastRunStartedAt: null,
        lastRunFinishedAt: null,
        lastExitCode: null,
        lastDurationMs: null,
        logs: []
      },
      'global-dry-run': {
        id: 'global-dry-run',
        name: 'Global Sandbox (Dry-Run)',
        description: 'Scans live global web, applies clean filters, read-only database mode (no email sent)',
        market: 'GLOBAL',
        schedule: 'On-Demand',
        command: 'node',
        args: ['src/index.js', '--dry-run'],
        cwd: this.projectRoot,
        state: 'idle',
        lastRunStartedAt: null,
        lastRunFinishedAt: null,
        lastExitCode: null,
        lastDurationMs: null,
        logs: []
      },
      'us-dry-run': {
        id: 'us-dry-run',
        name: 'US Sandbox (Dry-Run)',
        description: 'Scans live US tastemakers, applies clean filters, read-only database mode (no email sent)',
        market: 'US',
        schedule: 'On-Demand',
        command: 'node',
        args: ['src/index.js', '--us', '--dry-run'],
        cwd: this.projectRoot,
        state: 'idle',
        lastRunStartedAt: null,
        lastRunFinishedAt: null,
        lastExitCode: null,
        lastDurationMs: null,
        logs: []
      }
    };

    // Auto-detect sibling crawler fleets if available
    this._detectSiblingFleets();

    this.activeProcesses = new Map();
  }

  _detectSiblingFleets() {
    const candidatePaths = [
      { id: 'weekly-crawler', name: 'Weekly Music Search Fleet', path: path.join(this.parentDir, 'Music Crawler Stuff/live-music-search-agent') },
      { id: 'weekly-crawler-alt', name: 'Weekly Music Search Fleet', path: path.join(this.parentDir, 'live-music-search-agent') }
    ];

    for (const cand of candidatePaths) {
      if (fs.existsSync(cand.path)) {
        this.services[cand.id] = {
          id: cand.id,
          name: cand.name,
          description: `Sibling crawler project located at ${cand.path}`,
          market: 'WEEKLY',
          schedule: 'Weekly Scheduled',
          command: 'npm',
          args: ['start'],
          cwd: cand.path,
          state: 'idle',
          lastRunStartedAt: null,
          lastRunFinishedAt: null,
          lastExitCode: null,
          lastDurationMs: null,
          logs: []
        };
      }
    }
  }

  getFleetStatus() {
    let dbStats = { totalUniqueSongs: 0, totalSightings: 0, consensusSongsCount: 0 };
    try {
      dbStats = getMasterStats();
    } catch (e) {
      // Database may be initializing
    }

    const serviceSummaries = Object.values(this.services).map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      market: s.market,
      schedule: s.schedule,
      state: s.state,
      lastRunStartedAt: s.lastRunStartedAt,
      lastRunFinishedAt: s.lastRunFinishedAt,
      lastExitCode: s.lastExitCode,
      lastDurationMs: s.lastDurationMs,
      logCount: s.logs.length
    }));

    return {
      status: 'operational',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      database: dbStats,
      services: serviceSummaries
    };
  }

  getRecentDiscoveries(limit = 15) {
    try {
      const dbPath = path.join(this.projectRoot, 'data/master_catalog.sqlite');
      if (!fs.existsSync(dbPath)) return [];

      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(dbPath);
      const query = `
        SELECT s.id, s.artist, s.title, s.slug, s.first_seen_at, s.first_channel, s.heat_score, s.created_at
        FROM songs s
        ORDER BY s.id DESC
        LIMIT ?
      `;
      const rows = db.prepare(query).all(limit);
      db.close();
      return rows;
    } catch (e) {
      console.error('Error in getRecentDiscoveries:', e);
      return [];
    }
  }

  getServiceLogs(serviceId) {
    const service = this.services[serviceId];
    if (!service) return { error: `Service '${serviceId}' not found.` };
    return {
      serviceId,
      name: service.name,
      state: service.state,
      logs: service.logs
    };
  }

  triggerService(serviceId) {
    const service = this.services[serviceId];
    if (!service) {
      return { success: false, error: `Service '${serviceId}' does not exist.` };
    }

    if (service.state === 'running') {
      return { success: false, error: `Service '${service.name}' is already running.` };
    }

    service.state = 'running';
    service.lastRunStartedAt = new Date().toISOString();
    service.lastRunFinishedAt = null;
    service.lastExitCode = null;
    service.logs = [];

    const startTime = Date.now();
    this._addLog(service, `[Command Center] Starting execution of ${service.name}...`);
    this._addLog(service, `[Command Center] Command: ${service.command} ${service.args.join(' ')} (CWD: ${service.cwd})`);

    const isWindows = process.platform === 'win32';
    const child = spawn(service.command, service.args, {
      cwd: service.cwd,
      shell: isWindows,
      env: { ...process.env, FORCE_COLOR: '1' }
    });

    this.activeProcesses.set(serviceId, child);

    child.stdout.on('data', data => {
      const text = data.toString();
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.trim()) this._addLog(service, line.trimEnd());
      }
    });

    child.stderr.on('data', data => {
      const text = data.toString();
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.trim()) this._addLog(service, `[stderr] ${line.trimEnd()}`);
      }
    });

    child.on('close', code => {
      const durationMs = Date.now() - startTime;
      service.state = code === 0 ? 'idle' : 'error';
      service.lastRunFinishedAt = new Date().toISOString();
      service.lastExitCode = code;
      service.lastDurationMs = durationMs;
      this.activeProcesses.delete(serviceId);

      this._addLog(service, `[Command Center] Execution finished with exit code ${code} (Duration: ${(durationMs / 1000).toFixed(1)}s)`);
    });

    child.on('error', err => {
      service.state = 'error';
      service.lastExitCode = -1;
      this.activeProcesses.delete(serviceId);
      this._addLog(service, `[Command Center] Process failed to spawn: ${err.message}`);
    });

    return {
      success: true,
      serviceId,
      name: service.name,
      state: 'running',
      startedAt: service.lastRunStartedAt
    };
  }

  stopService(serviceId) {
    const child = this.activeProcesses.get(serviceId);
    if (!child) {
      return { success: false, error: `Service '${serviceId}' is not currently running.` };
    }

    try {
      child.kill('SIGTERM');
      const service = this.services[serviceId];
      if (service) {
        this._addLog(service, `[Command Center] Termination signal sent by user.`);
        service.state = 'idle';
      }
      this.activeProcesses.delete(serviceId);
      return { success: true, message: `Terminated service '${serviceId}' successfully.` };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  _addLog(service, line) {
    const timestamp = new Date().toLocaleTimeString();
    const formatted = `[${timestamp}] ${line}`;
    service.logs.push(formatted);
    if (service.logs.length > 250) {
      service.logs.shift(); // keep last 250 lines
    }
  }
}

module.exports = new FleetManager();
