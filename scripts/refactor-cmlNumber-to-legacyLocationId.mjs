#!/usr/bin/env node
/**
 * Automated refactor script: cmlNumber → legacyLocationId
 * 
 * This script performs a safe, systematic rename of all `cmlNumber` references
 * to `legacyLocationId` throughout the codebase.
 * 
 * SCOPE:
 * - All .ts files in server/
 * - All .tsx files in client/src/
 * 
 * EXCLUSIONS:
 * - node_modules/
 * - dist/
 * - .git/
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Files to process
const patterns = [
  'server/**/*.ts',
  'client/src/**/*.tsx',
  'client/src/**/*.ts',
];

// Exclusions
const exclude = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.git/**',
  '**/scripts/**', // Don't refactor this script itself
];

function findFiles(dir, extensions) {
  const files = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', 'dist', '.git', 'scripts'].includes(entry.name)) {
          files.push(...findFiles(fullPath, extensions));
        }
      } else if (entry.isFile()) {
        if (extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    }
  } catch (err) {
    // Skip inaccessible directories
  }
  return files;
}

async function main() {
  console.log('🔍 Finding files to refactor...\n');
  
  const files = [
    ...findFiles(join(projectRoot, 'server'), ['.ts']),
    ...findFiles(join(projectRoot, 'client', 'src'), ['.ts', '.tsx']),
  ];
  
  console.log(`Found ${files.length} files to process\n`);
  
  let totalReplacements = 0;
  const modifiedFiles = [];
  
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    
    // Perform replacements
    let newContent = content;
    let replacements = 0;
    
    // Replace property names in object literals and type definitions
    newContent = newContent.replace(/\bcmlNumber\b/g, (match, offset) => {
      // Check if this is in a comment
      const lineStart = content.lastIndexOf('\n', offset);
      const line = content.substring(lineStart, offset);
      if (line.includes('//') || line.includes('/*') || line.includes('*')) {
        // Keep comments as-is for now
        return match;
      }
      
      replacements++;
      return 'legacyLocationId';
    });
    
    if (replacements > 0) {
      writeFileSync(file, newContent, 'utf8');
      modifiedFiles.push({ file: file.replace(projectRoot, ''), replacements });
      totalReplacements += replacements;
    }
  }
  
  console.log('\n✅ Refactor complete!\n');
  console.log(`Modified ${modifiedFiles.length} files`);
  console.log(`Total replacements: ${totalReplacements}\n`);
  
  if (modifiedFiles.length > 0) {
    console.log('Modified files:');
    for (const { file, replacements } of modifiedFiles) {
      console.log(`  ${file} (${replacements} replacements)`);
    }
  }
  
  console.log('\n⚠️  Next steps:');
  console.log('1. Run `pnpm test` to verify all tests still pass');
  console.log('2. Review git diff to ensure changes are correct');
  console.log('3. Update any remaining references in client code manually');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
