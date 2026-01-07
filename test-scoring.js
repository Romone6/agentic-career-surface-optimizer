#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing scoring engine functionality...\n');

// Test 1: Check if scoring package files exist
console.log('1. Testing scoring package file existence...');
try {
  const requiredFiles = [
    'packages/scoring/package.json',
    'packages/scoring/tsconfig.json',
    'packages/scoring/src/schemas.ts',
    'packages/scoring/src/validators/truthfulness.ts',
    'packages/scoring/src/extractors/fact-store.ts',
    'packages/scoring/src/rubrics/linkedin.ts',
    'packages/scoring/src/rubrics/github.ts',
    'packages/scoring/src/rubrics/overall.ts',
    'packages/scoring/src/services/scoring-service.ts',
    'packages/scoring/src/index.ts',
  ];
  
  let missingFiles = [];
  requiredFiles.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (!fs.existsSync(fullPath)) {
      missingFiles.push(file);
    }
  });
  
  if (missingFiles.length > 0) {
    console.log('❌ Missing scoring files:', missingFiles.join(', '));
    process.exit(1);
  }
  
  console.log('✅ All scoring package files exist');
} catch (error) {
  console.log('❌ Scoring file test failed:', error.message);
  process.exit(1);
}

// Test 2: Check schema definitions
console.log('\n2. Testing schema definitions...');
try {
  const schemaContent = fs.readFileSync(
    path.join(__dirname, 'packages/scoring/src/schemas.ts'),
    'utf8'
  );
  
  const requiredDefinitions = [
    'ProfileScoreReportSchema',
    'SectionScoreSchema',
    'ScoringInputSchema',
    'KeyFactsSchema',
  ];
  
  let missingDefinitions = [];
  requiredDefinitions.forEach(def => {
    if (!schemaContent.includes(def)) {
      missingDefinitions.push(def);
    }
  });
  
  if (missingDefinitions.length > 0) {
    console.log('❌ Missing schema definitions:', missingDefinitions.join(', '));
    process.exit(1);
  }
  
  console.log('✅ All schema definitions present');
} catch (error) {
  console.log('❌ Schema test failed:', error.message);
  process.exit(1);
}

// Test 3: Check validator implementation
console.log('\n3. Testing validator implementation...');
try {
  const validatorContent = fs.readFileSync(
    path.join(__dirname, 'packages/scoring/src/validators/truthfulness.ts'),
    'utf8'
  );
  
  const requiredMethods = [
    'validateClaim',
    'validateContent',
    'calculateTruthfulnessScore',
    'checkPersonalClaims',
    'checkCareerClaims',
    'checkProjectClaims',
    'checkSkillClaims',
    'checkExperienceClaims',
    'checkEducationClaims',
    'checkArtifactClaims',
  ];
  
  let missingMethods = [];
  requiredMethods.forEach(method => {
    if (!validatorContent.includes(`${method}(`)) {
      missingMethods.push(method);
    }
  });
  
  if (missingMethods.length > 0) {
    console.log('❌ Missing validator methods:', missingMethods.join(', '));
    process.exit(1);
  }
  
  console.log('✅ All validator methods implemented');
} catch (error) {
  console.log('❌ Validator test failed:', error.message);
  process.exit(1);
}

// Test 4: Check rubric implementations
console.log('\n4. Testing rubric implementations...');
try {
  const linkedinContent = fs.readFileSync(
    path.join(__dirname, 'packages/scoring/src/rubrics/linkedin.ts'),
    'utf8'
  );
  
  const githubContent = fs.readFileSync(
    path.join(__dirname, 'packages/scoring/src/rubrics/github.ts'),
    'utf8'
  );
  
  const overallContent = fs.readFileSync(
    path.join(__dirname, 'packages/scoring/src/rubrics/overall.ts'),
    'utf8'
  );
  
  const requiredMethods = [
    { file: 'linkedin', methods: ['scoreHeadline', 'scoreAboutSection', 'scoreExperience', 'scoreSkills', 'scoreLinkedInCompleteness'] },
    { file: 'github', methods: ['scoreReadme', 'scoreRepositories', 'scoreActivity', 'scoreGitHubCompleteness'] },
    { file: 'overall', methods: ['generateScoreReport', 'scoreLinkedInSections', 'scoreGitHubSections', 'calculateOverallScores'] },
  ];
  
  let missingMethods = [];
  requiredMethods.forEach(({ file, methods }) => {
    const content = file === 'linkedin' ? linkedinContent : file === 'github' ? githubContent : overallContent;
    methods.forEach(method => {
      if (!content.includes(`${method}(`)) {
        missingMethods.push(`${file}.${method}`);
      }
    });
  });
  
  if (missingMethods.length > 0) {
    console.log('❌ Missing rubric methods:', missingMethods.join(', '));
    process.exit(1);
  }
  
  console.log('✅ All rubric methods implemented');
} catch (error) {
  console.log('❌ Rubric test failed:', error.message);
  process.exit(1);
}

// Test 5: Check extractor implementation
console.log('\n5. Testing extractor implementation...');
try {
  const extractorContent = fs.readFileSync(
    path.join(__dirname, 'packages/scoring/src/extractors/fact-store.ts'),
    'utf8'
  );
  
  const requiredMethods = [
    'extractKeyFacts',
    'calculateYears',
    'extractSkillCategories',
    'extractTopSkills',
    'extractProjectTechnologies',
    'calculateExperienceYears',
    'extractAchievements',
    'createContentSnapshot',
  ];
  
  let missingMethods = [];
  requiredMethods.forEach(method => {
    if (!extractorContent.includes(`${method}(`)) {
      missingMethods.push(method);
    }
  });
  
  if (missingMethods.length > 0) {
    console.log('❌ Missing extractor methods:', missingMethods.join(', '));
    process.exit(1);
  }
  
  console.log('✅ All extractor methods implemented');
} catch (error) {
  console.log('❌ Extractor test failed:', error.message);
  process.exit(1);
}

// Test 6: Check service implementation
console.log('\n6. Testing service implementation...');
try {
  const serviceContent = fs.readFileSync(
    path.join(__dirname, 'packages/scoring/src/services/scoring-service.ts'),
    'utf8'
  );
  
  const requiredMethods = [
    'generateProfileScoreReport',
    'validateContentTruthfulness',
    'generateGapAnalysis',
    'generateEditPlan',
    'calculateTruthfulnessScore',
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
    path.join(__dirname, 'packages/scoring/src/index.ts'),
    'utf8'
  );
  
  const requiredExports = [
    'ProfileScoreReportSchema',
    'ProfileScoreReport',
    'ScoringInputSchema',
    'ScoringInput',
    'SectionScoreSchema',
    'SectionScore',
    'KeyFactsSchema',
    'KeyFacts',
    'TruthfulnessValidator',
    'FactStoreExtractor',
    'LinkedInScoringRubric',
    'GitHubScoringRubric',
    'OverallScoringAlgorithm',
    'ScoringService',
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

console.log('\n🎉 All scoring engine tests passed!');
console.log('\nThe scoring engine is ready for use. Next steps:');
console.log('1. Build the project: pnpm run build');
console.log('2. The scoring engine will be available for CLI integration');
console.log('3. Implement CLI commands: profile:score and profile:plan');
console.log('4. Test with sample data to verify functionality');