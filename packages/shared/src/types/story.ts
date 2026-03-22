export type StoryPrivacy = 'everyone' | 'contacts' | 'selected' | 'except';

export interface Story {
  id: string;
  userId: string;
  mediaId: string;
  caption: string | null;
  privacy: StoryPrivacySettings;
  viewCount: number;
  expiresAt: Date;
  createdAt: Date;
}

export interface StoryPrivacySettings {
  level: StoryPrivacy;
  allowedUserIds?: string[];
  excludedUserIds?: string[];
}

export interface StoryView {
  storyId: string;
  viewerId: string;
  viewedAt: Date;
  reaction: string | null;
}
