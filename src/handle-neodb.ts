import dotenv from 'dotenv';
import { consola } from 'consola';
import type { FeedItem } from './types';
import { neodbToken, syncFeedItemToNeodb } from './neodb';

dotenv.config();

/**
 * Asynchronously handles syncing feed items to NeoDB.
 *
 * @param {FeedItem[]} feeds - the array of feed items to sync
 * @return {Promise<void>}
 */
export default async function handleNeodb(feeds: FeedItem[]): Promise<void> {
  if (!neodbToken) {
    return;
  }

  consola.start('Going to sync to NeoDB...');
  for (const item of feeds) {
    await syncFeedItemToNeodb(item);
  }
  consola.success('NeoDB synced ✨');
}
