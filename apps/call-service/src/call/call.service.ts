import { Injectable, Inject } from '@nestjs/common';
import { eq, and, isNull } from 'drizzle-orm';
import { calls, callParticipants, chatMembers } from '@aluf/db';
import { NotFoundError, BadRequestError, NATS_SUBJECTS } from '@aluf/shared';
import { DATABASE_TOKEN, type DrizzleDB } from '../providers/database.provider';
import { NATS_TOKEN, type NatsConnection } from '../providers/nats.provider';
import { StringCodec } from 'nats';

@Injectable()
export class CallService {
  private readonly sc = StringCodec();

  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: DrizzleDB,
    @Inject(NATS_TOKEN) private readonly nats: NatsConnection,
  ) {}

  private publish(subject: string, data: unknown): void {
    this.nats.publish(subject, this.sc.encode(JSON.stringify(data)));
  }

  private parseSignalPayload(payload: string): unknown {
    try {
      return JSON.parse(payload) as unknown;
    } catch {
      return payload;
    }
  }

  async initiateCall(chatId: string, initiatorId: string, type: string, isGroup: boolean) {
    const callId = crypto.randomUUID();
    const roomName = `call_${callId}`;

    const [call] = await this.db
      .insert(calls)
      .values({ id: callId, chatId, initiatorId, type: type as 'voice' | 'video', isGroup })
      .returning();

    await this.db.insert(callParticipants).values({
      callId: call.id,
      userId: initiatorId,
    });

    const members = await this.db
      .select({ userId: chatMembers.userId })
      .from(chatMembers)
      .where(eq(chatMembers.chatId, chatId));

    const recipientIds = members
      .map((m) => m.userId)
      .filter((id) => id !== initiatorId);

    this.publish(NATS_SUBJECTS.CALL_SIGNAL, {
      type: 'incoming',
      callId: call.id,
      roomName,
      chatId,
      initiatorId,
      callType: type,
      isGroup,
      recipientIds,
    });

    return { ...call, roomName };
  }

  async joinCall(callId: string, userId: string) {
    const call = await this.requireCall(callId);

    if (call.status === 'ended' || call.status === 'missed' || call.status === 'declined') {
      throw new BadRequestError('Звонок уже завершён');
    }

    const [participant] = await this.db
      .insert(callParticipants)
      .values({ callId, userId })
      .onConflictDoNothing()
      .returning();

    if (!participant) {
      const [existing] = await this.db
        .select()
        .from(callParticipants)
        .where(and(eq(callParticipants.callId, callId), eq(callParticipants.userId, userId)))
        .limit(1);
      return existing;
    }

    if (call.status === 'ringing') {
      await this.db
        .update(calls)
        .set({ status: 'active', startedAt: new Date() })
        .where(eq(calls.id, callId));
    }

    this.publish(NATS_SUBJECTS.CALL_SIGNAL, {
      type: 'participant_joined',
      callId,
      userId,
    });

    /** Уведомляем инициатора, что второй участник вошёл — клиент начинает WebRTC offer. */
    if (participant && call.initiatorId && call.initiatorId !== userId) {
      this.publish(NATS_SUBJECTS.CALL_SIGNAL, {
        type: 'participant_joined',
        callId,
        fromUserId: userId,
        toUserId: call.initiatorId,
        payload: {},
      });
    }

    return participant;
  }

  async leaveCall(callId: string, userId: string) {
    await this.requireCall(callId);

    const now = new Date();
    await this.db
      .update(callParticipants)
      .set({ leftAt: now })
      .where(
        and(
          eq(callParticipants.callId, callId),
          eq(callParticipants.userId, userId),
          isNull(callParticipants.leftAt),
        ),
      );

    this.publish(NATS_SUBJECTS.CALL_SIGNAL, {
      type: 'participant_left',
      callId,
      userId,
    });

    const remaining = await this.db
      .select({ userId: callParticipants.userId })
      .from(callParticipants)
      .where(and(eq(callParticipants.callId, callId), isNull(callParticipants.leftAt)));

    if (remaining.length === 0) {
      await this.endCallInternal(callId);
    }
  }

  async endCall(callId: string, _userId: string) {
    await this.requireCall(callId);
    await this.endCallInternal(callId);
  }

  async getCall(callId: string) {
    const call = await this.requireCall(callId);

    const participants = await this.db
      .select()
      .from(callParticipants)
      .where(eq(callParticipants.callId, callId));

    return { call, participants };
  }

  /**
   * Метаданные для WebRTC: имя комнаты (логическое) и STUN. Токен не используется (сигналинг через WS).
   */
  async getCallToken(callId: string, userId: string, _username: string, _displayName?: string) {
    await this.requireCall(callId);

    const participant = await this.db
      .select()
      .from(callParticipants)
      .where(
        and(
          eq(callParticipants.callId, callId),
          eq(callParticipants.userId, userId),
        ),
      )
      .limit(1);

    if (participant.length === 0) {
      throw new BadRequestError('Вы не участвуете в этом звонке');
    }

    const roomName = `call_${callId}`;

    return { token: '', roomName, livekitUrl: '' };
  }

  async signal(
    callId: string,
    fromUserId: string,
    toUserId: string,
    signalType: string,
    payload: string,
  ) {
    await this.requireCall(callId);

    // Проверяем, что пользователь является участником звонка
    const participant = await this.db
      .select()
      .from(callParticipants)
      .where(
        and(
          eq(callParticipants.callId, callId),
          eq(callParticipants.userId, fromUserId),
          isNull(callParticipants.leftAt),
        ),
      )
      .limit(1);

    if (participant.length === 0) {
      throw new BadRequestError('Вы не участвуете в этом звонке');
    }

    // Обновляем статус звонка на active если он ещё ringing
    const call = await this.requireCall(callId);
    if (call.status === 'ringing') {
      await this.db
        .update(calls)
        .set({ status: 'active', startedAt: new Date() })
        .where(eq(calls.id, callId));
    }

    this.publish(NATS_SUBJECTS.CALL_SIGNAL, {
      type: signalType,
      callId,
      fromUserId,
      toUserId,
      payload: this.parseSignalPayload(payload),
    });
  }

  /**
   * Отправка сигнала всем участникам звонка (для групповых звонков)
   */
  async broadcastSignal(
    callId: string,
    fromUserId: string,
    signalType: string,
    payload: string,
  ) {
    await this.requireCall(callId);

    const participants = await this.db
      .select({ userId: callParticipants.userId })
      .from(callParticipants)
      .where(
        and(
          eq(callParticipants.callId, callId),
          isNull(callParticipants.leftAt),
        ),
      );

    const otherParticipants = participants
      .map((p) => p.userId)
      .filter((id) => id !== fromUserId);

    for (const toUserId of otherParticipants) {
      this.publish(NATS_SUBJECTS.CALL_SIGNAL, {
        type: signalType,
        callId,
        fromUserId,
        toUserId,
        payload: this.parseSignalPayload(payload),
      });
    }
  }

  private async endCallInternal(callId: string) {
    const now = new Date();

    await this.db
      .update(calls)
      .set({ status: 'ended', endedAt: now })
      .where(eq(calls.id, callId));

    await this.db
      .update(callParticipants)
      .set({ leftAt: now })
      .where(and(eq(callParticipants.callId, callId), isNull(callParticipants.leftAt)));

    this.publish(NATS_SUBJECTS.CALL_SIGNAL, {
      type: 'call_ended',
      callId,
    });
  }

  private async requireCall(callId: string) {
    const [call] = await this.db
      .select()
      .from(calls)
      .where(eq(calls.id, callId))
      .limit(1);

    if (!call) {
      throw new NotFoundError('Call', callId);
    }
    return call;
  }
}
