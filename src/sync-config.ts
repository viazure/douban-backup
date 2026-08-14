import dotenv from 'dotenv';

dotenv.config();

/**
 * Parse env flag. Empty/unset → defaultValue.
 * Truthy: 1, true, yes, on (case-insensitive).
 */
export function envEnabled(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return defaultValue;
  }
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

/**
 * Which sync paths to run.
 * Defaults match a NeoDB + Bangumi setup (Notion off).
 */
export const syncConfig = {
  /** Douban RSS → Notion */
  doubanNotion: envEnabled('SYNC_DOUBAN_NOTION', false),
  /** Douban RSS → NeoDB */
  doubanNeodb: envEnabled('SYNC_DOUBAN_NEODB', true),
  /** Douban RSS → Bangumi */
  doubanBangumi: envEnabled('SYNC_DOUBAN_BANGUMI', true),
  /** Bangumi collections → NeoDB */
  bangumiNeodb: envEnabled('SYNC_BANGUMI_NEODB', true),
};

export function needsDoubanRss(): boolean {
  return syncConfig.doubanNotion || syncConfig.doubanNeodb || syncConfig.doubanBangumi;
}

export function describeSyncConfig(): string {
  const lines = [
    `Douban→Notion: ${syncConfig.doubanNotion ? 'on' : 'off'}`,
    `Douban→NeoDB: ${syncConfig.doubanNeodb ? 'on' : 'off'}`,
    `Douban→Bangumi: ${syncConfig.doubanBangumi ? 'on' : 'off'}`,
    `Bangumi→NeoDB: ${syncConfig.bangumiNeodb ? 'on' : 'off'}`,
  ];
  return lines.join(', ');
}
