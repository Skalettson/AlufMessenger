/**
 * Глобальная очистка после E2E тестов
 * Запускается после всех тестов
 */

export async function teardown() {
  console.log('🧹 Tearing down E2E tests...');
  
  // Очистка тестовых данных
  try {
    console.log('🗑️  Removing test users and data...');
    // Здесь можно добавить очистку БД после тестов
  } catch (error) {
    console.warn('⚠️  Teardown failed:', error);
  }
  
  console.log('✅ E2E tests teardown complete');
}

export default teardown;
