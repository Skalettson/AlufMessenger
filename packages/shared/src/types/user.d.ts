export interface User {
    id: string;
    alufId: bigint;
    username: string;
    displayName: string;
    phone: string | null;
    email: string | null;
    avatarUrl: string | null;
    bio: string | null;
    statusText: string | null;
    statusEmoji: string | null;
    isPremium: boolean;
    isAnonymous: boolean;
    createdAt: Date;
    lastSeenAt: Date | null;
}
export interface UserProfile {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
    statusText: string | null;
    statusEmoji: string | null;
    isPremium: boolean;
    lastSeenAt: Date | null;
    isOnline: boolean;
}
export interface Contact {
    userId: string;
    contactUserId: string;
    customName: string | null;
    isBlocked: boolean;
    isMuted: boolean;
    createdAt: Date;
}
export interface PrivacySettings {
    phoneVisibility: PrivacyLevel;
    lastSeenVisibility: PrivacyLevel;
    avatarVisibility: PrivacyLevel;
    bioVisibility: PrivacyLevel;
    callsAllowed: PrivacyLevel;
    groupInvitesAllowed: PrivacyLevel;
    forwardedMessageLink: boolean;
}
export type PrivacyLevel = 'everyone' | 'contacts' | 'nobody';
export interface Session {
    id: string;
    userId: string;
    deviceInfo: DeviceInfo;
    ip: string;
    createdAt: Date;
    lastActiveAt: Date;
    expiresAt: Date;
}
export interface DeviceInfo {
    platform: 'android' | 'ios' | 'web' | 'desktop' | 'bot';
    deviceName: string;
    appVersion: string;
    osVersion: string | null;
}
//# sourceMappingURL=user.d.ts.map