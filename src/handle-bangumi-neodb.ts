import dotenv from 'dotenv';
import { consola } from 'consola';
import type { BangumiCollectionType, BangumiSubjectType } from './types';
import {
  BANGUMI_TO_NEODB_STATUS,
  bangumiCollectionToNeodbProgress,
  neodbItemSupportsProgress,
} from './const';
import {
  bangumiCollectionLimit,
  bangumiSubjectUrl,
  bangumiThrottle,
  bangumiToken,
  getBangumiMe,
  getBangumiSubject,
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
import { mergeNeodbMark } from './neodb-merge';
import {
  bangumiSubjectTypesForAllowlist,
  needsBangumiMangaPlatformCheck,
  syncConfig,
} from './sync-config';

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

  const allowlist = syncConfig.bangumiNeodbCategories;
  const subjectTypes = bangumiSubjectTypesForAllowlist(allowlist);

  if (subjectTypes && subjectTypes.length === 0) {
    consola.warn('Bangumi → NeoDB category allowlist is empty; skip.');
    return;
  }

  consola.start(
    fullSync
      ? 'Going to full-sync Bangumi → NeoDB...'
      : 'Going to sync recent Bangumi → NeoDB...',
  );

  let processed = 0;
  const mangaPlatformCheck = needsBangumiMangaPlatformCheck(allowlist);

  // null = mixed fetch (all types); otherwise one pass per subject_type
  const typePasses: Array<BangumiSubjectType | undefined> = subjectTypes
    ? subjectTypes
    : [undefined];

  for (const subjectType of typePasses) {
    let offset = 0;
    const limit = bangumiCollectionLimit;

    while (true) {
      const page = await listBangumiCollections({
        username: me.username,
        limit,
        offset,
        subjectType,
      });

      if (!page.data.length) {
        break;
      }

      for (const collection of page.data) {
        const synced = await syncCollectionToNeodb(collection, mangaPlatformCheck);
        if (synced) {
          processed += 1;
        }
        await bangumiThrottle();
      }

      if (!fullSync) {
        break;
      }

      offset += page.data.length;
      if (offset >= page.total) {
        break;
      }
    }
  }

  consola.success(`Bangumi → NeoDB synced (${processed} items) ✨`);
}

async function syncCollectionToNeodb(
  collection: BangumiCollection,
  mangaPlatformCheck: boolean,
): Promise<boolean> {
  const url = bangumiSubjectUrl(collection.subject_id);
  const title =
    collection.subject?.name_cn ||
    collection.subject?.name ||
    `subject/${collection.subject_id}`;
  consola.info('Bangumi → NeoDB: ', `${title}[${url}]`);

  if (
    mangaPlatformCheck &&
    collection.subject_type === 1 &&
    !(await isBangumiManga(collection.subject_id, title))
  ) {
    return false;
  }

  const neodbItem = await resolveNeodbItemForBangumiUrl(url, {
    titles: [collection.subject?.name_cn, collection.subject?.name],
    subjectType: collection.subject_type,
  });
  if (!neodbItem?.uuid) {
    consola.warn('NeoDB could not resolve Bangumi URL, skip: ', url);
    return false;
  }

  const shelfType = BANGUMI_TO_NEODB_STATUS[collection.type as BangumiCollectionType];
  const ratingGrade = collection.rate || 0;
  const comment = collection.comment || '';
  // Bangumi updated_at is unreliable; only used when creating a new NeoDB mark.
  const createdTime = collection.updated_at || undefined;

  const mark = await getNeodbMark(neodbItem.uuid);
  if (!mark) {
    await markNeodbItem(neodbItem, {
      shelfType,
      comment,
      ratingGrade,
      createdTime,
    });
    if (syncConfig.bangumiNeodbProgress) {
      await syncProgressToNeodb(collection, neodbItem, title);
    }
    return true;
  }

  const merged = mergeNeodbMark(
    mark,
    { shelfType, ratingGrade, comment },
    syncConfig.bangumiNeodbMerge,
    neodbVisibility,
  );

  if (!merged.shouldWrite) {
    consola.info('NeoDB mark unchanged, skip: ', title);
  } else {
    if (merged.keptRating || merged.keptComment) {
      consola.info(
        'NeoDB prefer: keeping existing ',
        [
          merged.keptRating ? 'rating' : null,
          merged.keptComment ? 'comment' : null,
        ]
          .filter(Boolean)
          .join('+'),
        ' on ',
        title,
      );
    }
    // Do not pass createdTime on update — preserves NeoDB mark date.
    await markNeodbItem(neodbItem, {
      shelfType: merged.shelfType,
      comment: merged.comment,
      ratingGrade: merged.ratingGrade,
    });
  }

  if (syncConfig.bangumiNeodbProgress) {
    await syncProgressToNeodb(collection, neodbItem, title);
  }
  return true;
}

async function isBangumiManga(subjectId: number, title: string): Promise<boolean> {
  const subject = await getBangumiSubject(subjectId);
  const platform = subject?.platform?.trim() || '';
  if (platform === '漫画') {
    return true;
  }
  consola.info(
    'Bangumi → NeoDB: skip non-manga book: ',
    `${title} (platform=${platform || 'unknown'})`,
  );
  return false;
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

  if (!neodbItemSupportsProgress(neodbItem, progress)) {
    consola.info(
      'NeoDB progress not applicable for catalog category, skip: ',
      `${title} (${neodbItem.category}/${progress.type})`,
    );
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
