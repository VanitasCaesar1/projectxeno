#!/usr/bin/env node

/**
 * Database Migration Script
 * 
 * This script helps apply the database migrations to your Supabase instance.
 * It reads the migration files and provides instructions for applying them.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, '../database/migrations');

function getMigrationFiles() {
  try {
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    return files.map(file => ({
      name: file,
      path: path.join(MIGRATIONS_DIR, file),
      content: fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
    }));
  } catch (error) {
    console.error('Error reading migration files:', error.message);
    return [];
  }
}

function displayInstructions() {
  console.log('\n🗄️  Database Migration Helper\n');
  console.log('This script will help you apply the database migrations for the media tracking platform.\n');
  
  const migrations = getMigrationFiles();
  
  if (migrations.length === 0) {
    console.log('❌ No migration files found in database/migrations/');
    return;
  }

  console.log('📋 Available migrations:');
  migrations.forEach((migration, index) => {
    console.log(`  ${index + 1}. ${migration.name}`);
  });

  console.log('\n🚀 To apply these migrations:\n');
  
  console.log('Option 1: Via Supabase Dashboard');
  console.log('  1. Go to your Supabase project dashboard');
  console.log('  2. Navigate to SQL Editor');
  console.log('  3. Copy and paste each migration file in order');
  console.log('  4. Execute each migration\n');

  console.log('Option 2: Via Supabase CLI (if installed)');
  console.log('  supabase db reset  # Reset and apply all migrations');
  console.log('  # OR');
  console.log('  supabase db push   # Push schema changes\n');

  console.log('Option 3: Direct PostgreSQL connection');
  console.log('  Connect to your database and execute each SQL file in order\n');

  console.log('📄 Migration file contents:\n');
  
  migrations.forEach((migration, index) => {
    console.log(`${'='.repeat(60)}`);
    console.log(`Migration ${index + 1}: ${migration.name}`);
    console.log(`${'='.repeat(60)}`);
    console.log(migration.content);
    console.log('\n');
  });

  console.log('✅ After applying migrations:');
  console.log('  1. Verify tables are created in your Supabase dashboard');
  console.log('  2. Check that Row Level Security policies are active');
  console.log('  3. Test user registration to ensure triggers work');
  console.log('  4. Update your application code to use the new schema\n');

  console.log('⚠️  Important notes:');
  console.log('  - Apply migrations in order (001, 002, 003)');
  console.log('  - Backup your database before applying migrations');
  console.log('  - Test in a development environment first');
  console.log('  - The migrations preserve existing data in legacy tables\n');
}

// Check if running as main module
if (import.meta.url === `file://${process.argv[1]}`) {
  displayInstructions();
}