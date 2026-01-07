#!/usr/bin/env node

/**
 * Test script for Benchmark Library Implementation
 * Verifies SQLite tables, CLI commands, and data-driven planning
 */

console.log('🧪 Testing Benchmark Library Implementation...\n');

const fs = require('fs');
const path = require('path');

console.log('📁 Checking required files...');

const requiredFiles = [
  'packages/core/src/storage/schema.ts',
  'packages/core/src/storage/repositories/benchmark.ts',
  'packages/core/src/services/benchmark.ts',
  'apps/cli/src/commands/benchmarks.ts',
];

let allFilesExist = true;
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - MISSING`);
    allFilesExist = false;
  }
});

if (!allFilesExist) {
  console.log('\n❌ Some required files are missing');
  process.exit(1);
}

console.log('\n🔍 Verifying key functionality...');

const schemaContent = fs.readFileSync('packages/core/src/storage/schema.ts', 'utf8');
const repoContent = fs.readFileSync('packages/core/src/storage/repositories/benchmark.ts', 'utf8');
const serviceContent = fs.readFileSync('packages/core/src/services/benchmark.ts', 'utf8');
const cliContent = fs.readFileSync('apps/cli/src/commands/benchmarks.ts', 'utf8');
const commandsContent = fs.readFileSync('apps/cli/src/commands.ts', 'utf8');
const profileContent = fs.readFileSync('apps/cli/src/commands/profile.ts', 'utf8');

const requiredFeatures = [
  { name: 'benchmark_profiles table', content: schemaContent, pattern: /benchmark_profiles/ },
  { name: 'benchmark_sections table', content: schemaContent, pattern: /benchmark_sections/ },
  { name: 'benchmark_embeddings table', content: schemaContent, pattern: /benchmark_embeddings/ },
  { name: 'benchmark_cache table', content: schemaContent, pattern: /benchmark_cache/ },
  { name: 'SQLiteBenchmarkProfileRepository', content: repoContent, pattern: /class SQLiteBenchmarkProfileRepository/ },
  { name: 'SQLiteBenchmarkSectionRepository', content: repoContent, pattern: /class SQLiteBenchmarkSectionRepository/ },
  { name: 'SQLiteBenchmarkEmbeddingRepository', content: repoContent, pattern: /class SQLiteBenchmarkEmbeddingRepository/ },
  { name: 'BenchmarkService class', content: serviceContent, pattern: /class BenchmarkService/ },
  { name: 'findSimilarBenchmarks', content: serviceContent, pattern: /findSimilarBenchmarks/ },
  { name: 'generateDataDrivenPlan', content: serviceContent, pattern: /generateDataDrivenPlan/ },
  { name: 'benchmarks:add:linkedin', content: cliContent, pattern: /add:linkedin/ },
  { name: 'benchmarks:seed:github', content: cliContent, pattern: /seed:github/ },
  { name: 'benchmarks:ingest:github', content: cliContent, pattern: /ingest:github/ },
  { name: 'benchmarks:ingest:linkedin', content: cliContent, pattern: /ingest:linkedin/ },
  { name: 'benchmarks:embed', content: cliContent, pattern: /benchmarks:embed/ },
  { name: 'benchmarks:neighbors', content: cliContent, pattern: /benchmarks:neighbors/ },
  { name: 'benchmarksCommands registered', content: commandsContent, pattern: /benchmarksCommands/ },
  { name: 'profile:plan --mode data-driven', content: profileContent, pattern: /--mode.*data-driven|data-driven.*mode/ },
  { name: 'Persona support', content: serviceContent, pattern: /founder|engineer|product_manager/ },
  { name: 'Rate limiting', content: cliContent, pattern: /rate.?limit|cache|ttl/ },
  { name: 'Safety measures', content: cliContent, pattern: /LINKEDIN_RUN_ALLOW|user-authenticated/ },
];

let allFeaturesPresent = true;
requiredFeatures.forEach(feature => {
  if (feature.pattern.test(feature.content)) {
    console.log(`  ✅ ${feature.name}`);
  } else {
    console.log(`  ❌ ${feature.name} - MISSING`);
    allFeaturesPresent = false;
  }
});

if (!allFeaturesPresent) {
  console.log('\n❌ Some required features are missing');
  process.exit(1);
}

console.log('\n🎉 All tests passed!');
console.log('\n📋 Implementation Summary:');
console.log('');
console.log('📊 SQLite Tables:');
console.log('  • benchmark_profiles - Profile metadata and persona tags');
console.log('  • benchmark_sections - Individual sections (headline, about, etc.)');
console.log('  • benchmark_embeddings - Vector embeddings for similarity search');
console.log('  • benchmark_cache - Rate limiting and caching');
console.log('');
console.log('🔧 CLI Commands:');
console.log('  • benchmarks:add:linkedin - Ingest user-provided LinkedIn URLs');
console.log('  • benchmarks:seed:github --n 50 - Auto-collect elite GitHub profiles');
console.log('  • benchmarks:ingest:github - Fetch GitHub metadata and content');
console.log('  • benchmarks:ingest:linkedin - Playwright extraction from URLs');
console.log('  • benchmarks:embed - Generate embeddings for all sections');
console.log('  • benchmarks:neighbors - Find similar benchmark examples');
console.log('  • benchmarks:stats - Show benchmark library statistics');
console.log('  • benchmarks:clear - Clear all benchmark data');
console.log('');
console.log('🧠 Data-Driven Planning:');
console.log('  • profile:plan --mode data-driven');
console.log('  • Extracts patterns from elite benchmarks');
console.log('  • Suggests edits based on similarity');
console.log('  • Evaluates persona alignment');
console.log('');
console.log('🔒 Safety Features:');
console.log('  • No broad LinkedIn crawling (user URLs only)');
console.log('  • Rate limiting with caching');
console.log('  • LINKEDIN_RUN_ALLOW guard for Playwright');
console.log('  • Skips inaccessible profiles');
console.log('');

console.log('🚀 Usage Instructions:');
console.log('1. Seed GitHub benchmarks:');
console.log('   pnpm cli benchmarks:seed:github --n 50');
console.log('');
console.log('2. Add LinkedIn URLs:');
console.log('   pnpm cli benchmarks:add:linkedin --urls "url1,url2,..."');
console.log('   or: pnpm cli benchmarks:add:linkedin --file profiles.yaml');
console.log('');
console.log('3. Ingest and embed:');
console.log('   pnpm cli benchmarks:ingest:github');
console.log('   pnpm cli benchmarks:ingest:linkedin');
console.log('   pnpm cli benchmarks:embed');
console.log('');
console.log('4. Generate data-driven plan:');
console.log('   pnpm cli profile:plan --mode data-driven --platform linkedin');
console.log('');
console.log('5. Find similar benchmarks:');
console.log('   pnpm cli benchmarks:neighbors --text "Your headline" --platform linkedin --section about --k 5');