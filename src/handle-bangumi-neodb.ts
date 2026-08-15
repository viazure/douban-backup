import dotenv from 'dotenv';
import { consola } from 'consola';
import type { BangumiCollectionType } from './types';
import { BANGUMI_TO_NEODB_STATUS, bangumiCollectionToNeodbProgress } from './const';
import {
  bangumiCollectionLimit,
  bangumiSubjectUrl,
  bangumiThrottle,
  bangumiToken,
  getBangumiMe,
  listBangumiCollections,
  type BangumiCollection,
} from './bangumi';
import {
  getNeodbMark,
  getNeodbProgress,
  markNeodbItem,
  neodbToken,
  neodbVisibility,
  resolveNeodbItemForBangumiUrl,
  setNeodbProgress,
  type NeodbItem,
} from './neodb';

dotenv.config();

/**
 * Sync recent (or all) Bangumi collections to NeoDB.
 * Requires both BANGUMI_ACCESS_TOKEN and NEODB_API_TOKEN.
 */
export default async function handleBangumiToNeodb(fullSync = false): Promise<void> {
  if (!bangumiToken || !neodbToken) {
    return;
  }

  const me = await getBangumiMe();
  if (!me?.username) {
    consola.error('Cannot resolve Bangumi username; skip Bangumi → NeoDB');
    return;
  }

  consola.start(
    fullSync
      ? 'Going to full-sync Bangumi → NeoDB...'
      : 'Going to sync recent Bangumi → NeoDB...',
  );

  let offset = 0;
  let processed = 0;
  const limit = bangumiCollectionLimit;

  while (true) {
    const page = await listBangumiCollections({
      username: me.username,
      limit,
      offset,
    });

    if (!page.data.length) {
      break;
    }

    for (const collection of page.data) {
      await syncCollectionToNeodb(collection);
      await bangumiThrottle();
      processed += 1;
    }

    if (!fullSync) {
      break;
    }

    offset += page.data.length;
    if (offset >= page.total) {
      break;
    }
  }

  consola.success(`Bangumi → NeoDB synced (${processed} items) ✨`);
}

async function syncCollectionToNeodb(collection: BangumiCollection): Promise<void> {
  const url = bangumiSubjectUrl(collection.subject_id);
  const title =
    collection.subject?.name_cn ||
    collection.subject?.name ||
    `subject/${collection.subject_id}`;
  consola.info('Bangumi → NeoDB: ', `${title}[${url}]`);

  const neodbItem = await resolveNeodbItemForBangumiUrl(url, {
    titles: [collection.subject?.name_cn, collection.subject?.name],
    subjectType: collection.subject_type,
  });
  if (!neodbItem?.uuid) {
    consola.warn('NeoDB could not resolve Bangumi URL, skip: ', url);
    return;
  }

  const shelfType = BANGUMI_TO_NEODB_STATUS[collection.type as BangumiCollectionType];
  const ratingGrade = collection.rate || 0;
  const comment = collection.comment || '';
  // Bangumi updated_at is unreliable for "marked at" but used as a hint.
  const createdTime = collection.updated_at || undefined;

  const mark = await getNeodbMark(neodbItem.uuid);
  let markUnchanged = false;
  if (mark) {
    const sameStatus = mark.shelf_type === shelfType;
    const sameComment = (mark.comment_text || '') === comment;
    const sameRating = (mark.rating_grade || 0) === ratingGrade;
    const sameVisibility = (mark.visibility ?? neodbVisibility) === neodbVisibility;
    markUnchanged = sameStatus && sameComment && sameRating && sameVisibility;
  }

  if (markUnchanged) {
    consola.info('NeoDB mark unchanged, skip: ', title);
  } else {
    await markNeodbItem(neodbItem, {
      shelfType,
      comment,
      ratingGrade,
      createdTime,
    });
  }

  await syncProgressToNeodb(collection, neodbItem, title);
}

async function syncProgressToNeodb(
  collection: BangumiCollection,
  neodbItem: NeodbItem,
  title: string,
): Promise<void> {
  const progress = bangumiCollectionToNeodbProgress(collection);
  if (!progress) {
    return;
  }

  const existing = await getNeodbProgress(neodbItem.uuid);
  if (
    existing &&
    existing.type === progress.type &&
    String(existing.value ?? '') === progress.value
  ) {
    consola.info('NeoDB progress unchanged, skip: ', title);
    return;
  }

  await setNeodbProgress(neodbItem, progress);
}
