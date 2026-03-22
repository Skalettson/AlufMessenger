import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationService } from '../notification.service';

const chainMethods = [
  'select', 'from', 'where', 'limit',
  'insert', 'values', 'returning',
  'update', 'set', 'delete',
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

const mockFcm = {
  send: vi.fn().mockResolvedValue({ invalidToken: undefined }),
};

const mockApns = {
  send: vi.fn().mockResolvedValue({ invalidToken: undefined }),
};

const mockWebPush = {
  send: vi.fn().mockResolvedValue({ invalidToken: undefined }),
};

const mockEmail = {
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
};

const defaultPrefs = {
  messagesEnabled: true,
  mentionsEnabled: true,
  reactionsEnabled: true,
  callsEnabled: true,
  groupInvitesEnabled: true,
  contactJoinedEnabled: true,
  storiesEnabled: true,
  showPreview: true,
  defaultSound: 'default',
  vibrate: true,
  ledEnabled: true,
  ledColor: '#ffffff',
};

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockDb();
    mockFcm.send.mockResolvedValue({ invalidToken: undefined });
    mockApns.send.mockResolvedValue({ invalidToken: undefined });
    mockWebPush.send.mockResolvedValue({ invalidToken: undefined });
    mockEmail.sendEmail.mockResolvedValue({ success: true });

    service = new NotificationService(
      mockDb as any,
      mockFcm as any,
      mockApns as any,
      mockWebPush as any,
      mockEmail as any,
    );
  });

  describe('sendNotification', () => {
    it('should send push to all user tokens', async () => {
      mockResolve([]);
      mockResolve([
        { token: 'fcm-token-1', platform: 'fcm' },
        { token: 'apns-token-1', platform: 'apns' },
      ]);

      await service.sendNotification({
        recipientIds: ['user-1'],
        type: 'message',
        title: 'New message',
        body: 'Hello!',
      });

      expect(mockFcm.send).toHaveBeenCalledTimes(1);
      expect(mockApns.send).toHaveBeenCalledTimes(1);
    });

    it('should skip notification when preference is disabled', async () => {
      const disabledPrefs = {
        ...defaultPrefs,
        reactionsEnabled: false,
        userId: 'user-1',
      };
      mockResolve([disabledPrefs]);

      await service.sendNotification({
        recipientIds: ['user-1'],
        type: 'reaction',
        title: 'Reaction',
        body: 'Someone reacted',
      });

      expect(mockFcm.send).not.toHaveBeenCalled();
    });

    it('should remove invalid tokens after send failure', async () => {
      mockResolve([]);
      mockResolve([{ token: 'bad-token', platform: 'fcm' }]);
      mockFcm.send.mockResolvedValueOnce({ invalidToken: 'bad-token' });
      mockResolve(undefined);

      await service.sendNotification({
        recipientIds: ['user-1'],
        type: 'message',
        title: 'Test',
        body: 'Test',
      });

      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('should use masked title when showPreview is false', async () => {
      mockResolve([{ ...defaultPrefs, showPreview: false, userId: 'user-1' }]);
      mockResolve([{ token: 'fcm-1', platform: 'fcm' }]);

      await service.sendNotification({
        recipientIds: ['user-1'],
        type: 'message',
        title: 'Alice',
        body: 'Secret message',
      });

      expect(mockFcm.send).toHaveBeenCalledWith(
        'fcm-1',
        expect.objectContaining({ title: 'New notification', body: '' }),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should send to web push for web_push platform', async () => {
      mockResolve([]);
      mockResolve([{ token: 'web-push-sub', platform: 'web_push' }]);

      await service.sendNotification({
        recipientIds: ['user-1'],
        type: 'message',
        title: 'Hi',
        body: 'Hello',
      });

      expect(mockWebPush.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('registerToken', () => {
    it('should insert new token when it does not exist', async () => {
      mockResolve([]);
      mockResolve(undefined);

      await service.registerToken('user-1', 'new-token', 'fcm');

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should update platform for existing token', async () => {
      mockResolve([{ id: 'tok-1', token: 'existing', platform: 'fcm' }]);
      mockResolve(undefined);

      await service.registerToken('user-1', 'existing', 'apns');

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('unregisterToken', () => {
    it('should delete the token', async () => {
      mockResolve(undefined);

      await service.unregisterToken('user-1', 'some-token');

      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  describe('getUserPreferences', () => {
    it('should return default preferences when none saved', async () => {
      mockResolve([]);

      const prefs = await service.getUserPreferences('user-1');

      expect(prefs.messagesEnabled).toBe(true);
      expect(prefs.defaultSound).toBe('default');
    });

    it('should return saved preferences', async () => {
      mockResolve([{
        ...defaultPrefs,
        callsEnabled: false,
        defaultSound: 'custom',
      }]);

      const prefs = await service.getUserPreferences('user-1');

      expect(prefs.callsEnabled).toBe(false);
      expect(prefs.defaultSound).toBe('custom');
    });
  });

  describe('updatePreferences', () => {
    it('should insert new preferences when none exist', async () => {
      mockResolve([]);
      mockResolve(undefined);

      await service.updatePreferences('user-1', { callsEnabled: false });

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should update existing preferences', async () => {
      mockResolve([{ userId: 'user-1' }]);
      mockResolve(undefined);

      await service.updatePreferences('user-1', { vibrate: false });

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('sendEmail', () => {
    it('should send OTP email with correct subject', async () => {
      const result = await service.sendEmail('test@example.com', 'otp', { code: '123456' });

      expect(result.success).toBe(true);
      expect(mockEmail.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
        to: 'test@example.com',
        subject: 'Your Aluf verification code',
        template: 'otp',
      }));
    });

    it('should use custom subject when provided', async () => {
      await service.sendEmail('test@example.com', 'generic', {}, 'Custom Subject');

      expect(mockEmail.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
        subject: 'Custom Subject',
      }));
    });
  });

  describe('toDbPlatform', () => {
    it('should convert proto platform numbers to strings', () => {
      expect(service.toDbPlatform(1)).toBe('fcm');
      expect(service.toDbPlatform(2)).toBe('apns');
      expect(service.toDbPlatform(3)).toBe('web_push');
      expect(service.toDbPlatform(99)).toBe('fcm');
    });
  });
});
