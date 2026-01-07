#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Python training scaffold...\n');

// Test 1: Check if training files exist
console.log('1. Testing training scaffold file existence...');
try {
  const requiredFiles = [
    'tools/ml/requirements.txt',
    'tools/ml/train_ranker.py',
    'docs/ML_TRAINING.md',
  ];
  
  let missingFiles = [];
  requiredFiles.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (!fs.existsSync(fullPath)) {
      missingFiles.push(file);
    }
  });
  
  if (missingFiles.length > 0) {
    console.log('❌ Missing training files:', missingFiles.join(', '));
    process.exit(1);
  }
  
  console.log('✅ All training scaffold files exist');
} catch (error) {
  console.log('❌ Training scaffold file test failed:', error.message);
  process.exit(1);
}

// Test 2: Check training script structure
console.log('\n2. Testing training script structure...');
try {
  const scriptContent = fs.readFileSync(
    path.join(__dirname, 'tools/ml/train_ranker.py'),
    'utf8'
  );
  
  const requiredFunctions = [
    'PairwiseRankingDataset',
    'PairwiseRanker',
    'load_dataset',
    'train_model',
    'main',
  ];
  
  let missingFunctions = [];
  requiredFunctions.forEach(func => {
    if (!scriptContent.includes(func)) {
      missingFunctions.push(func);
    }
  });
  
  if (missingFunctions.length > 0) {
    console.log('❌ Missing training script functions:', missingFunctions.join(', '));
    process.exit(1);
  }
  
  // Check for ONNX export
  if (!scriptContent.includes('torch.onnx.export')) {
    console.log('❌ ONNX export not found in training script');
    process.exit(1);
  }
  
  // Check for model saving
  if (!scriptContent.includes('torch.save')) {
    console.log('❌ Model saving not found in training script');
    process.exit(1);
  }
  
  console.log('✅ Training script structure is correct');
} catch (error) {
  console.log('❌ Training script structure test failed:', error.message);
  process.exit(1);
}

// Test 3: Check requirements file
console.log('\n3. Testing requirements file...');
try {
  const requirementsContent = fs.readFileSync(
    path.join(__dirname, 'tools/ml/requirements.txt'),
    'utf8'
  );
  
  const requiredPackages = [
    'numpy',
    'torch',
    'onnx',
    'scikit-learn',
  ];
  
  let missingPackages = [];
  requiredPackages.forEach(pkg => {
    if (!requirementsContent.includes(pkg)) {
      missingPackages.push(pkg);
    }
  });
  
  if (missingPackages.length > 0) {
    console.log('❌ Missing packages in requirements:', missingPackages.join(', '));
    process.exit(1);
  }
  
  console.log('✅ Requirements file contains all necessary packages');
} catch (error) {
  console.log('❌ Requirements file test failed:', error.message);
  process.exit(1);
}

// Test 4: Check documentation
console.log('\n4. Testing training documentation...');
try {
  const docsContent = fs.readFileSync(
    path.join(__dirname, 'docs/ML_TRAINING.md'),
    'utf8'
  );
  
  const requiredSections = [
    '## Overview',
    '## Setup',
    '## Training the Model',
    '## Output Files',
    '## Model Architecture',
    '## Dataset Format',
  ];
  
  let missingSections = [];
  requiredSections.forEach(section => {
    if (!docsContent.includes(section)) {
      missingSections.push(section);
    }
  });
  
  if (missingSections.length > 0) {
    console.log('❌ Missing documentation sections:', missingSections.join(', '));
    process.exit(1);
  }
  
  console.log('✅ Training documentation is complete');
} catch (error) {
  console.log('❌ Documentation test failed:', error.message);
  process.exit(1);
}

// Test 5: Check if Python script is executable
console.log('\n5. Testing Python script execution...');
try {
  // Check if script has proper shebang
  const scriptContent = fs.readFileSync(
    path.join(__dirname, 'tools/ml/train_ranker.py'),
    'utf8'
  );
  
  if (!scriptContent.startsWith('#!/usr/bin/env python3')) {
    console.log('❌ Training script missing shebang');
    process.exit(1);
  }
  
  // Check if script has main block
  if (!scriptContent.includes('if __name__ == "__main__":')) {
    console.log('❌ Training script missing main block');
    process.exit(1);
  }
  
  console.log('✅ Python script is properly structured');
} catch (error) {
  console.log('❌ Python script test failed:', error.message);
  process.exit(1);
}

console.log('\n🎉 All training scaffold tests passed!');
console.log('\nThe Python training scaffold is ready for use. Next steps:');
console.log('1. Install Python dependencies: pip install -r tools/ml/requirements.txt');
console.log('2. Collect training data using the ranker CLI commands');
console.log('3. Export dataset to JSONL format');
console.log('4. Train the model: python tools/ml/train_ranker.py --input dataset.jsonl --output models/');
console.log('5. Use the trained ONNX model for inference in the main application');