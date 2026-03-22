#!/usr/bin/env node

/**
 * Скрипт для применения миграции enhanced_groups
 * Использование: node scripts/apply-migration.js
 */

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyMigration() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL не указан в .env');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  
  const migrationPath = path.join(__dirname, '..', 'packages', 'db', 'drizzle', '0007_enhanced_groups.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  console.log('🚀 Применение миграции enhanced_groups...');
  
  try {
    await pool.query('BEGIN');
    await pool.query(sql);
    await pool.query('COMMIT');
    console.log('✅ Миграция успешно применена!');
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ Ошибка при применении миграции:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
