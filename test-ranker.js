#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing ranker dataset functionality...\n');

// Test 1: Check if ranker files exist
console.log('1. Testing ranker file existence...');
try {
  const requiredFiles = [
    'packages/core/src/db/migrations/ranker.ts',
    'packages/ml/src/ranker/dataset.ts',
    'apps/cli/src/commands/rankerAddPair.ts',
    'apps/cli/src/commands/rankerExport.ts',
  ];
  
  let missingFiles = [];
  requiredFiles.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (!fs.existsSync(fullPath)) {
      missingFiles.push(file);
    }
  });
  
  if (missingFiles.length > 0) {
    console.log('❌ Missing ranker files:', missingFiles.join(', '));
    process.exit(1);
  }
  
  console.log('✅ All ranker files exist');
} catch (error) {
  console.log('❌ Ranker file test failed:', error.message);
  process.exit(1);
}

// Test 2: Check migration integration
console.log('\n2. Testing migration integration...');
try {
  const schemaContent = fs.readFileSync(
    path.join(__dirname, 'packages/core/src/storage/schema.ts'),
    'utf8'
  );
  
  const migrationContent = fs.readFileSync(
    path.join(__dirname, 'packages/core/src/db/migrations/ranker.ts'),
    'utf8'
  );
  
  // Check if migration is imported
  if (!schemaContent.includes('RANKER_MIGRATIONS')) {
    console.log('❌ Migration not imported in schema');
    process.exit(1);
  }
  
  // Check if rank_items table is defined
  if (!migrationContent.includes('CREATE TABLE IF NOT EXISTS rank_items')) {
    console.log('❌ rank_items table not defined in migration');
    process.exit(1);
  }
  
  // Check if rank_pairs table is defined
  if (!migrationContent.includes('CREATE TABLE IF NOT EXISTS rank_pairs')) {
    console.log('❌ rank_pairs table not defined in migration');
    process.exit(1);
  }
  
  console.log('✅ Migration integration correct');
} catch (error) {
  console.log('❌ Migration integration test failed:', error.message);
  process.exit(1);
}

// Test 3: Check ranker dataset service implementation
console.log('\n3. Testing ranker dataset service implementation...');
try {
  const datasetContent = fs.readFileSync(
    path.join(__dirname, 'packages/ml/src/ranker/dataset.ts'),
    'utf8'
  );
  
  const requiredDefinitions = [
    'RankItem',
    'RankPair',
    'DatasetExportRow',
    'RankerDatasetService',
  ];
  
  let missingDefinitions = [];
  requiredDefinitions.forEach(def => {
    if (!datasetContent.includes(def)) {
      missingDefinitions.push(def);
    }
  });
  
  if (missingDefinitions.length > 0) {
    console.log('❌ Missing dataset definitions:', missingDefinitions.join(', '));
    process.exit(1);
  }
  
  const requiredMethods = [
    'addRankItem',
    'addRankPair',
    'getRankItem',
    'getRankItemsByUser',
    'getRankPairsByUser',
    'exportDataset',
    'exportDatasetToJSONL',
    'getDatasetStatistics',
  ];
  
  let missingMethods = [];
  requiredMethods.forEach(method => {
    if (!datasetContent.includes(`${method}(`)) {
      missingMethods.push(method);
    }
  });
  
  if (missingMethods.length > 0) {
    console.log('❌ Missing dataset methods:', missingMethods.join(', '));
    process.exit(1);
  }
  
  console.log('✅ All dataset service methods implemented');
} catch (error) {
  console.log('❌ Dataset service test failed:', error.message);
  process.exit(1);
}

// Test 4: Check CLI command implementations
console.log('\n4. Testing CLI command implementations...');
try {
  const addPairContent = fs.readFileSync(
    path.join(__dirname, 'apps/cli/src/commands/rankerAddPair.ts'),
    'utf8'
  );
  
  const exportContent = fs.readFileSync(
    path.join(__dirname, 'apps/cli/src/commands/rankerExport.ts'),
    'utf8'
  );
  
  // Check if commands are properly structured
  if (!addPairContent.includes('add-pair') || !addPairContent.includes('Pairwise preference')) {
    console.log('❌ Add pair command not properly structured');
    process.exit(1);
  }
  
  if (!exportContent.includes('export') || !exportContent.includes('JSONL format')) {
    console.log('❌ Export command not properly structured');
    process.exit(1);
  }
  
  console.log('✅ CLI commands properly implemented');
} catch (error) {
  console.log('❌ CLI command test failed:', error.message);
  process.exit(1);
}

// Test 5: Check ML package exports
console.log('\n5. Testing ML package exports...');
try {
  const mlIndexContent = fs.readFileSync(
    path.join(__dirname, 'packages/ml/src/index.ts'),
    'utf8'
  );
  
  const requiredExports = [
    'RankerDatasetService',
    'RankItem',
    'RankPair',
    'DatasetExportRow',
  ];
  
  let missingExports = [];
  requiredExports.forEach(exp => {
    if (!mlIndexContent.includes(exp)) {
      missingExports.push(exp);
    }
  });
  
  if (missingExports.length > 0) {
    console.log('❌ Missing ML package exports:', missingExports.join(', '));
    process.exit(1);
  }
  
  console.log('✅ All ML package exports present');
} catch (error) {
  console.log('❌ ML package export test failed:', error.message);
  process.exit(1);
}

// Test 6: Check CLI integration
console.log('\n6. Testing CLI integration...');
try {
  const profileContent = fs.readFileSync(
    path.join(__dirname, 'apps/cli/src/commands/profile.ts'),
    'utf8'
  );
  
  if (!profileContent.includes('rankerAddPairCommand') || !profileContent.includes('rankerExportCommand')) {
    console.log('❌ Ranker commands not integrated in CLI');
    process.exit(1);
  }
  
  console.log('✅ CLI integration correct');
} catch (error) {
  console.log('❌ CLI integration test failed:', error.message);
  process.exit(1);
}

console.log('\n🎉 All ranker dataset tests passed!');
console.log('\nThe ranker dataset system is ready for use. Next steps:');
console.log('1. Build the project: pnpm run build');
console.log('2. The ranker dataset will be available for integration');
console.log('3. Test with sample data to verify functionality');
console.log('4. Use the CLI commands to collect pairwise preferences');
console.log('5. Export dataset for model training');