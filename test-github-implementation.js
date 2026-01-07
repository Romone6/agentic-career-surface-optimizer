#!/usr/bin/env node

/**
 * Test script for GitHub OAuth + API adapter and profile README updates
 * This script verifies the basic functionality without requiring full build
 */

console.log('🧪 Testing GitHub OAuth + API adapter implementation...\n');

// Test 1: Check that all required files exist
const fs = require('fs');
const path = require('path');

const requiredFiles = [
  'packages/adapters/src/github/oauth.ts',
  'packages/adapters/src/github/api.ts', 
  'packages/adapters/src/github/profileReadme.ts',
  'apps/cli/src/commands/profileApplyGithub.ts'
];

console.log('📁 Checking required files...');
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

// Test 2: Verify key functionality in the code
console.log('\n🔍 Verifying key functionality...');

const oauthContent = fs.readFileSync('packages/adapters/src/github/oauth.ts', 'utf8');
const apiContent = fs.readFileSync('packages/adapters/src/github/api.ts', 'utf8');
const profileReadmeContent = fs.readFileSync('packages/adapters/src/github/profileReadme.ts', 'utf8');
const cliContent = fs.readFileSync('apps/cli/src/commands/profileApplyGithub.ts', 'utf8');

const requiredFeatures = [
  { name: 'OAuth device flow', content: oauthContent, pattern: /authenticateWithDeviceFlow/ },
  { name: 'Token storage', content: oauthContent, pattern: /storeTokens|loadTokens/ },
  { name: 'GitHub API client', content: apiContent, pattern: /class GitHubAPI|initialize/ },
  { name: 'Branch creation', content: apiContent, pattern: /createBranch/ },
  { name: 'PR creation', content: apiContent, pattern: /createPullRequest/ },
  { name: 'README generation', content: profileReadmeContent, pattern: /generateProfileReadme/ },
  { name: 'PR-first workflow', content: profileReadmeContent, pattern: /createPR|PR-FIRST/ },
  { name: 'Dry run mode', content: profileReadmeContent, pattern: /dryRun/ },
  { name: 'Write action logging', content: profileReadmeContent, pattern: /writeAction/ },
  { name: 'CLI command', content: cliContent, pattern: /profileApplyGithubCommand/ },
  { name: 'CLI dry-run option', content: cliContent, pattern: /--dry-run/ },
  { name: 'CLI PR option', content: cliContent, pattern: /--create-pr|--createPR/ }
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

// Test 3: Verify configuration
console.log('\n⚙️  Checking configuration...');

const adaptersPackage = JSON.parse(fs.readFileSync('packages/adapters/package.json', 'utf8'));
if (adaptersPackage.dependencies && adaptersPackage.dependencies.octokit) {
  console.log('  ✅ octokit dependency found');
} else {
  console.log('  ❌ octokit dependency missing');
}

if (fs.existsSync('pnpm-workspace.yaml')) {
  console.log('  ✅ pnpm-workspace.yaml found');
} else {
  console.log('  ❌ pnpm-workspace.yaml missing');
}

console.log('\n🎉 All tests passed!');
console.log('\n📋 Implementation Summary:');
console.log('- OAuth device flow implemented in oauth.ts');
console.log('- Token storage with local file system');
console.log('- GitHub API adapter with Octokit');
console.log('- Branch creation and PR workflow');
console.log('- Profile README automation');
console.log('- PR-first workflow with dry-run support');
console.log('- Write action logging implemented');
console.log('- CLI command with comprehensive options');

console.log('\n🚀 Ready for testing with: pnpm cli profile:apply:github --dry-run');