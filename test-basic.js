#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing basic functionality...\n');

// Test 1: Check if required files exist
console.log('1. Checking required files...');
const requiredFiles = [
  'package.json',
  'turbo.json',
  '.env.example',
  '.env',
  '.gitignore',
  'apps/cli/package.json',
  'packages/core/package.json',
  'packages/llm/package.json',
  'scripts/doctor.js',
];

let missingFiles = [];
requiredFiles.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (!fs.existsSync(fullPath)) {
    missingFiles.push(file);
  }
});

if (missingFiles.length > 0) {
  console.log('❌ Missing files:', missingFiles.join(', '));
  process.exit(1);
} else {
  console.log('✅ All required files exist');
}

// Test 2: Check directory structure
console.log('\n2. Checking directory structure...');
const requiredDirs = [
  'apps/cli/src',
  'apps/ui',
  'packages/core/src',
  'packages/llm/src',
  'packages/scoring',
  'packages/adapters',
  'packages/automation',
  'packages/ml',
  'scripts',
  'docs',
];

let missingDirs = [];
requiredDirs.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    missingDirs.push(dir);
  }
});

if (missingDirs.length > 0) {
  console.log('❌ Missing directories:', missingDirs.join(', '));
  process.exit(1);
} else {
  console.log('✅ All required directories exist');
}

// Test 3: Check package.json structure
console.log('\n3. Checking package.json structure...');
try {
  const rootPackage = require(path.join(__dirname, 'package.json'));
  if (!rootPackage.workspaces || rootPackage.workspaces.length === 0) {
    console.log('❌ Root package.json missing workspaces');
    process.exit(1);
  }
  console.log('✅ Root package.json has workspaces');
  
  const cliPackage = require(path.join(__dirname, 'apps/cli/package.json'));
  if (!cliPackage.bin || !cliPackage.bin.ancso) {
    console.log('❌ CLI package.json missing bin configuration');
    process.exit(1);
  }
  console.log('✅ CLI package.json has bin configuration');
  
  const corePackage = require(path.join(__dirname, 'packages/core/package.json'));
  if (!corePackage.dependencies || !corePackage.dependencies.zod) {
    console.log('❌ Core package.json missing required dependencies');
    process.exit(1);
  }
  console.log('✅ Core package.json has required dependencies');
  
  const llmPackage = require(path.join(__dirname, 'packages/llm/package.json'));
  if (!llmPackage.dependencies || !llmPackage.dependencies['@ancso/core']) {
    console.log('❌ LLM package.json missing core dependency');
    process.exit(1);
  }
  console.log('✅ LLM package.json has core dependency');
  
} catch (error) {
  console.log('❌ Error checking package.json files:', error.message);
  process.exit(1);
}

// Test 4: Check TypeScript configuration
console.log('\n4. Checking TypeScript configuration...');
try {
  const tsConfigPaths = [
    'apps/cli/tsconfig.json',
    'packages/core/tsconfig.json',
    'packages/llm/tsconfig.json',
  ];
  
  tsConfigPaths.forEach(tsConfigPath => {
    const fullPath = path.join(__dirname, tsConfigPath);
    if (!fs.existsSync(fullPath)) {
      console.log(`❌ Missing tsconfig.json: ${tsConfigPath}`);
      process.exit(1);
    }
    
    const tsConfig = require(fullPath);
    if (!tsConfig.compilerOptions || !tsConfig.compilerOptions.outDir) {
      console.log(`❌ Invalid tsconfig.json: ${tsConfigPath}`);
      process.exit(1);
    }
  });
  
  console.log('✅ All tsconfig.json files are valid');
} catch (error) {
  console.log('❌ Error checking TypeScript configuration:', error.message);
  process.exit(1);
}

// Test 5: Check if core files compile (basic syntax check)
console.log('\n5. Checking core file syntax...');
try {
  // This is a basic check - in a real scenario you'd want to run the TypeScript compiler
  const coreFiles = [
    'packages/core/src/config.ts',
    'packages/llm/src/openrouter-client.ts',
    'packages/llm/src/logger.ts',
    'apps/cli/src/index.ts',
  ];
  
  coreFiles.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (!fs.existsSync(fullPath)) {
      console.log(`❌ Missing core file: ${file}`);
      process.exit(1);
    }
    
    // Basic syntax check by reading the file
    const content = fs.readFileSync(fullPath, 'utf8');
    if (content.length === 0) {
      console.log(`❌ Empty core file: ${file}`);
      process.exit(1);
    }
  });
  
  console.log('✅ All core files exist and have content');
} catch (error) {
  console.log('❌ Error checking core files:', error.message);
  process.exit(1);
}

console.log('\n🎉 All basic tests passed!');
console.log('\nNext steps:');
console.log('1. Run: pnpm install');
console.log('2. Run: pnpm run build');
console.log('3. Run: pnpm run doctor');
console.log('4. Test CLI: node apps/cli/dist/index.js --help');