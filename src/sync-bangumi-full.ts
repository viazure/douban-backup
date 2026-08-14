import { consola } from 'consola';
import handleBangumiToNeodb from './handle-bangumi-neodb';
import { syncConfig } from './sync-config';

/**
 * Full sync of all Bangumi collections to NeoDB.
 * Intended for manual / workflow_dispatch runs, not the regular cron.
 */
async function main(): Promise<void> {
  if (!syncConfig.bangumiNeodb) {
    consola.warn('SYNC_BANGUMI_NEODB is off; skip full sync.');
    return;
  }
  consola.start('Starting Bangumi → NeoDB full sync...');
  await handleBangumiToNeodb(true);
}

main();
