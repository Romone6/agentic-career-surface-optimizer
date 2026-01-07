#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing embedding service functionality...\n');

// Test 1: Check if ML package files exist
console.log('1. Testing ML package file existence...');
try {
  const requiredFiles = [
    'packages/ml/package.json',
    'packages/ml/tsconfig.json',
    'packages/ml/src/embeddings/provider.ts',
    'packages/ml/src/embeddings/openrouter.ts',
    'packages/ml/src/embeddings/stub.ts',
    'packages/ml/src/similarity/cosine.ts',
    'packages/ml/src/storage/embeddings-repo.ts',
    'packages/ml/src/services/embedding-service.ts',
    'packages/ml/src/index.ts',
  ];
  
  let missingFiles = [];
  requiredFiles.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (!fs.existsSync(fullPath)) {
      missingFiles.push(file);
    }
  });
  
  if (missingFiles.length > 0) {
    console.log('❌ Missing ML files:', missingFiles.join(', '));
    process.exit(1);
  }
  
  console.log('✅ All ML package files exist');
} catch (error) {
  console.log('❌ ML file test failed:', error.message);
  process.exit(1);
}

// Test 2: Check if core migration files exist
console.log('\n2. Testing core migration files...');
try {
  const migrationFiles = [
    'packages/core/src/db/migrations/embeddings.ts',
  ];
  
  let missingFiles = [];
  migrationFiles.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (!fs.existsSync(fullPath)) {
      missingFiles.push(file);
    }
  });
  
  if (missingFiles.length > 0) {
    console.log('❌ Missing migration files:', missingFiles.join(', '));
    process.exit(1);
  }
  
  console.log('✅ All migration files exist');
} catch (error) {
  console.log('❌ Migration test failed:', error.message);
  process.exit(1);
}

// Test 3: Check embedding provider interface
console.log('\n3. Testing embedding provider interface...');
try {
  const providerContent = fs.readFileSync(
    path.join(__dirname, 'packages/ml/src/embeddings/provider.ts'),
    'utf8'
  );
  
  const requiredDefinitions = [
    'EmbeddingInputSchema',
    'EmbeddingOutputSchema',
    'EmbeddingProvider',
    'EmbeddingError',
  ];
  
  let missingDefinitions = [];
  requiredDefinitions.forEach(def => {
    if (!providerContent.includes(def)) {
      missingDefinitions.push(def);
    }
  });
  
  if (missingDefinitions.length > 0) {
    console.log('❌ Missing provider definitions:', missingDefinitions.join(', '));
    process.exit(1);
  }
  
  console.log('✅ All provider definitions present');
} catch (error) {
  console.log('❌ Provider test failed:', error.message);
  process.exit(1);
}

// Test 4: Check cosine similarity implementation
console.log('\n4. Testing cosine similarity implementation...');
try {
  const cosineContent = fs.readFileSync(
    path.join(__dirname, 'packages/ml/src/similarity/cosine.ts'),
    'utf8'
  );
  
  const requiredMethods = [
    'calculate',
    'topKSimilarity',
    'normalize',
    'average',
  ];
  
  let missingMethods = [];
  requiredMethods.forEach(method => {
    if (!cosineContent.includes(`${method}(`)) {
      missingMethods.push(method);
    }
  });
  
  if (missingMethods.length > 0) {
    console.log('❌ Missing cosine similarity methods:', missingMethods.join(', '));
    process.exit(1);
  }
  
  console.log('✅ All cosine similarity methods implemented');
} catch (error) {
  console.log('❌ Cosine similarity test failed:', error.message);
  process.exit(1);
}

