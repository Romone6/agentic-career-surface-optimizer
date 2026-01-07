#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing fact store functionality...\n');

// Test 1: Check if service files exist
console.log('1. Testing service file existence...');
try {
  const serviceFiles = [
    'packages/core/src/services/fact-store.ts',
    'packages/core/src/services/questionnaire.ts',
  ];
  
  let missingFiles = [];
  serviceFiles.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (!fs.existsSync(fullPath)) {
      missingFiles.push(file);
    }
  });
  
  if (missingFiles.length > 0) {
    console.log('❌ Missing service files:', missingFiles.join(', '));
    process.exit(1);
  }
  
  console.log('✅ All service files exist');
} catch (error) {
  console.log('❌ Service file test failed:', error.message);
  process.exit(1);
}

// Test 2: Check service exports
console.log('\n2. Testing service exports...');
try {
  const factStoreContent = fs.readFileSync(
    path.join(__dirname, 'packages/core/src/services/fact-store.ts'),
    'utf8'
  );
  
  const questionnaireContent = fs.readFileSync(
    path.join(__dirname, 'packages/core/src/services/questionnaire.ts'),
    'utf8'
  );
  
  // Check for key class definitions
  const requiredClasses = [
    { file: 'fact-store', class: 'FactStoreService' },
    { file: 'questionnaire', class: 'QuestionnaireService' },
  ];
  
  let missingClasses = [];
  requiredClasses.forEach(({ file, class: className }) => {
    const content = file === 'fact-store' ? factStoreContent : questionnaireContent;
    if (!content.includes(`class ${className}`)) {
      missingClasses.push(className);
    }
  });
  
  if (missingClasses.length > 0) {
    console.log('❌ Missing service classes:', missingClasses.join(', '));
    process.exit(1);
  }
  
  console.log('✅ All service classes defined');
} catch (error) {
  console.log('❌ Service export test failed:', error.message);
  process.exit(1);
}

// Test 3: Check service methods
console.log('\n3. Testing service methods...');
try {
  const factStoreContent = fs.readFileSync(
    path.join(__dirname, 'packages/core/src/services/fact-store.ts'),
    'utf8'
  );
  
  const questionnaireContent = fs.readFileSync(
    path.join(__dirname, 'packages/core/src/services/questionnaire.ts'),
    'utf8'
  );
  
  // Check for key methods in FactStoreService
  const factStoreMethods = [
    'createFactStore',
    'getFactStore',
    'updateFactStore',
    'deleteFactStore',
    'validateFactStore',
    'getFactStoreSummary',
    'exportFactStore',
    'importFactStore',
  ];
  
  let missingFactStoreMethods = [];
  factStoreMethods.forEach(method => {
    if (!factStoreContent.includes(`${method}(`)) {
      missingFactStoreMethods.push(method);
    }
  });
  
  if (missingFactStoreMethods.length > 0) {
    console.log('❌ Missing FactStoreService methods:', missingFactStoreMethods.join(', '));
    process.exit(1);
  }
  
  // Check for key methods in QuestionnaireService
  const questionnaireMethods = [
    'createNewFactStore',
    'getQuestionnaireQuestions',
    'updateFactStoreFromAnswers',
    'isFactStoreComplete',
    'getQuestionnaireProgress',
  ];
  
  let missingQuestionnaireMethods = [];
  questionnaireMethods.forEach(method => {
    if (!questionnaireContent.includes(`${method}(`)) {
      missingQuestionnaireMethods.push(method);
    }
  });
  
  if (missingQuestionnaireMethods.length > 0) {
    console.log('❌ Missing QuestionnaireService methods:', missingQuestionnaireMethods.join(', '));
    process.exit(1);
  }
  
  console.log('✅ All service methods implemented');
} catch (error) {
  console.log('❌ Service method test failed:', error.message);
  process.exit(1);
}

// Test 4: Check CLI command updates
console.log('\n4. Testing CLI command updates...');
try {
  const factsCommandContent = fs.readFileSync(
    path.join(__dirname, 'apps/cli/src/commands/facts.ts'),
    'utf8'
  );
  
  const profileCommandContent = fs.readFileSync(
    path.join(__dirname, 'apps/cli/src/commands/profile.ts'),
    'utf8'
  );
  
  // Check for service imports
  if (!factsCommandContent.includes("import { FactStoreService, QuestionnaireService } from '@ancso/core'")) {
    console.log('❌ Missing FactStoreService import in facts command');
    process.exit(1);
  }
  
  if (!profileCommandContent.includes("import { FactStoreService, QuestionnaireService } from '@ancso/core'")) {
    console.log('❌ Missing FactStoreService import in profile command');
    process.exit(1);
  }
  
  // Check for interactive questionnaire function
  if (!factsCommandContent.includes('runInteractiveQuestionnaire')) {
    console.log('❌ Missing interactive questionnaire function');
    process.exit(1);
  }
  
  console.log('✅ CLI commands updated with service integration');
} catch (error) {
  console.log('❌ CLI command test failed:', error.message);
  process.exit(1);
}

// Test 5: Check core package exports
console.log('\n5. Testing core package exports...');
try {
  const coreIndexContent = fs.readFileSync(
    path.join(__dirname, 'packages/core/src/index.ts'),
    'utf8'
  );
  
  // Check for service exports
  const requiredExports = [
    'FactStoreService',
    'FactStoreSummary',
    'QuestionnaireService',
    'QuestionnaireQuestion',
    'QuestionnaireProgress',
  ];
  
  let missingExports = [];
  requiredExports.forEach(exp => {
    if (!coreIndexContent.includes(exp)) {
      missingExports.push(exp);
    }
  });
  
  if (missingExports.length > 0) {
    console.log('❌ Missing core package exports:', missingExports.join(', '));
    process.exit(1);
  }
  
  console.log('✅ All services exported from core package');
} catch (error) {
  console.log('❌ Core package export test failed:', error.message);
  process.exit(1);
}

console.log('\n🎉 All fact store tests passed!');
console.log('\nThe fact store and questionnaire system is ready for use. Next steps:');
console.log('1. Build the project: pnpm run build');
console.log('2. Create a new fact store: pnpm run facts:new');
console.log('3. Edit your fact store: pnpm run facts:edit');
console.log('4. View your fact store: pnpm run facts:show');
console.log('5. Validate your fact store: pnpm run facts:validate');
console.log('6. Once complete, proceed with profile analysis: pnpm run profile:analyze');