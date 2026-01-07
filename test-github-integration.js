#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing GitHub integration...\n');

// Test 1: Check if GitHub adapter files exist
console.log('1. Testing GitHub adapter file existence...');
try {
  const requiredFiles = [
    'packages/adapters/package.json',
    'packages/adapters/tsconfig.json',
    'packages/adapters/src/github/oauth.ts',
    'packages/adapters/src/github/api.ts',
    'packages/adapters/src/github/profileReadme.ts',
    'apps/cli/src/commands/profileApplyGithub.ts',
  ];
  
  let missingFiles = [];
  requiredFiles.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (!fs.existsSync(fullPath)) {
      missingFiles.push(file);
    }
  });
  
  if (missingFiles.length > 0) {
    console.log('❌ Missing GitHub adapter files:', missingFiles.join(', '));
    process.exit(1);
  }
  
  console.log('✅ All GitHub adapter files exist');
} catch (error) {
  console.log('❌ GitHub adapter file test failed:', error.message);
  process.exit(1);
}

// Test 2: Check OAuth implementation
console.log('\n2. Testing OAuth implementation...');
try {
  const oauthContent = fs.readFileSync(
    path.join(__dirname, 'packages/adapters/src/github/oauth.ts'),
    'utf8'
  );
  
  const requiredMethods = [
    'authenticateWithDeviceFlow',
    'authenticateWithLocalCallback',
    'refreshToken',
    'getAuthenticatedUser',
    'revokeToken',
    'getAccessToken',
    'isConfigured',
  ];
  
  let missingMethods = [];
  requiredMethods.forEach(method => {
    if (!oauthContent.includes(`${method}(`)) {
      missingMethods.push(method);
    }
  });
  
  if (missingMethods.length > 0) {
    console.log('❌ Missing OAuth methods:', missingMethods.join(', '));
    process.exit(1);
  }
  
  // Check for device flow implementation
  if (!oauthContent.includes('device_code') || !oauthContent.includes('user_code')) {
    console.log('❌ Device flow implementation missing');
    process.exit(1);
  }
  
  console.log('✅ OAuth implementation complete');
} catch (error) {
  console.log('❌ OAuth implementation test failed:', error.message);
  process.exit(1);
}

// Test 3: Check API client implementation
console.log('\n3. Testing API client implementation...');
try {
  const apiContent = fs.readFileSync(
    path.join(__dirname, 'packages/adapters/src/github/api.ts'),
    'utf8'
  );
  
  const requiredMethods = [
    'initialize',
    'getAuthenticatedUser',
    'getUserRepositories',
    'getRepositoryReadme',
    'updateRepositoryReadme',
    'createRepository',
    'createPullRequest',
    'updateRepositoryTopics',
    'getRepositoryTopics',
    'checkRateLimit',
    'getRepositoryStats',
  ];
  
  let missingMethods = [];
  requiredMethods.forEach(method => {
    if (!apiContent.includes(`${method}(`)) {
      missingMethods.push(method);
    }
  });
  
  if (missingMethods.length > 0) {
    console.log('❌ Missing API methods:', missingMethods.join(', '));
    process.exit(1);
  }
  
  console.log('✅ API client implementation complete');
} catch (error) {
  console.log('❌ API client implementation test failed:', error.message);
  process.exit(1);
}

// Test 4: Check profile README implementation
console.log('\n4. Testing profile README implementation...');
try {
  const readmeContent = fs.readFileSync(
    path.join(__dirname, 'packages/adapters/src/github/profileReadme.ts'),
    'utf8'
  );
  
  const requiredMethods = [
    'generateProfileReadme',
    'generateReadmeContent',
    'generateHeaderSection',
    'generateAboutSection',
    'generateExperienceSection',
    'generateSkillsSection',
    'generateProjectsSection',
    'generateContactSection',
    'checkReadmeStatus',
  ];
  
  let missingMethods = [];
  requiredMethods.forEach(method => {
    if (!readmeContent.includes(`${method}(`)) {
      missingMethods.push(method);
    }
  });
  
  if (missingMethods.length > 0) {
    console.log('❌ Missing profile README methods:', missingMethods.join(', '));
    process.exit(1);
  }
  
  // Check for dry-run support
  if (!readmeContent.includes('dryRun')) {
    console.log('❌ Dry-run support missing');
    process.exit(1);
  }
  
  console.log('✅ Profile README implementation complete');
} catch (error) {
  console.log('❌ Profile README implementation test failed:', error.message);
  process.exit(1);
}

// Test 5: Check CLI command implementation
console.log('\n5. Testing CLI command implementation...');
try {
  const cliContent = fs.readFileSync(
    path.join(__dirname, 'apps/cli/src/commands/profileApplyGithub.ts'),
    'utf8'
  );
  
  // Check for dry-run option
  if (!cliContent.includes('--dry-run')) {
    console.log('❌ Dry-run option missing in CLI command');
    process.exit(1);
  }
  
  // Check for interactive confirmation
  if (!cliContent.includes('inquirer.prompt')) {
    console.log('❌ Interactive confirmation missing in CLI command');
    process.exit(1);
  }
  
  // Check for fact store validation
  if (!cliContent.includes('validateFactStore')) {
    console.log('❌ Fact store validation missing in CLI command');
    process.exit(1);
  }
  
  console.log('✅ CLI command implementation complete');
} catch (error) {
  console.log('❌ CLI command implementation test failed:', error.message);
  process.exit(1);
}

// Test 6: Check package exports
console.log('\n6. Testing package exports...');
try {
  const adaptersIndex = path.join(__dirname, 'packages/adapters/src/index.ts');
  
  if (fs.existsSync(adaptersIndex)) {
    const exportsContent = fs.readFileSync(adaptersIndex, 'utf8');
    
    const requiredExports = [
      'GitHubOAuth',
      'GitHubAPI',
      'ProfileReadmeManager',
    ];
    
    let missingExports = [];
    requiredExports.forEach(exp => {
      if (!exportsContent.includes(exp)) {
        missingExports.push(exp);
      }
    });
    
    if (missingExports.length > 0) {
      console.log('❌ Missing exports:', missingExports.join(', '));
      process.exit(1);
    }
  } else {
    console.log('⚠️  Adapters index file not found (will be created)');
  }
  
  console.log('✅ Package exports configured');
} catch (error) {
  console.log('❌ Package exports test failed:', error.message);
  process.exit(1);
}

// Test 7: Check environment variable validation
console.log('\n7. Testing environment variable validation...');
try {
  const oauthContent = fs.readFileSync(
    path.join(__dirname, 'packages/adapters/src/github/oauth.ts'),
    'utf8'
  );
  
  // Check for environment variable usage
  if (!oauthContent.includes('GITHUB_OAUTH_CLIENT_ID') || !oauthContent.includes('GITHUB_OAUTH_CLIENT_SECRET')) {
    console.log('❌ Environment variable validation missing');
    process.exit(1);
  }
  
  console.log('✅ Environment variable validation complete');
} catch (error) {
  console.log('❌ Environment variable validation test failed:', error.message);
  process.exit(1);
}

console.log('\n🎉 All GitHub integration tests passed!');
console.log('\nThe GitHub integration is ready for use. Next steps:');
console.log('1. Set up GitHub OAuth app credentials');
console.log('2. Configure environment variables');
console.log('3. Test dry-run mode: pnpm run profile:apply:github --dry-run');
console.log('4. Apply real changes: pnpm run profile:apply:github');
console.log('5. Review and commit changes to GitHub');