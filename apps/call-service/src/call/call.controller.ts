import { Controller } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status as GrpcStatus } from '@grpc/grpc-js';
import type { InferSelectModel } from 'drizzle-orm';
import { calls, callParticipants } from '@aluf/db';
import {
  AlufError,
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from '@aluf/shared';
import { CallService } from './call.service';

type CallRow = InferSelectModel<typeof calls>;
type CallParticipantRow = InferSelectModel<typeof callParticipants>;

function toGrpcError(err: unknown): RpcException {
  if (err instanceof AlufError) {
    let code = GrpcStatus.INTERNAL;
    if (err instanceof BadRequestError) code = GrpcStatus.INVALID_ARGUMENT;
    else if (err instanceof NotFoundError) code = GrpcStatus.NOT_FOUND;
    else if (err instanceof ForbiddenError) code = GrpcStatus.PERMISSION_DENIED;
    return new RpcException({ code, message: err.message });
  }
  return new RpcException({
    code: GrpcStatus.INTERNAL,
    message: err instanceof Error ? err.message : 'Internal server error',
  });
}

function toGrpcTimestamp(date: Date): { seconds: number; nanos: number } {
  const ms = date.getTime();
  return { seconds: Math.floor(ms / 1000), nanos: (ms % 1000) * 1_000_000 };
}

function toOptionalTimestamp(date: Date | null): { seconds: number; nanos: number } | undefined {
  return date ? toGrpcTimestamp(date) : undefined;
}

function computeDurationSeconds(startedAt: Date | null, endedAt: Date | null): number {
  if (!startedAt || !endedAt) return 0;
  return Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000));
}

const DB_TO_PROTO_CALL_TYPE: Record<string, number> = { voice: 1, video: 2 };
const PROTO_TO_DB_CALL_TYPE: Record<number, string> = { 1: 'voice', 2: 'video' };
const DB_TO_PROTO_STATUS: Record<string, number> = {
  ringing: 1,
  active: 2,
  ended: 3,
  missed: 4,
  declined: 5,
  busy: 6,
};

function mapParticipantToProto(p: CallParticipantRow) {
  return {
    userId: p.userId,
    isMuted: p.isMuted,
    isVideoOn: p.isVideoEnabled,
    isScreenSharing: p.isScreenSharing,
    joinedAt: toGrpcTimestamp(p.joinedAt),
  };
}

/** Соответствует `CallResponse` в `call.proto` (camelCase при keepCase: false). */
function buildCallResponse(call: CallRow, participants: CallParticipantRow[], roomName: string) {
  return {
    id: call.id,
    chatId: call.chatId,
    callerId: call.initiatorId,
    type: DB_TO_PROTO_CALL_TYPE[call.type] ?? 0,
    status: DB_TO_PROTO_STATUS[call.status] ?? 0,
    participants: participants.map(mapParticipantToProto),
    durationSeconds: computeDurationSeconds(call.startedAt, call.endedAt),
    startedAt: toOptionalTimestamp(call.startedAt),
    endedAt: toOptionalTimestamp(call.endedAt),
    createdAt: toGrpcTimestamp(call.createdAt),
    roomName,
    isGroup: call.isGroup,
  };
}

@Controller()
export class CallController {
  constructor(private readonly callService: CallService) {}

  @GrpcMethod('CallService', 'InitiateCall')
  async initiateCall(data: {
    chatId: string;
    initiatorId?: string;
    callerId?: string;
    caller_id?: string;
    userId?: string;
    type: number | string;
    isGroup?: boolean;
  }) {
    try {
      const STRING_TO_DB: Record<string, string> = {
        voice: 'voice',
        video: 'video',
        call_type_voice: 'voice',
        call_type_video: 'video',
        '1': 'voice',
        '2': 'video',
      };
      const t = data.type;
      const asNum = typeof t === 'string' && /^\d+$/.test(t) ? Number(t) : t;
      let dbType =
        PROTO_TO_DB_CALL_TYPE[asNum as number] ??
        STRING_TO_DB[String(asNum).toLowerCase()] ??
        STRING_TO_DB[String(t).toLowerCase()];
      if (!dbType && typeof t === 'string') {
        const u = t.toUpperCase();
        if (u.includes('VOICE')) dbType = 'voice';
        else if (u.includes('VIDEO')) dbType = 'video';
      }
      if (!dbType) throw new BadRequestError('Invalid call type');
      const initiatorId = data.initiatorId || data.callerId || data.caller_id || data.userId || '';

      const { roomName, ...call } = await this.callService.initiateCall(
        data.chatId,
        initiatorId,
        dbType,
        Boolean(data.isGroup),
      );

      const { call: fullCall, participants } = await this.callService.getCall(call.id);
      return buildCallResponse(fullCall, participants, roomName);
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('CallService', 'JoinCall')
  async joinCall(data: { callId: string; userId: string }) {
    try {
      await this.callService.joinCall(data.callId, data.userId);
      const { call, participants } = await this.callService.getCall(data.callId);
      return buildCallResponse(call, participants, `call_${call.id}`);
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('CallService', 'LeaveCall')
  async leaveCall(data: { callId: string; userId: string }) {
    try {
      await this.callService.leaveCall(data.callId, data.userId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('CallService', 'EndCall')
  async endCall(data: { callId: string; userId: string }) {
    try {
      await this.callService.endCall(data.callId, data.userId);
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('CallService', 'GetCall')
  async getCall(data: { callId: string }) {
    try {
      const { call, participants } = await this.callService.getCall(data.callId);
      return buildCallResponse(call, participants, `call_${call.id}`);
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('CallService', 'GetCallToken')
  async getCallToken(data: { callId: string; userId: string; username: string; displayName?: string }) {
    try {
      const { token, roomName, livekitUrl } = await this.callService.getCallToken(
        data.callId,
        data.userId,
        data.username,
        data.displayName,
      );
      return { token, roomName, livekitUrl };
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('CallService', 'Signal')
  async signal(data: {
    callId: string;
    fromUserId: string;
    toUserId: string;
    signalType: string;
    payload: string;
  }) {
    try {
      await this.callService.signal(
        data.callId,
        data.fromUserId,
        data.toUserId,
        data.signalType,
        data.payload,
      );
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }

  @GrpcMethod('CallService', 'BroadcastSignal')
  async broadcastSignal(data: {
    callId: string;
    fromUserId: string;
    signalType: string;
    payload: string;
  }) {
    try {
      await this.callService.broadcastSignal(
        data.callId,
        data.fromUserId,
        data.signalType,
        data.payload,
      );
      return {};
    } catch (err) {
      throw toGrpcError(err);
    }
  }
}
