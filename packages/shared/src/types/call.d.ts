export type CallType = 'voice' | 'video';
export type CallStatus = 'ringing' | 'active' | 'ended' | 'missed' | 'declined' | 'busy';
export interface Call {
    id: string;
    chatId: string;
    initiatorId: string;
    type: CallType;
    isGroup: boolean;
    status: CallStatus;
    participants: CallParticipant[];
    startedAt: Date | null;
    endedAt: Date | null;
    createdAt: Date;
}
export interface CallParticipant {
    userId: string;
    joinedAt: Date;
    leftAt: Date | null;
    isMuted: boolean;
    isVideoEnabled: boolean;
    isScreenSharing: boolean;
}
export interface CallSignal {
    callId: string;
    fromUserId: string;
    toUserId: string;
    type: 'offer' | 'answer' | 'ice-candidate' | 'hangup' | 'mute' | 'unmute';
    payload: Record<string, unknown>;
}
export interface VoiceRoom {
    id: string;
    chatId: string;
    title: string;
    createdBy: string;
    participants: VoiceRoomParticipant[];
    isActive: boolean;
    createdAt: Date;
}
export interface VoiceRoomParticipant {
    userId: string;
    isSpeaker: boolean;
    isMuted: boolean;
    raisedHand: boolean;
    joinedAt: Date;
}
//# sourceMappingURL=call.d.ts.map