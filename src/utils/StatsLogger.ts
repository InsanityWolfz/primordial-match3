// ─── StatsLogger ───
// Logs per-round balance data to localStorage so it persists across multiple runs.
// Enable via DEBUG_CONFIG.debugStats = true in gameConfig.ts.
//
// Usage:
//   StatsLogger.logRound(stats)   → saves to memory + localStorage
//   StatsLogger.exportStats()     → returns full JSON string of all stored runs
//   StatsLogger.clearStats()      → wipes localStorage (manual only)

const STORAGE_KEY = 'primordial_stats';

export interface RoundStats {
  runId: string;
  round: number;
  timestamp: number;
  win: boolean;
  modifier: string | null;
  // Economy
  essenceEarned: number;
  gemsDestroyed: number;
  match3Count: number;
  match4Count: number;
  match5Count: number;
  // Combat
  hazardsCleared: number;
  enemiesKilled: number;
  turnsUsed: number;
  // Power usage: { powerId: timesUsed }
  powerUsesByPower: Record<string, number>;
}

class StatsLoggerClass {
  private sessionLog: RoundStats[] = [];

  logRound(stats: RoundStats): void {
    this.sessionLog.push(stats);

    // Append to localStorage
    try {
      const stored = this.loadAll();
      stored.push(stats);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch (e) {
      console.warn('[StatsLogger] Failed to write to localStorage:', e);
    }

    // Also log a compact summary to console for quick reading
    console.log(
      `[Stats] R${stats.round} | ${stats.win ? 'WIN' : 'LOSS'} | ` +
      `gems:${stats.gemsDestroyed} m3:${stats.match3Count} m4:${stats.match4Count} m5:${stats.match5Count} | ` +
      `essence:${stats.essenceEarned} | turns:${stats.turnsUsed} | ` +
      `enemies:${stats.enemiesKilled} hazards:${stats.hazardsCleared}` +
      (stats.modifier ? ` | mod:${stats.modifier}` : ''),
    );
  }

  exportStats(): string {
    return JSON.stringify(this.loadAll(), null, 2);
  }

  clearStats(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
      this.sessionLog = [];
      console.log('[StatsLogger] Stats cleared.');
    } catch (e) {
      console.warn('[StatsLogger] Failed to clear localStorage:', e);
    }
  }

  getSessionStats(): RoundStats[] {
    return [...this.sessionLog];
  }

  private loadAll(): RoundStats[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as RoundStats[];
    } catch {
      return [];
    }
  }
}

export const StatsLogger = new StatsLoggerClass();
