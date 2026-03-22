import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CallService } from '../call.service';

const mockNats = {
  publish: vi.fn(),
};

const chainMethods = [
  'select', 'from', 'where', 'limit', 'insert', 'values',
  'returning', 'update', 'set', 'delete', 'onConflictDoNothing',
] as const;

const mockDb: any = {};
for (const m of chainMethods) {
  mockDb[m] = vi.fn(() => mockDb);
}
mockDb.then = vi.fn((resolve: any) => resolve?.([]));

function resetMockDb() {
  for (const m of chainMethods) {
    mockDb[m].mockImplementation(() => mockDb);
  }
  mockDb.then.mockImplementation((resolve: any) => resolve?.([]));
}

function mockResolve(value: any) {
  mockDb.then.mockImplementationOnce((resolve: any) => resolve?.(value));
}

const sampleCall = {
  id: 'call-1',
  chatId: 'chat-1',
  initiatorId: 'user-1',
  type: 'voice',
  isGroup: false,
  status: 'ringing',
  startedAt: null,
  endedAt: null,
  createdAt: new Date(),
};

describe('CallService', () => {
  let service: CallService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockDb();
    service = new CallService(mockDb as any, mockNats as any);
  });

  describe('initiateCall', () => {
    it('should create a call and notify chat members', async () => {
      mockResolve([sampleCall]);
      mockResolve(undefined);
      mockResolve([{ userId: 'user-1' }, { userId: 'user-2' }]);

      const result = await service.initiateCall('chat-1', 'user-1', 'voice', false);

      expect(result.id).toBe('call-1');
      expect(result.status).toBe('ringing');
      expect(mockNats.publish).toHaveBeenCalled();
    });

    it('should create a group call', async () => {
      const groupCall = { ...sampleCall, isGroup: true };
      mockResolve([groupCall]);
      mockResolve(undefined);
      mockResolve([
        { userId: 'user-1' },
        { userId: 'user-2' },
        { userId: 'user-3' },
      ]);

      const result = await service.initiateCall('chat-1', 'user-1', 'video', true);

      expect(result.isGroup).toBe(true);
    });

    it('should filter initiator from recipient list', async () => {
      mockResolve([sampleCall]);
      mockResolve(undefined);
      mockResolve([{ userId: 'user-1' }, { userId: 'user-2' }]);

      await service.initiateCall('chat-1', 'user-1', 'voice', false);

      const publishCall = mockNats.publish.mock.calls[0];
      const payload = JSON.parse(new TextDecoder().decode(publishCall[1]));
      expect(payload.recipientIds).not.toContain('user-1');
      expect(payload.recipientIds).toContain('user-2');
    });
  });

  describe('joinCall', () => {
    it('should throw when call is already ended', async () => {
      mockResolve([{ ...sampleCall, status: 'ended' }]);

      await expect(
        service.joinCall('call-1', 'user-2'),
      ).rejects.toThrow('завершён');
    });

    it('should throw for missed calls', async () => {
      mockResolve([{ ...sampleCall, status: 'missed' }]);

      await expect(
        service.joinCall('call-1', 'user-2'),
      ).rejects.toThrow('завершён');
    });

    it('should transition ringing call to active on join', async () => {
      const participant = { callId: 'call-1', userId: 'user-2', joinedAt: new Date(), leftAt: null };
      mockResolve([sampleCall]);
      mockResolve([participant]);
      mockResolve(undefined);

      const result = await service.joinCall('call-1', 'user-2');

      expect(result).toBeDefined();
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockNats.publish).toHaveBeenCalled();
    });

    it('should return existing participant if already joined', async () => {
      mockResolve([{ ...sampleCall, status: 'active' }]);
      mockResolve([]);
      mockResolve([{ callId: 'call-1', userId: 'user-2' }]);

      const result = await service.joinCall('call-1', 'user-2');

      expect(result).toBeDefined();
    });
  });

  describe('leaveCall', () => {
    it('should mark participant as left', async () => {
      mockResolve([{ ...sampleCall, status: 'active' }]);
      mockResolve(undefined);
      mockResolve([{ userId: 'user-2' }]);

      await service.leaveCall('call-1', 'user-2');

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockNats.publish).toHaveBeenCalled();
    });

    it('should auto-end call when no participants remain', async () => {
      mockResolve([{ ...sampleCall, status: 'active' }]);
      mockResolve(undefined);
      mockResolve([]);
      mockResolve(undefined);
      mockResolve(undefined);

      await service.leaveCall('call-1', 'user-1');

      const publishCalls = mockNats.publish.mock.calls;
      const lastPayload = JSON.parse(new TextDecoder().decode(publishCalls[publishCalls.length - 1][1]));
      expect(lastPayload.type).toBe('call_ended');
    });

    it('should throw when call not found', async () => {
      mockResolve([]);

      await expect(
        service.leaveCall('nonexistent', 'user-1'),
      ).rejects.toThrow();
    });
  });

  describe('endCall', () => {
    it('should end an active call', async () => {
      mockResolve([{ ...sampleCall, status: 'active' }]);
      mockResolve(undefined);
      mockResolve(undefined);

      await service.endCall('call-1', 'user-1');

      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should throw when call not found', async () => {
      mockResolve([]);

      await expect(
        service.endCall('nonexistent', 'user-1'),
      ).rejects.toThrow();
    });
  });

  describe('getCall', () => {
    it('should return call with participants', async () => {
      mockResolve([sampleCall]);
      mockResolve([
        { callId: 'call-1', userId: 'user-1', joinedAt: new Date(), leftAt: null },
      ]);

      const result = await service.getCall('call-1');

      expect(result.call.id).toBe('call-1');
      expect(result.participants).toHaveLength(1);
    });
  });

  describe('signal', () => {
    it('should publish WebRTC signal via NATS', async () => {
      mockResolve([sampleCall]);

      await service.signal('call-1', 'user-1', 'user-2', 'offer', '{"sdp":"..."}');

      expect(mockNats.publish).toHaveBeenCalled();
    });
  });
});