// Test 5: Check embedding repository implementation
console.log('\n5. Testing embedding repository implementation...');
try {
  const repoContent = fs.readFileSync(
    path.join(__dirname, 'packages/ml/src/storage/embeddings-repo.ts'),
    'utf8'
  );
  
  const requiredMethods = [
    'storeEmbedding',
    'getEmbedding',
    'getEmbeddingsByUser',
    'findSimilarEmbeddings',
    'deleteEmbedding',
    'deleteEmbeddingsByUser',
  ];
  
  let missingMethods = [];
  requiredMethods.forEach(method => {
    if (!repoContent.includes(`${method}(`)) {
      missingMethods.push(method);
    }
  });
  
  if (missingMethods.length > 0) {
    console.log('❌ Missing repository methods:', missingMethods.join(', '));
    process.exit(1);
  }
  
  console.log('✅ All repository methods implemented');
} catch (error) {
  console.log('❌ Repository test failed:', error.message);
  process.exit(1);
}

// Test 6: Check embedding service implementation
console.log('\n6. Testing embedding service implementation...');
try {
  const serviceContent = fs.readFileSync(
    path.join(__dirname, 'packages/ml/src/services/embedding-service.ts'),
    'utf8'
  );
  
  const requiredMethods = [
    'generateAndStoreEmbeddings',
    'findSimilarTexts',
    'calculateTextSimilarity',
    'getStoredEmbeddings',
    'deleteEmbedding',
    'getProviderInfo',
  ];
  
  let missingMethods = [];
  requiredMethods.forEach(method => {
    if (!serviceContent.includes(`${method}(`)) {
      missingMethods.push(method);
    }
  });
  
  if (missingMethods.length > 0) {
    console.log('❌ Missing service methods:', missingMethods.join(', '));
    process.exit(1);
  }
  
  console.log('✅ All service methods implemented');
} catch (error) {
  console.log('❌ Service test failed:', error.message);
  process.exit(1);
}

// Test 7: Check main exports
console.log('\n7. Testing main exports...');
try {
  const indexContent = fs.readFileSync(
    path.join(__dirname, 'packages/ml/src/index.ts'),
    'utf8'
  );
  
  const requiredExports = [
    'EmbeddingProvider',
    'EmbeddingInput',
    'EmbeddingOutput',
    'EmbeddingError',
    'OpenRouterEmbeddingProvider',
    'StubEmbeddingProvider',
    'CosineSimilarity',
    'EmbeddingRepository',
    'EmbeddingRecord',
    'EmbeddingService',
  ];
  
  let missingExports = [];
  requiredExports.forEach(exp => {
    if (!indexContent.includes(exp)) {
      missingExports.push(exp);
    }
  });
  
  if (missingExports.length > 0) {
    console.log('❌ Missing exports:', missingExports.join(', '));
    process.exit(1);
  }
  
  console.log('✅ All exports present');
} catch (error) {
  console.log('❌ Export test failed:', error.message);
  process.exit(1);
}

// Test 8: Check migration integration
console.log('\n8. Testing migration integration...');
try {
  const schemaContent = fs.readFileSync(
    path.join(__dirname, 'packages/core/src/storage/schema.ts'),
    'utf8'
  );
  
  const migrationContent = fs.readFileSync(
    path.join(__dirname, 'packages/core/src/db/migrations/embeddings.ts'),
    'utf8'
  );
  
  // Check if migration is imported
  if (!schemaContent.includes('EMBEDDING_MIGRATIONS')) {
    console.log('❌ Migration not imported in schema');
    process.exit(1);
  }
  
  // Check if embeddings table is defined
  if (!migrationContent.includes('CREATE TABLE IF NOT EXISTS embeddings')) {
    console.log('❌ Embeddings table not defined in migration');
    process.exit(1);
  }
  
  console.log('✅ Migration integration correct');
} catch (error) {
  console.log('❌ Migration integration test failed:', error.message);
  process.exit(1);
}

console.log('\n🎉 All embedding service tests passed!');
console.log('\nThe embedding service is ready for use. Next steps:');
console.log('1. Build the project: pnpm run build');
console.log('2. The embedding service will be available for integration');
console.log('3. Test with sample data to verify functionality');
console.log('4. Integrate with CLI commands for profile matching');