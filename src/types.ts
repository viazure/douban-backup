import Parser from 'rss-parser';
import DB_PROPERTIES from '../cols.json';

export type DB_PROPERTIES_KEYS = Exclude<keyof typeof DB_PROPERTIES, 'NAME'>;

export enum ItemCategory {
  Movie = 'movie',
  Music = 'music',
  Book = 'book',
  Game = 'game',
  Drama = 'drama',
}

// follow the schema value of Neodb
export enum ItemStatus {
  Wishlist = 'wishlist',
  Progress = 'progress',
  Complete = 'complete',
  Dropped = 'dropped',
}

export type RSSFeedItem = {
  [key: string]: any;
} & Parser.Item;

export type FeedItem = {
  id: string;
  link: string;
  title: string;
  rating: number | null;
  comment: string | null;
  time: string;
  status: ItemStatus;
  category: ItemCategory;
};

/** Bangumi SubjectType: 1 book, 2 anime, 3 music, 4 game, 6 real */
export type BangumiSubjectType = 1 | 2 | 3 | 4 | 6;

/** Bangumi CollectionType: 1 wish, 2 done, 3 doing, 4 on-hold, 5 dropped */
export type BangumiCollectionType = 1 | 2 | 3 | 4 | 5;

export enum NotionPropTypesEnum {
  TITLE = 'title',
  RICH_TEXT = 'rich_text',
  FILES = 'files',
  DATE = 'date',
  MULTI_SELECT = 'multi_select',
  NUMBER = 'number',
  URL = 'url',
}

export type NotionRichTextPropType = {
  id?: string;
  type: NotionPropTypesEnum.RICH_TEXT;
  rich_text: {
    type: 'text';
    text: {
      content: string;
    };
  }[];
};

export type NotionTitlePropType = {
  id?: 'title';
  type: NotionPropTypesEnum.TITLE;
  title: {
    text: {
      content: string;
    };
  }[];
};

export type NotionFilesPropType = {
  id?: string;
  type: NotionPropTypesEnum.FILES;
  files: {
    name: string;
    type: 'external';
    external: {
      url: string;
    };
  }[];
};

export type NotionDatePropType = {
  id?: string;
  type: NotionPropTypesEnum.DATE;
  date: {
    start: string;
    end: string | null;
    time_zone: string | null;
  };
};

export type NotionMultiSelectPropType = {
  id?: string;
  type: NotionPropTypesEnum.MULTI_SELECT;
  multi_select: {
    name: string;
  }[];
};

export type NotionNumberPropType = {
  id?: string;
  type: NotionPropTypesEnum.NUMBER;
  number: number | null;
};

export type NotionUrlPropType = {
  id?: string;
  type: NotionPropTypesEnum.URL;
  url: string;
};

export type NotionColPropTypes =
  | NotionRichTextPropType
  | NotionTitlePropType
  | NotionFilesPropType
  | NotionDatePropType
  | NotionMultiSelectPropType
  | NotionNumberPropType
  | NotionUrlPropType;

export type FailedItem = {
  link: string;
  title: string;
};
