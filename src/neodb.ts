import dotenv from 'dotenv';
import got from 'got';
import { consola } from 'consola';
import { DOUBAN_EXPRESSED_STATUSES } from './const';
import { ItemCategory, ItemStatus, type FeedItem } from './types';
import { sleep } from './utils';

dotenv.config();

export const neodbToken = process.env.NEODB_API_TOKEN;
export const neodbVisibility = Number(process.env.NEODB_VISIBILITY ?? 2);

export type NeodbItem = {
  id: string;
  type: string;
  uuid: string;
  url: string;
  api_url: string;
  category: ItemCategory | string;
  parent_uuid: string;
  display_title: string;
  external_resources: {
    url: string;
  }[];
  title: string;
  brief: string;
  cover_image_url: string;
  rating: number;
  rating_count: number;
};

export type NeodbMark = {
  shelf_type: ItemStatus | string;
  visibility?: number;
  comment_text?: string;
  rating_grade?: number;
  created_time?: string;
};

/**
 * Fetch a catalog item from NeoDB by an external site URL (Douban, Bangumi, etc.).
 * Retries when NeoDB returns 202 / no uuid yet (fetch in progress).
 */
export async function fetchNeodbItemByUrl(
  url: string,
  retries = 3,
): Promise<NeodbItem | null> {
  consola.info('Going to fetch NeoDB item: ', url);
  try {
    const neodbItem = (await got('https://neodb.social/api/catalog/fetch', {
      searchParams: { url },
      headers: { accept: 'application/json' },
    }).json()) as NeodbItem;

    if (neodbItem.uuid) {
      return neodbItem;
    }

    if (retries <= 0) {
      consola.warn('NeoDB item still not ready after retries: ', url);
      return null;
    }

    await sleep(1500);
    return fetchNeodbItemByUrl(url, retries - 1);
  } catch (error: any) {
    consola.error('Fetch NeoDB item with error: ', error.code ?? error.message);
    return null;
  }
}

/**
 * Get current user's mark for a NeoDB item. Returns null if not marked.
 */
export async function getNeodbMark(uuid: string): Promise<NeodbMark | null> {
  if (!neodbToken) {
    return null;
  }

  try {
    return (await got(`https://neodb.social/api/me/shelf/item/${uuid}`, {
      headers: {
        Authorization: `Bearer ${neodbToken}`,
        accept: 'application/json',
      },
    }).json()) as NeodbMark;
  } catch (error: any) {
    if (error.code === 'ERR_NON_2XX_3XX_RESPONSE') {
      return null;
    }
    consola.error("Query item's mark with error code: ", error.code);
    return null;
  }
}

export type MarkNeodbOptions = {
  shelfType: ItemStatus | string;
  comment?: string | null;
  /** Douban 1–5 stars; will be converted to 0–10 grade. Pass null to clear. */
  rating?: number | null;
  /** Already in NeoDB 0–10 scale. Takes precedence over rating when set. */
  ratingGrade?: number | null;
  createdTime?: string | null;
  visibility?: number;
};

/**
 * Mark (create or update) an item on the current user's NeoDB shelf.
 */
export async function markNeodbItem(
  neodbItem: NeodbItem,
  options: MarkNeodbOptions,
): Promise<boolean> {
  if (!neodbToken) {
    return false;
  }

  const label = `${neodbItem.title || neodbItem.display_title}[${neodbItem.uuid}]`;
  consola.info('Going to mark on NeoDB: ', label);

  let ratingGrade = 0;
  if (options.ratingGrade != null) {
    ratingGrade = options.ratingGrade;
  } else if (options.rating) {
    ratingGrade = options.rating * 2;
  }

  try {
    await got.post(`https://neodb.social/api/me/shelf/item/${neodbItem.uuid}`, {
      headers: {
        Authorization: `Bearer ${neodbToken}`,
        accept: 'application/json',
      },
      json: {
        shelf_type: options.shelfType,
        visibility: options.visibility ?? neodbVisibility,
        comment_text: options.comment || '',
        rating_grade: ratingGrade,
        created_time: options.createdTime || undefined,
        post_to_fediverse: false,
      },
    });
    return true;
  } catch (error) {
    consola.error('Failed to mark item: ', neodbItem?.title, ' with error: ', error);
    return false;
  }
}

