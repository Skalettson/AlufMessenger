'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

export interface UseAudioVisualizerProps {
  /** Audio элемент для анализа (для воспроизведения) */
  audioElement?: HTMLAudioElement | null;
  /** MediaStream для анализа (для записи с микрофона) */
  mediaStream?: MediaStream | null;
  /** Количество баров в визуализации */
  barCount?: number;
  /** Активна ли визуализация */
  enabled?: boolean;
}

export interface UseAudioVisualizerReturn {
  /** Массив высот баров (0-1) */
  barHeights: number[];
  /** Canvas ref для отрисовки */
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Текущая частота (для определения активности звука) */
  frequency: number;
  /** Уровень громкости (0-1) */
  volume: number;
}

/**
 * Хук для визуализации аудио через Web Audio API
 * Поддерживает два режима:
 * 1. Анализ воспроизводимого аудио (через audioElement)
 * 2. Анализ микрофона (через mediaStream)
 */
export function useAudioVisualizer({
  audioElement,
  mediaStream,
  barCount = 64,
  enabled = true,
}: UseAudioVisualizerProps): UseAudioVisualizerReturn {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  const [barHeights, setBarHeights] = useState<number[]>(() => Array(barCount).fill(0));
  const [frequency, setFrequency] = useState(0);
  const [volume, setVolume] = useState(0);

  // Инициализация AudioContext и AnalyserNode
  const initializeAudioContext = useCallback(() => {
    if (!enabled) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }

    if (!analyserRef.current && audioContextRef.current) {
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;
    }
  }, [enabled]);

  // Подключение источника аудио
  const connectSource = useCallback(() => {
    if (!audioContextRef.current || !analyserRef.current) return;

    // Отключаем предыдущий источник
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch {
        // Игнорируем ошибки
      }
    }

    if (mediaStream) {
      // Источник: микрофон
      sourceRef.current = audioContextRef.current.createMediaStreamSource(mediaStream);
      sourceRef.current.connect(analyserRef.current);
    } else if (audioElement) {
      // Источник: audio элемент
      try {
        sourceRef.current = audioContextRef.current.createMediaElementSource(audioElement);
        sourceRef.current.connect(analyserRef.current);
        // Не подключаем к destination, чтобы не дублировать звук
      } catch {
        // Источник уже подключён (может быть при повторном рендере)
      }
    }
  }, [mediaStream, audioElement]);

  // Отрисовка визуализации на canvas
  const drawVisualization = useCallback(() => {
    if (!analyserRef.current || !canvasRef.current) return;

    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    if (!dataArrayRef.current || dataArrayRef.current.length !== bufferLength) {
      dataArrayRef.current = new Uint8Array(bufferLength);
    }

    const dataArray = dataArrayRef.current!;
    analyser.getByteFrequencyData(dataArray as Uint8Array<ArrayBuffer>);

    // Настройка canvas
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const barWidth = width / barCount;
    const barGap = 1;

    // Очистка
    ctx.clearRect(0, 0, width, height);

    // Вычисление высот баров
    const newHeights: number[] = [];
    let maxFreq = 0;
    let totalVolume = 0;

    for (let i = 0; i < barCount; i++) {
      // Берём данные из нижней части спектра (более музыкальные частоты)
      const dataIndex = Math.floor((i / barCount) * (dataArray.length / 2));
      const value = dataArray[dataIndex] || 0;
      const normalizedValue = value / 255;

      newHeights.push(normalizedValue);
      maxFreq = Math.max(maxFreq, value);
      totalVolume += normalizedValue;
    }

    // Обновление состояния
    setBarHeights(newHeights);
    setFrequency(maxFreq);
    setVolume(totalVolume / barCount);

    // Отрисовка баров
    for (let i = 0; i < barCount; i++) {
      const barHeight = newHeights[i] * height;
      const x = i * barWidth;
      const y = height - barHeight;

      // Градиент для бара
      const gradient = ctx.createLinearGradient(x, y, x, height);
      gradient.addColorStop(0, 'rgba(147, 51, 234, 0.9)'); // purple-600
      gradient.addColorStop(1, 'rgba(147, 51, 234, 0.3)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x + barGap / 2, y, barWidth - barGap, barHeight, 2);
      ctx.fill();
    }

    animationFrameRef.current = requestAnimationFrame(drawVisualization);
  }, [barCount]);

  // Старт визуализации
  const startVisualization = useCallback(() => {
    if (!enabled) return;

    initializeAudioContext();

    // Resume audio context (требуется для некоторых браузеров)
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {
        // Игнорируем ошибки
      });
    }

    connectSource();
    drawVisualization();
  }, [enabled, initializeAudioContext, connectSource, drawVisualization]);

  // Стоп визуализации
  const stopVisualization = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }

    setBarHeights(Array(barCount).fill(0));
    setFrequency(0);
    setVolume(0);
  }, [barCount]);

  // Очистка
  useEffect(() => {
    return () => {
      stopVisualization();

      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch {
          // Игнорируем
        }
      }

      if (analyserRef.current) {
        analyserRef.current.disconnect();
      }

      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {
          // Игнорируем
        });
      }
    };
  }, [stopVisualization]);

  // Переподключение при изменении источников
  useEffect(() => {
    if (enabled && (audioElement || mediaStream)) {
      startVisualization();
    } else {
      stopVisualization();
    }
  }, [audioElement, mediaStream, enabled, startVisualization, stopVisualization]);

  return {
    barHeights,
    canvasRef,
    frequency,
    volume,
  };
}
