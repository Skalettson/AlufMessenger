import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PresenceService } from '../presence.service';

vi.mock('@aluf/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aluf/shared')>();
  return {
    ...actual,
    PRESENCE_HEARTBEAT_INTERVAL_MS: 30000,
    PRESENCE_OFFLINE_THRESHOLD_MS: 60000,
    NATS_SUBJECTS: { PRESENCE: 'aluf.presence' },
  };
});

const mockRedis = {
  set: vi.fn().mockResolvedValue('OK'),
  get: vi.fn().mockResolvedValue(null),
  del: vi.fn().mockResolvedValue(1),
  exists: vi.fn().mockResolvedValue(0),
  pipeline: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  }),
};

const mockNats = {
  nc: {
    publish: vi.fn(),
  },
};

const mockConnectionManager = {
  isOnline: vi.fn().mockReturnValue(false),
  getAllConnectedUserIds: vi.fn().mockReturnValue([]),
};

describe('PresenceService', () => {
  let service: PresenceService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    service = new PresenceService(
      mockRedis as any,
      mockNats as any,
      mockConnectionManager as any,
    );
  });

  afterEach(() => {
    service.onModuleDestroy();
    vi.useRealTimers();
  });

  describe('setOnline', () => {
    it('should set presence key with TTL in Redis', async () => {
      await service.setOnline('user-1');

      expect(mockRedis.set).toHaveBeenCalledWith(
        'presence:user-1',
        expect.any(String),
        'EX',
        expect.any(Number),
      );
    });

    it('should update last_seen key', async () => {
      await service.setOnline('user-1');

      expect(mockRedis.set).toHaveBeenCalledWith(
        'last_seen:user-1',
        expect.any(String),
      );
    });

    it('should publish presence change via NATS', async () => {
      await service.setOnline('user-1');

      expect(mockNats.nc.publish).toHaveBeenCalledWith(
        'aluf.presence',
        expect.anything(),
      );
    });

    it('should clear pending offline timer when coming back online', async () => {
      service.scheduleOffline('user-1');

      await service.setOnline('user-1');

      vi.advanceTimersByTime(10000);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('setOffline', () => {
    it('should remove presence key from Redis', async () => {
      await service.setOffline('user-1');

      expect(mockRedis.del).toHaveBeenCalledWith('presence:user-1');
    });

    it('should update last_seen timestamp', async () => {
      await service.setOffline('user-1');

      expect(mockRedis.set).toHaveBeenCalledWith(
        'last_seen:user-1',
        expect.any(String),
      );
    });

    it('should publish offline status via NATS', async () => {
      await service.setOffline('user-1');

      const publishCall = mockNats.nc.publish.mock.calls[0];
      const payload = JSON.parse(new TextDecoder().decode(publishCall[1]));
      expect(payload.status).toBe('offline');
      expect(payload.userId).toBe('user-1');
    });
  });

  describe('heartbeat', () => {
    it('should refresh presence TTL in Redis', async () => {
      await service.heartbeat('user-1');

      expect(mockRedis.set).toHaveBeenCalledWith(
        'presence:user-1',
        expect.any(String),
        'EX',
        expect.any(Number),
      );
    });

    it('should update last_seen', async () => {
      await service.heartbeat('user-1');

      expect(mockRedis.set).toHaveBeenCalledWith(
        'last_seen:user-1',
        expect.any(String),
      );
    });
  });

  describe('isOnline', () => {
    it('should return true when presence key exists', async () => {
      mockRedis.exists.mockResolvedValueOnce(1);

      const result = await service.isOnline('user-1');

      expect(result).toBe(true);
    });

    it('should return false when presence key does not exist', async () => {
      mockRedis.exists.mockResolvedValueOnce(0);

      const result = await service.isOnline('user-1');

      expect(result).toBe(false);
    });
  });

  describe('getLastSeen', () => {
    it('should return last seen timestamp', async () => {
      mockRedis.get.mockResolvedValueOnce('1700000000000');

      const result = await service.getLastSeen('user-1');

      expect(result).toBe('1700000000000');
    });

    it('should return null when no last seen data', async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      const result = await service.getLastSeen('user-1');

      expect(result).toBeNull();
    });
  });

  describe('scheduleOffline', () => {
    it('should not schedule if user still has connections', () => {
      mockConnectionManager.isOnline.mockReturnValueOnce(true);

      service.scheduleOffline('user-1');

      vi.advanceTimersByTime(10000);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should set user offline after grace period', async () => {
      mockConnectionManager.isOnline.mockReturnValue(false);

      service.scheduleOffline('user-1');
      vi.advanceTimersByTime(6000);

      expect(mockRedis.del).toHaveBeenCalledWith('presence:user-1');
    });
  });

  describe('onModuleInit', () => {
    it('should start heartbeat refresh timer', () => {
      service.onModuleInit();

      mockConnectionManager.getAllConnectedUserIds.mockReturnValue(['user-1', 'user-2']);
      mockRedis.pipeline();

      vi.advanceTimersByTime(30000);

      expect(mockConnectionManager.getAllConnectedUserIds).toHaveBeenCalled();
    });
  });
});