/**
 * Sync a FeedItem to NeoDB: fetch by link, compare mark, update if needed.
 */
export async function syncFeedItemToNeodb(item: FeedItem): Promise<void> {
  const neodbItem = await fetchNeodbItemByUrl(item.link);
  if (!neodbItem?.uuid) {
    return;
  }

  consola.info('Going to check item mark status: ', `${neodbItem.title}[${item.link}]`);

  const mark = await getNeodbMark(neodbItem.uuid);
  if (!mark) {
    consola.info(
      'Item is not marked, going to mark now: ',
      `${neodbItem.title}[${item.link}]`,
    );
    await markNeodbItem(neodbItem, {
      shelfType: item.status,
      comment: item.comment,
      rating: item.rating,
      createdTime: item.time,
    });
    return;
  }

  // Preserve NeoDB statuses Douban RSS cannot express (e.g. dropped ← Bangumi 搁置/抛弃).
  const existingStatus = mark.shelf_type as ItemStatus;
  if (existingStatus && !DOUBAN_EXPRESSED_STATUSES.has(existingStatus)) {
    consola.info(
      'NeoDB has Douban-absent status, skip overwrite: ',
      `${neodbItem.title}[${item.link}] shelf_type=${mark.shelf_type}`,
    );
    return;
  }

  const desiredGrade = item.rating ? item.rating * 2 : 0;
  const sameStatus = mark.shelf_type === item.status;
  const sameComment = (mark.comment_text || '') === (item.comment || '');
  const sameRating = (mark.rating_grade || 0) === desiredGrade;

  if (sameStatus && sameComment && sameRating) {
    consola.info('NeoDB mark unchanged, skip: ', `${neodbItem.title}[${item.link}]`);
    return;
  }

  consola.info(
    'Item mark changed, going to update: ',
    `${neodbItem.title}[${item.link}]`,
  );
  await markNeodbItem(neodbItem, {
    shelfType: item.status,
    comment: item.comment,
    rating: item.rating,
    createdTime: item.time,
  });
}

/**
 * Extract Bangumi subject id from NeoDB external_resources.
 */
export function extractBangumiIdFromNeodb(neodbItem: NeodbItem): number | null {
  const resources = neodbItem.external_resources || [];
  for (const resource of resources) {
    const match = resource.url?.match(/(?:bgm\.tv|bangumi\.tv)\/subject\/(\d+)/i);
    if (match?.[1]) {
      return Number(match[1]);
    }
  }
  return null;
}

/**
 * Extract a Douban subject/game URL from NeoDB external_resources.
 */
export function extractDoubanUrlFromNeodb(neodbItem: NeodbItem): string | null {
  const resources = neodbItem.external_resources || [];
  for (const resource of resources) {
    const url = resource.url;
    if (!url) continue;
    if (
      /(?:movie|book|music)\.douban\.com\/subject\/\d+/i.test(url) ||
      /(?:www\.)?douban\.com\/(?:game|location\/drama)\/\d+/i.test(url)
    ) {
      return url;
    }
  }
  return null;
}

/**
 * Resolve NeoDB catalog item for a Bangumi URL, preferring the Douban-linked
 * twin when NeoDB has separate entries for the same work.
 * This keeps Bangumi→NeoDB marks on the same uuid as Douban→NeoDB.
 */
export async function resolveNeodbItemForBangumiUrl(
  bangumiUrl: string,
): Promise<NeodbItem | null> {
  const fromBangumi = await fetchNeodbItemByUrl(bangumiUrl);
  if (!fromBangumi?.uuid) {
    return null;
  }

  const doubanUrl = extractDoubanUrlFromNeodb(fromBangumi);
  if (!doubanUrl) {
    return fromBangumi;
  }

  const fromDouban = await fetchNeodbItemByUrl(doubanUrl);
  if (!fromDouban?.uuid || fromDouban.uuid === fromBangumi.uuid) {
    return fromBangumi;
  }

  consola.info(
    'NeoDB has separate Douban/Bangumi catalog entries; prefer Douban twin: ',
    `${fromBangumi.uuid} → ${fromDouban.uuid}`,
  );
  return fromDouban;
}
