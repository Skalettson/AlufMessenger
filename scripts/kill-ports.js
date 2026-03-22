#!/usr/bin/env node
/**
 * Освобождает порты Aluf Messenger перед запуском dev.
 * Запускается автоматически при pnpm dev, или вручную: pnpm dev:kill-ports
 */
import { execSync } from 'child_process';
const isWin = process.platform === 'win32';

const PORTS = [
  3000, 3001, 3002, 3100,
  50051, 50052, 50053, 50054, 50055, 50056, 50057, 50058, 50059, 50060,
];

function killPortWindows(port) {
  try {
    const out = execSync('netstat -ano', { encoding: 'utf8', windowsHide: true });
    const pids = new Set();
    const portSuffix = ':' + port;
    for (const line of out.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split(/\s+/).filter(Boolean);
      if (parts.length < 4) continue;
      const localAddr = parts[1];
      const pid = parts[parts.length - 1];
      if (!localAddr || !pid) continue;
      if (!/^\d+$/.test(pid)) continue;
      if (localAddr.endsWith(portSuffix) || localAddr === '[::]:' + port) {
        pids.add(pid);
      }
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'pipe', windowsHide: true });
        console.log(`  Порт ${port}: PID ${pid} завершён`);
      } catch (_) {}
    }
  } catch (e) {
    if (e.status !== 1) throw e;
  }
}

function killPortUnix(port) {
  try {
    const out = execSync(`lsof -ti :${port}`, { encoding: 'utf8' });
    const pids = out.trim().split(/\s+/).filter(Boolean);
    for (const pid of pids) {
      try {
        process.kill(-parseInt(pid, 10), 'SIGKILL');
        console.log(`  Порт ${port}: PID ${pid} завершён`);
      } catch (_) {
        try {
          process.kill(parseInt(pid, 10), 'SIGKILL');
        } catch (_) {}
      }
    }
  } catch (_) {}
}

console.log('Освобождение портов Aluf Messenger...');
for (const port of PORTS) {
  if (isWin) killPortWindows(port);
  else killPortUnix(port);
}
console.log('Готово.');
