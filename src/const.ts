import {
  type DB_PROPERTIES_KEYS,
  NotionPropTypesEnum,
  ItemStatus,
  ItemCategory,
  type BangumiSubjectType,
  type BangumiCollectionType,
  type NeodbProgressType,
} from './types';

export const ALL_STATUS =
  /^(?:最近)?(看过|听过|读过|玩过|在看|在听|在读|在玩|想看|想听|想读|想玩)/;

/** Strip Douban RSS status prefix to get the item title. */
export const STATUS_TITLE_PREFIX =
  /^(?:最近)?(?:看过|听过|读过|玩过|在看|在听|在读|在玩|想看|想听|想读|想玩)\s*/;

export const RATING_TEXT = {
  很差: 1,
  较差: 2,
  还行: 3,
  推荐: 4,
  力荐: 5,
};

export const SeeState = {
  看过: ItemStatus.Complete,
  在看: ItemStatus.Progress,
  想看: ItemStatus.Wishlist,
};

export const ReadState = {
  读过: ItemStatus.Complete,
  在读: ItemStatus.Progress,
  想读: ItemStatus.Wishlist,
};

export const PlayState = {
  玩过: ItemStatus.Complete,
  在玩: ItemStatus.Progress,
  想玩: ItemStatus.Wishlist,
};

export const ListenState = {
  听过: ItemStatus.Complete,
  在听: ItemStatus.Progress,
  想听: ItemStatus.Wishlist,
};

export const PropertyTypeMap: Record<DB_PROPERTIES_KEYS, NotionPropTypesEnum> = {
  POSTER: NotionPropTypesEnum.FILES,
  MOVIE_TITLE: NotionPropTypesEnum.TITLE,
  MUSIC_TITLE: NotionPropTypesEnum.TITLE,
  BOOK_TITLE: NotionPropTypesEnum.TITLE,
  GAME_TITLE: NotionPropTypesEnum.TITLE,
  DRAMA_TITLE: NotionPropTypesEnum.TITLE,
  COVER: NotionPropTypesEnum.FILES,
  RATING: NotionPropTypesEnum.MULTI_SELECT,
  RATING_DATE: NotionPropTypesEnum.DATE,
  COMMENTS: NotionPropTypesEnum.RICH_TEXT,
  YEAR: NotionPropTypesEnum.NUMBER,
  DIRECTORS: NotionPropTypesEnum.RICH_TEXT,
  SCREENWRITERS: NotionPropTypesEnum.RICH_TEXT,
  ACTORS: NotionPropTypesEnum.RICH_TEXT,
  GENRE: NotionPropTypesEnum.MULTI_SELECT,
  ITEM_LINK: NotionPropTypesEnum.URL,
  IMDB_LINK: NotionPropTypesEnum.URL,
  RELEASE_DATE: NotionPropTypesEnum.DATE,
  MUSICIAN: NotionPropTypesEnum.RICH_TEXT,
  PUBLICATION_DATE: NotionPropTypesEnum.DATE,
  PUBLISHING_HOUSE: NotionPropTypesEnum.RICH_TEXT,
  WRITER: NotionPropTypesEnum.RICH_TEXT,
  ISBN: NotionPropTypesEnum.NUMBER,
};

export const EMOJI = {
  movie: '🎞',
  music: '🎶',
  book: '📖',
  game: '🕹',
  drama: '💃🏻',
};

/** NeoDB / Douban shelf status → Bangumi CollectionType */
export const NEODB_TO_BANGUMI_COLLECTION: Record<ItemStatus, BangumiCollectionType> = {
  [ItemStatus.Wishlist]: 1,
  [ItemStatus.Complete]: 2,
  [ItemStatus.Progress]: 3,
  [ItemStatus.Dropped]: 5,
};

/** Bangumi CollectionType → NeoDB shelf_type */
export const BANGUMI_TO_NEODB_STATUS: Record<BangumiCollectionType, ItemStatus> = {
  1: ItemStatus.Wishlist,
  2: ItemStatus.Complete,
  3: ItemStatus.Progress,
  4: ItemStatus.Progress, // 搁置 → 在看/在玩（NeoDB 无搁置）
  5: ItemStatus.Dropped, // 抛弃 → dropped
};

/**
 * Statuses Douban RSS can express (想/在/过).
 * Destination statuses outside this set must not be overwritten by Douban→*.
 */
export const DOUBAN_EXPRESSED_STATUSES: ReadonlySet<ItemStatus> = new Set([
  ItemStatus.Wishlist,
  ItemStatus.Progress,
  ItemStatus.Complete,
]);

/**
 * Bangumi collection types with no Douban RSS equivalent (搁置 / 抛弃).
 * Douban→Bangumi should preserve these when already set.
 */
export const BANGUMI_STATUSES_ABSENT_FROM_DOUBAN: ReadonlySet<BangumiCollectionType> =
  new Set([4, 5]);

/**
 * Douban category → Bangumi subject type candidates for search filter.
 * Movie may be anime (2) or real (6); prefer both when searching.
 */
export const CATEGORY_TO_BANGUMI_TYPES: Partial<
  Record<ItemCategory, BangumiSubjectType[]>
> = {
  [ItemCategory.Book]: [1],
  [ItemCategory.Movie]: [2, 6],
  [ItemCategory.Music]: [3],
  [ItemCategory.Game]: [4],
  // Drama (话剧) has no Bangumi equivalent; only sync when NeoDB already has a Bangumi link.
};

export type NeodbProgressPayload = {
  type: NeodbProgressType;
  value: string;
};

/**
 * Map Bangumi collection progress to a single NeoDB progress pair.
 * Games are skipped. Zero counts are skipped (do not clear NeoDB progress).
 */
export function bangumiCollectionToNeodbProgress(collection: {
  subject_type: BangumiSubjectType;
  ep_status?: number;
  vol_status?: number;
}): NeodbProgressPayload | null {
  const ep = collection.ep_status ?? 0;
  const vol = collection.vol_status ?? 0;

  switch (collection.subject_type) {
    case 2:
    case 6:
      if (ep <= 0) return null;
      return { type: 'episode', value: String(ep) };
    case 1:
      if (vol > 0) return { type: 'chapter', value: String(vol) };
      if (ep > 0) return { type: 'chapter', value: String(ep) };
      return null;
    case 3:
      if (ep <= 0) return null;
      return { type: 'track', value: String(ep) };
    case 4:
    default:
      return null;
  }
}
