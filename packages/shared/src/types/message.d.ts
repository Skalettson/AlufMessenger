export type ContentType = 'text' | 'image' | 'video' | 'audio' | 'voice' | 'video_note' | 'document' | 'sticker' | 'gif' | 'location' | 'live_location' | 'contact' | 'poll' | 'system';
export type MessageDeliveryStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
export interface Message {
    id: string;
    chatId: string;
    senderId: string;
    replyToId: string | null;
    forwardFromId: string | null;
    forwardFromChatId: string | null;
    contentType: ContentType;
    textContent: string | null;
    mediaId: string | null;
    metadata: MessageMetadata;
    isEdited: boolean;
    isPinned: boolean;
    selfDestructAt: Date | null;
    createdAt: Date;
    editedAt: Date | null;
}
export interface MessageMetadata {
    entities?: TextEntity[];
    poll?: PollData;
    location?: LocationData;
    contact?: ContactData;
    reactions?: ReactionSummary;
    viewCount?: number;
    threadId?: string;
}
export interface TextEntity {
    type: 'bold' | 'italic' | 'code' | 'pre' | 'link' | 'mention' | 'hashtag' | 'strikethrough' | 'underline' | 'spoiler';
    offset: number;
    length: number;
    url?: string;
    userId?: string;
    language?: string;
}
export interface PollData {
    question: string;
    options: PollOption[];
    isAnonymous: boolean;
    allowsMultipleAnswers: boolean;
    isQuiz: boolean;
    correctOptionIndex?: number;
    explanation?: string;
    closeDate?: Date;
}
export interface PollOption {
    text: string;
    voterCount: number;
}
export interface LocationData {
    latitude: number;
    longitude: number;
    accuracy?: number;
    livePeriod?: number;
    heading?: number;
}
export interface ContactData {
    phoneNumber: string;
    firstName: string;
    lastName?: string;
    userId?: string;
}
export interface ReactionSummary {
    reactions: ReactionCount[];
    totalCount: number;
}
export interface ReactionCount {
    emoji: string;
    count: number;
    userReacted: boolean;
}
export interface MessageStatusUpdate {
    messageId: string;
    chatId: string;
    userId: string;
    status: MessageDeliveryStatus;
    timestamp: Date;
}
//# sourceMappingURL=message.d.ts.map