import { consola } from 'consola';
import { fetchRSSFeeds, handleRSSFeeds } from './handle-rss';
import handleNotion from './handle-notion';
import handleNeodb from './handle-neodb';
import handleBangumi from './handle-bangumi';
import handleBangumiToNeodb from './handle-bangumi-neodb';
import { ItemStatus } from './types';
import { describeSyncConfig, needsDoubanRss, syncConfig } from './sync-config';

async function main(): Promise<void> {
  consola.info('Sync paths: ', describeSyncConfig());

  let doubanFailed = false;

  if (needsDoubanRss()) {
    try {
      const feeds = await fetchRSSFeeds();
      if (feeds.length === 0) {
        consola.info('No new Douban RSS items.');
      } else {
        const normalizedFeeds = handleRSSFeeds(feeds);
        const completeFeeds = normalizedFeeds.filter(
          (f) => f.status === ItemStatus.Complete,
        );

        if (syncConfig.doubanNotion && completeFeeds.length) {
          await handleNotion(completeFeeds);
        }

        if (syncConfig.doubanNeodb) {
          await handleNeodb(normalizedFeeds);
        }

        if (syncConfig.doubanBangumi) {
          await handleBangumi(normalizedFeeds);
        }
      }
    } catch (error) {
      doubanFailed = true;
      consola.error(
        'Douban RSS sync failed; continuing with Bangumi→NeoDB if enabled. Error: ',
        error,
      );
    }
  } else {
    consola.info('All Douban→* paths disabled; skip Douban RSS.');
  }

  if (syncConfig.bangumiNeodb) {
    const fullSync = process.env.BANGUMI_FULL_SYNC === '1';
    await handleBangumiToNeodb(fullSync);
  }

  if (doubanFailed) {
    process.exitCode = 1;
  }
}

main();
