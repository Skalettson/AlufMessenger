/**
 * Запрос микрофона/камеры в рамках пользовательского жеста (getUserMedia).
 * Сообщения для типичных ошибок iOS / Safari / Chrome.
 */

export function describeGetUserMediaError(err: unknown): string {
  const name = err && typeof err === 'object' && 'name' in err ? String((err as DOMException).name) : '';
  const msg = err instanceof Error ? err.message : String(err);
  if (name === 'NotAllowedError' || /not allowed|Permission denied|User denied/i.test(msg)) {
    return 'Доступ запрещён. Разрешите микрофон/камеру для этого сайта в настройках браузера.';
  }
  if (name === 'NotFoundError' || /no (audio|video|input)/i.test(msg)) {
    return 'Устройство не найдено (микрофон или камера).';
  }
  if (name === 'NotReadableError' || /Could not start/i.test(msg)) {
    return 'Устройство занято другим приложением.';
  }
  if (name === 'OverconstrainedError') {
    return 'Камера не поддерживает выбранный режим.';
  }
  if (name === 'SecurityError' || /secure context|HTTPS/i.test(msg)) {
    return 'Нужен защищённый доступ (HTTPS), чтобы использовать микрофон и камеру.';
  }
  if (msg) return msg;
  return 'Не удалось получить доступ к устройству';
}

export function assertSecureMediaContext(): void {
  if (typeof window === 'undefined') return;
  const { protocol, hostname } = window.location;
  const ok =
    protocol === 'https:' ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.localhost');
  if (!ok) {
    throw new Error('Для микрофона и камеры откройте сайт по HTTPS.');
  }
}

export async function getAudioStreamForRecording(): Promise<MediaStream> {
  assertSecureMediaContext();
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Браузер не поддерживает запись с микрофона.');
  }
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });
}

export async function getVideoNoteStream(facingMode: 'user' | 'environment' = 'user'): Promise<MediaStream> {
  assertSecureMediaContext();
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Браузер не поддерживает камеру.');
  }
  return navigator.mediaDevices.getUserMedia({
    audio: true,
    video: {
      facingMode,
      width: { ideal: 384 },
      height: { ideal: 384 },
    },
  });
}

/** Только камера (смена фронт/тыл при записи видеосообщения). */
export async function getVideoOnlyStream(facingMode: 'user' | 'environment'): Promise<MediaStream> {
  assertSecureMediaContext();
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Браузер не поддерживает камеру.');
  }
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode,
      width: { ideal: 384 },
      height: { ideal: 384 },
    },
  });
}

export function assertMediaRecorderAvailable(): void {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Запись медиа в этом браузере не поддерживается. Обновите Safari или используйте Chrome.');
  }
}
