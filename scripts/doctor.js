#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🏥 Running Doctor - System Health Check\n');

// Check Node.js version
try {
  const nodeVersion = process.version;
  console.log(`✅ Node.js version: ${nodeVersion}`);
  
  const [major, minor] = nodeVersion.replace('v', '').split('.').map(Number);
  if (major < 18) {
    console.log('❌ Node.js version must be >= 18.0.0');
    process.exit(1);
  }
} catch (error) {
  console.log('❌ Could not determine Node.js version');
  process.exit(1);
}

// Check .env file
const envPath = path.join(__dirname, '..', '.env');
try {
  if (fs.existsSync(envPath)) {
    console.log('✅ .env file exists');
    
    const envContent = fs.readFileSync(envPath, 'utf8');
    const requiredVars = [
      'OPENROUTER_API_KEY',
      'GITHUB_OAUTH_CLIENT_ID',
      'GITHUB_OAUTH_CLIENT_SECRET'
    ];
    
    const missingVars = requiredVars.filter(varName => !envContent.includes(varName));
    if (missingVars.length > 0) {
      console.log('⚠️  Missing required environment variables:', missingVars.join(', '));
    }
  } else {
    console.log('❌ .env file not found. Please copy .env.example to .env');
    process.exit(1);
  }
} catch (error) {
  console.log('❌ Could not read .env file');
  process.exit(1);
}

// Check package manager
try {
  execSync('pnpm --version', { stdio: 'pipe' });
  console.log('✅ pnpm is installed');
} catch (error) {
  console.log('⚠️  pnpm not found. Using npm instead');
}

// Check dependencies
try {
  const packageJson = require(path.join(__dirname, '..', 'package.json'));
  console.log(`✅ Package.json version: ${packageJson.version}`);
} catch (error) {
  console.log('❌ Could not read package.json');
  process.exit(1);
}

// Check directory structure
const requiredDirs = [
  'apps/cli',
  'apps/ui',
  'packages/core',
  'packages/llm',
  'packages/scoring',
  'packages/adapters',
  'packages/automation',
  'packages/ml'
];

let missingDirs = [];
requiredDirs.forEach(dir => {
  const fullPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(fullPath)) {
    missingDirs.push(dir);
  }
});

if (missingDirs.length > 0) {
  console.log('❌ Missing required directories:', missingDirs.join(', '));
  process.exit(1);
} else {
  console.log('✅ All required directories exist');
}

console.log('\n🎉 Doctor check completed successfully!');
console.log('\nNext steps:');
console.log('1. Install dependencies: pnpm install');
console.log('2. Build the project: pnpm run build');
console.log('3. Run the CLI: pnpm run start');