/**
 * Глобальная настройка E2E тестов
 * Запускается перед всеми тестами
 */

import { execSync } from 'child_process';

const API_URL = process.env.API_URL || 'http://localhost:3000/v1';
const TEST_PHONE = '+79990000001';

export async function setup() {
  console.log('🔧 Setting up E2E tests...');
  
  // Проверка доступности API
  try {
    const response = await fetch(`${API_URL}/health`);
    if (!response.ok) {
      throw new Error(`API unavailable: ${response.status}`);
    }
    console.log('✅ API Gateway is ready');
  } catch (error) {
    console.warn('⚠️  API Gateway not available. Tests may fail.');
  }
  
  // Очистка тестовых данных перед запуском
  try {
    console.log('🧹 Cleaning up test data...');
    // Здесь можно добавить очистку БД для тестов
  } catch (error) {
    console.warn('⚠️  Cleanup failed:', error);
  }
  
  // Глобальные переменные для тестов
  (global as any).API_URL = API_URL;
  (global as any).TEST_PHONE = TEST_PHONE;
}

export default setup;
