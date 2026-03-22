import { Controller } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status as GrpcStatus } from '@grpc/grpc-js';
import {
  AlufError,
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
} from '@aluf/shared';
import { NotificationService } from './notification.service';
import type {
  NotificationType,
  TokenPlatform,
  UserPreferences,
} from './notification.service';

const PROTO_TYPE_TO_INTERNAL: Record<number, NotificationType> = {
  0: 'system',
  1: 'message',
  2: 'mention',
  3: 'reaction',
  4: 'call',
  5: 'group_invite',
  6: 'contact_joined',
  7: 'story',
  8: 'system',
};

const PROTO_PLATFORM_TO_INTERNAL: Record<number, TokenPlatform> = {
  1: 'fcm',
  2: 'apns',
  3: 'web_push',
};

function structToObject(struct: { fields?: Record<string, { [key: string]: unknown }> } | null | undefined): Record<string, string> {
  if (!struct?.fields) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(struct.fields)) {
    if (v?.stringValue !== undefined) out[k] = String(v.stringValue);
    else if (v?.numberValue !== undefined) out[k] = String(v.numberValue);
    else if (v?.boolValue !== undefined) out[k] = String(v.boolValue);
  }
  return out;
}

function toGrpcError(err: unknown): RpcException {
  if (err instanceof AlufError) {
    let code = GrpcStatus.INTERNAL;
    if (err instanceof BadRequestError) code = GrpcStatus.INVALID_ARGUMENT;
    else if (err instanceof ForbiddenError) code = GrpcStatus.PERMISSION_DENIED;
    else if (err instanceof UnauthorizedError) code = GrpcStatus.UNAUTHENTICATED;
    return new RpcException({ code, message: err.message });
  }
  return new RpcException({
    code: GrpcStatus.INTERNAL,
    message: err instanceof Error ? err.message : 'Internal server error',
  });
}

function prefsToProto(prefs: UserPreferences) {
  return {
    messagesEnabled: prefs.messagesEnabled,
    mentionsEnabled: prefs.mentionsEnabled,
    reactionsEnabled: prefs.reactionsEnabled,
    callsEnabled: prefs.callsEnabled,
    groupInvitesEnabled: prefs.groupInvitesEnabled,
    contactJoinedEnabled: prefs.contactJoinedEnabled,
    storiesEnabled: prefs.storiesEnabled,
    showPreview: prefs.showPreview,
    defaultSound: prefs.defaultSound,
    vibrate: prefs.vibrate,
    ledEnabled: prefs.ledEnabled,
    ledColor: prefs.ledColor,
    chatOverrides: [],
  };
}

@Controller()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @GrpcMethod('NotificationService', 'SendNotification')
  async sendNotification(data: {
    recipientIds?: string[];
    type?: number;
    title?: string;
    body?: string;
    iconUrl?: string;
    actionUrl?: string;
    chatId?: string;
    messageId?: string;
    senderId?: string;
    data?: { fields?: Record<string, { [key: string]: unknown }> };
    badgeCount?: number;
    sound?: string;
    silent?: boolean;
  }) {
    try {
      const recipientIds = data.recipientIds ?? [];
      if (recipientIds.length === 0) return {};

      const type = PROTO_TYPE_TO_INTERNAL[data.type ?? 0] ?? 'system';
      const title = data.title ?? '';
      const body = data.body ?? '';

      await this.notificationService.sendNotification({
        recipientIds,
        type,
        title,
        body,
        iconUrl: data.iconUrl,
        actionUrl: data.actionUrl,
        chatId: data.chatId,
        messageId: data.messageId,
        senderId: data.senderId,
        data: structToObject(data.data),
        badgeCount: data.badgeCount,
        sound: data.sound,
        silent: data.silent ?? false,
      });
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('NotificationService', 'RegisterToken')
  async registerToken(data: {
    userId?: string;
    token?: string;
    platform?: number;
    deviceId?: string;
  }) {
    try {
      const userId = data.userId;
      const token = data.token;
      if (!userId || !token) {
        throw new BadRequestError('userId and token are required');
      }
      const platform = PROTO_PLATFORM_TO_INTERNAL[data.platform ?? 0] ?? 'fcm';
      await this.notificationService.registerToken(
        userId,
        token,
        platform,
        data.deviceId,
      );
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('NotificationService', 'UnregisterToken')
  async unregisterToken(data: {
    userId?: string;
    token?: string;
    deviceId?: string;
  }) {
    try {
      const userId = data.userId;
      const token = data.token;
      if (!userId) {
        throw new BadRequestError('userId is required');
      }
      if (token) {
        await this.notificationService.unregisterToken(userId, token);
      } else {
        throw new BadRequestError('token is required');
      }
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('NotificationService', 'UpdatePreferences')
  async updatePreferences(data: {
    userId?: string;
    preferences?: {
      messagesEnabled?: boolean;
      mentionsEnabled?: boolean;
      reactionsEnabled?: boolean;
      callsEnabled?: boolean;
      groupInvitesEnabled?: boolean;
      contactJoinedEnabled?: boolean;
      storiesEnabled?: boolean;
      showPreview?: boolean;
      defaultSound?: string;
      vibrate?: boolean;
      ledEnabled?: boolean;
      ledColor?: string;
    };
  }) {
    try {
      const userId = data.userId;
      if (!userId) {
        throw new BadRequestError('userId is required');
      }
      const prefs = data.preferences ?? {};
      await this.notificationService.updatePreferences(userId, {
        messagesEnabled: prefs.messagesEnabled,
        mentionsEnabled: prefs.mentionsEnabled,
        reactionsEnabled: prefs.reactionsEnabled,
        callsEnabled: prefs.callsEnabled,
        groupInvitesEnabled: prefs.groupInvitesEnabled,
        contactJoinedEnabled: prefs.contactJoinedEnabled,
        storiesEnabled: prefs.storiesEnabled,
        showPreview: prefs.showPreview,
        defaultSound: prefs.defaultSound,
        vibrate: prefs.vibrate,
        ledEnabled: prefs.ledEnabled,
        ledColor: prefs.ledColor,
      });
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('NotificationService', 'GetPreferences')
  async getPreferences(data: { userId?: string }) {
    try {
      const userId = data.userId;
      if (!userId) {
        throw new BadRequestError('userId is required');
      }
      const prefs = await this.notificationService.getUserPreferences(userId);
      return prefsToProto(prefs);
    } catch (err) {
      throw toGrpcError(err);
    }
  }
}
