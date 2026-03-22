import type { Message, MessageDeliveryStatus } from './message';
export interface WsClientEvents {
    'authenticate': {
        token: string;
    };
    'message.send': {
        chatId: string;
        contentType: string;
        textContent?: string;
        mediaId?: string;
        replyToId?: string;
        metadata?: Record<string, unknown>;
    };
    'message.edit': {
        messageId: string;
        textContent: string;
    };
    'message.delete': {
        messageId: string;
        deleteForAll: boolean;
    };
    'message.read': {
        chatId: string;
        messageId: string;
    };
    'typing.start': {
        chatId: string;
    };
    'typing.stop': {
        chatId: string;
    };
    'presence.update': {
        status: 'online' | 'away';
    };
    'call.signal': {
        callId: string;
        type: string;
        payload: Record<string, unknown>;
    };
}
export interface WsServerEvents {
    'authenticated': {
        userId: string;
        sessionId: string;
    };
    'error': {
        code: string;
        message: string;
    };
    'message.new': {
        message: Message;
    };
    'message.updated': {
        message: Message;
    };
    'message.deleted': {
        messageId: string;
        chatId: string;
        deletedForAll: boolean;
    };
    'message.status': {
        messageId: string;
        chatId: string;
        userId: string;
        status: MessageDeliveryStatus;
        timestamp: string;
    };
    'typing': {
        chatId: string;
        userId: string;
        action: 'start' | 'stop';
    };
    'presence': {
        userId: string;
        status: 'online' | 'offline';
        lastSeenAt: string | null;
    };
    'call.incoming': {
        callId: string;
        callerId: string;
        chatId: string;
        type: 'voice' | 'video';
        isGroup: boolean;
    };
    'call.signal': {
        callId: string;
        fromUserId: string;
        type: string;
        payload: Record<string, unknown>;
    };
    'call.ended': {
        callId: string;
        reason: string;
    };
    'notification': {
        type: string;
        payload: Record<string, unknown>;
    };
}
//# sourceMappingURL=ws-events.d.ts.map