export const STORY_STATUS_VALUES = [
  'DRAFT',
  'REVIEW',
  'PUBLISHED',
  'ARCHIVED',
] as const;
export type StoryStatusValue = (typeof STORY_STATUS_VALUES)[number];

export const STORY_VISIBILITY_VALUES = [
  'PRIVATE',
  'UNLISTED',
  'PUBLIC',
] as const;
export type StoryVisibilityValue = (typeof STORY_VISIBILITY_VALUES)[number];
