import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { SQLiteRankItemRepository, SQLiteRankPairRepository, SQLiteRankRunRepository } from '@ancso/core';
import { RankerInferenceService, RankerConfigService } from '@ancso/ml';
import ora from 'ora';

function rankerCommands(): Command {
  const command = new Command('ranker')
    .description('Ranker model management commands');

  command.addCommand(new Command('status')
    .description('Check ranker model status')
    .action(async () => {
      try {
        console.log(chalk.blue('Ranker Model Status'));
        console.log('=======================\n');

        const inferenceService = new RankerInferenceService();
        const status = inferenceService.getStatus();
        const configService = new RankerConfigService();
        const activeModel = configService.getActiveModel();

        console.log(`Status: ${status.active ? chalk.green('ACTIVE') : chalk.yellow('INACTIVE')}`);
        console.log(`Provenance: ${status.provenance}`);

        if (status.active && status.modelVersion) {
          console.log(`Model: ${status.modelVersion}`);
        }

        if (activeModel) {
          console.log('\n📁 Model Files:');
          console.log(`  Model: ${activeModel.model}`);
          console.log(`  Metadata: ${activeModel.metadata}`);
        }

        const runRepo = new SQLiteRankRunRepository();
        const latestRun = await runRepo.findLatest();
        if (latestRun) {
          console.log('\n🏃 Latest Training Run:');
          console.log(`  Dataset Hash: ${latestRun.datasetHash.substring(0, 8)}...`);
          console.log(`  Created: ${latestRun.createdAt}`);
          if (latestRun.trainMetrics) {
            console.log('  Metrics:');
            Object.entries(latestRun.trainMetrics).forEach(([key, value]) => {
              console.log(`    ${key}: ${typeof value === 'number' ? value.toFixed(4) : value}`);
            });
          }
        }

        const itemRepo = new SQLiteRankItemRepository();
        const pairRepo = new SQLiteRankPairRepository();

        const itemCount = await itemRepo.count();
        const pairCount = await pairRepo.count();
        const labelDist = await pairRepo.getLabelDistribution();

        console.log('\n📊 Dataset Statistics:');
        console.log(`  Total Items: ${itemCount}`);
        console.log(`  Total Pairs: ${pairCount}`);
        console.log('  Label Distribution:');
        console.log(`    A > B: ${labelDist['1'] || 0}`);
        console.log(`    B > A: ${labelDist['-1'] || 0}`);
        console.log(`    Equal: ${labelDist['0'] || 0}`);

        console.log('\n💡 Commands:');
        console.log('  pnpm cli ranker:bootstrap  - Create initial training pairs');
        console.log('  pnpm cli ranker:export     - Export dataset for training');
        console.log('  pnpm cli ranker:train      - Train and activate model');
        console.log('  pnpm cli ranker:smoke      - Test model inference');

      } catch (error) {
        console.error(chalk.red('Failed to get ranker status:'), error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    }));

  command.addCommand(new Command('smoke')
    .description('Test ranker model inference')
    .action(async () => {
      try {
        console.log(chalk.blue('Ranker Smoke Test'));
        console.log('=====================\n');

        const inferenceService = new RankerInferenceService();
        const initialized = await inferenceService.initialize();

        if (!initialized) {
          console.log(chalk.yellow('⚠️  Ranker model not active. Running heuristic fallback test.\n'));
        }

        const testCases = [
          {
            a: { id: '1', platform: 'linkedin', section: 'headline', sourceRef: 'Experienced software engineer', score: 0, metrics: { clarity: 0.8, impact: 0.7, relevance: 0.9 } },
            b: { id: '2', platform: 'linkedin', section: 'headline', sourceRef: 'Developer', score: 0, metrics: { clarity: 0.5, impact: 0.4, relevance: 0.6 } },
          },
          {
            a: { id: '3', platform: 'github', section: 'readme', sourceRef: 'Built scalable systems handling 10M users', score: 0, metrics: { clarity: 0.9, impact: 0.95, relevance: 0.85 } },
            b: { id: '4', platform: 'github', section: 'readme', sourceRef: 'My cool project', score: 0, metrics: { clarity: 0.6, impact: 0.5, relevance: 0.7 } },
          },
        ];

        console.log('🧪 Running smoke tests...\n');

        for (let i = 0; i < testCases.length; i++) {
          const test = testCases[i];
          console.log(`Test ${i + 1}:`);
          console.log(`  A: "${test.a.sourceRef}"`);
          console.log(`  B: "${test.b.sourceRef}"`);

          const result = await inferenceService.compare(test.a as any, test.b as any);
          
          console.log(`  Score A: ${result.aScore.toFixed(4)}`);
          console.log(`  Score B: ${result.bScore.toFixed(4)}`);
          console.log(`  Preference: ${result.preference > 0 ? 'A > B' : result.preference < 0 ? 'B > A' : 'Equal'}`);
          console.log(`  Confidence: ${(result.confidence * 100).toFixed(1)}%`);
          console.log(`  Provenance: ${result.provenance}`);
          console.log('');
        }

        console.log(chalk.green('✅ Smoke test complete!'));

      } catch (error) {
        console.error(chalk.red('Smoke test failed:'), error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    }));

  command.addCommand(new Command('bootstrap')
    .description('Create initial training pairs from benchmark data')
    .option('--platform <platform>', 'Platform to bootstrap (linkedin, github)', 'github')
    .option('--n-pairs <n>', 'Number of pairs to generate', '500')
    .option('--diversity <n>', 'Diversity factor (0-1)', '0.3')
    .action(async (options) => {
      try {
        console.log(chalk.blue('Bootstrapping Ranker Training Data'));
        console.log('======================================\n');

        const nPairs = parseInt(options.nPairs);
        if (isNaN(nPairs) || nPairs < 1) {
          console.error(chalk.red('Invalid number of pairs'));
          process.exit(1);
        }

        const { RankerDataPipelineService } = await import('@ancso/ml');
        const pipeline = new RankerDataPipelineService();

        console.log(chalk.yellow('🔧 Creating rank items from benchmarks...'));
        const itemsCreated = await pipeline.createRankItemsFromBenchmarks(options.platform as 'github' | 'linkedin');
        console.log(`  Created ${itemsCreated} rank items`);

        console.log(chalk.yellow('\n🎲 Generating training pairs...'));
        const pairsCreated = await pipeline.bootstrapPairs(
          options.platform as 'github' | 'linkedin',
          nPairs,
          parseFloat(options.diversity)
        );

        console.log(chalk.green('\n✅ Bootstrap complete!'));
        console.log(`  Pairs created: ${pairsCreated}`);
        console.log(`  Platform: ${options.platform}`);
        console.log(`  Diversity factor: ${options.diversity}`);
        console.log('\nNext steps:');
        console.log('1. Run: pnpm cli ranker:export --out data/ranker');
        console.log('2. Run: pnpm cli ranker:train --epochs 50');

      } catch (error) {
        console.error(chalk.red('Bootstrap failed:'), error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    }));

  command.addCommand(new Command('export')
    .description('Export ranker dataset to JSONL format')
    .option('--platform <platform>', 'Platform to export (linkedin, github)', 'github')
    .option('--out <path>', 'Output directory', 'data/ranker')
    .action(async (options) => {
      try {
        console.log(chalk.blue('Exporting Ranker Dataset'));
        console.log('============================\n');

        const { RankerDataPipelineService } = await import('@ancso/ml');
        const pipeline = new RankerDataPipelineService();

        const result = await pipeline.exportDataset(
          options.platform as 'github' | 'linkedin',
          options.out
        );

        console.log(chalk.green('✅ Dataset exported!'));
        console.log(`\n📁 Output Files:`);
        console.log(`  Dataset: ${result.datasetPath}`);
        console.log(`  Metadata: ${result.metadataPath}`);
        console.log(`\n📊 Statistics:`);
        console.log(`  Items: ${result.itemCount}`);
        console.log(`  Pairs Exported: ${result.pairCount}`);
        console.log(`  Skipped: ${result.skippedPairs}`);
        console.log(`  Dataset Hash: ${result.datasetHash.substring(0, 16)}...`);
        console.log(`\n💡 Next step: pnpm cli ranker:train --epochs 50`);

      } catch (error) {
        console.error(chalk.red('Export failed:'), error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    }));

  command.addCommand(new Command('validate')
    .description('Validate ranker dataset')
    .option('--dataset <path>', 'Dataset file path', 'data/ranker/dataset.jsonl')
    .option('--metadata <path>', 'Metadata file path', 'data/ranker/metadata.json')
    .action(async (options) => {
      try {
        console.log(chalk.blue('Validating Ranker Dataset'));
        console.log('=============================\n');

        const { RankerDataPipelineService } = await import('@ancso/ml');
        const pipeline = new RankerDataPipelineService();

        const result = await pipeline.validateDataset(options.dataset, options.metadata);

        console.log(`Dataset Valid: ${result.valid ? chalk.green('YES') : chalk.red('NO')}`);
        console.log('\n📊 Stats:');
        Object.entries(result.stats).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });

        if (result.issues.length > 0) {
          console.log(chalk.red('\n⚠️  Issues found:'));
          result.issues.forEach(issue => console.log(`  - ${issue}`));
        } else {
          console.log(chalk.green('\n✅ No issues found!'));
        }

        process.exit(result.valid ? 0 : 1);

      } catch (error) {
        console.error(chalk.red('Validation failed:'), error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    }));

  command.addCommand(new Command('train')
    .description('Train ranker model')
    .option('--data <path>', 'Dataset directory', 'data/ranker')
    .option('--epochs <n>', 'Training epochs', '50')
    .option('--batch-size <n>', 'Batch size', '32')
    .action(async (options) => {
      try {
        console.log(chalk.blue('Training Ranker Model'));
        console.log('=========================\n');

        const dataDir = path.resolve(options.data);
        const datasetPath = path.join(dataDir, 'dataset.jsonl');
        const metadataPath = path.join(dataDir, 'metadata.json');

        if (!fs.existsSync(datasetPath) || !fs.existsSync(metadataPath)) {
          console.log(chalk.yellow('⚠️  Dataset not found. Run these commands first:'));
          console.log('  pnpm cli ranker:bootstrap --platform github --n-pairs 200');
          console.log('  pnpm cli ranker:export --out data/ranker');
          console.log('  pnpm cli ranker:train');
          process.exit(1);
        }

        const venvPython = path.join('tools/ml/venv/bin/python');
        const trainScript = path.join('tools/ml/train_ranker.py');

        if (!fs.existsSync(venvPython)) {
          console.log(chalk.yellow('⚠️  Python venv not found. Setup required:'));
          console.log('  cd tools/ml');
          console.log('  python3 -m venv venv');
          console.log('  venv/bin/pip install -r requirements.txt');
          process.exit(1);
        }

        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        console.log(`📊 Dataset: ${metadata.pairCount} pairs, ${metadata.featureNames.length} features`);

        const modelsDir = 'models';
        if (!fs.existsSync(modelsDir)) {
          fs.mkdirSync(modelsDir, { recursive: true });
        }

        const cmd = `${venvPython} ${trainScript} \
          --input ${datasetPath} \
          --output ${modelsDir} \
          --epochs ${options.epochs} \
          --batch-size ${options.batchSize} \
          --embedding-dim ${metadata.embeddingDim} \
          --metrics-dim ${metadata.metricsDim}`;

        console.log('\n🏃 Starting training...\n');

        const { execSync } = require('child_process');
        execSync(cmd, { stdio: 'inherit' });

        console.log(chalk.green('\n✅ Training complete!'));

        const activeModelPath = 'models/active_model.json';
        if (fs.existsSync(activeModelPath)) {
          console.log('\n📦 Activating model...');
          const configService = new RankerConfigService();
          const activeData = JSON.parse(fs.readFileSync(activeModelPath, 'utf-8'));
          configService.setActiveModel(activeData.model, activeData.metadata);
          console.log(chalk.green('✅ Model activated!'));
        }

      } catch (error) {
        if ((error as any).status === 1) {
          console.log(chalk.yellow('\n⚠️  Training failed. Check Python environment.'));
        } else {
          console.error(chalk.red('Training failed:'), error instanceof Error ? error.message : 'Unknown error');
        }
        process.exit(1);
      }
    }));

  command.addCommand(new Command('label')
    .description('Manually label a pair')
    .option('--a <id>', 'First item ID')
    .option('--b <id>', 'Second item ID')
    .option('--better <a|b>', 'Which is better')
    .option('--tags <tags>', 'Comma-separated reason tags')
    .action(async (options) => {
      try {
        console.log(chalk.blue('Adding Manual Label'));
        console.log('======================\n');

        if (!options.a || !options.b || !options.better) {
          console.log('Usage: pnpm cli ranker:label --a <id> --b <id> --better a|b --tags tags');
          process.exit(1);
        }

        const itemRepo = new SQLiteRankItemRepository();
        const pairRepo = new SQLiteRankPairRepository();

        const itemA = await itemRepo.findById(options.a);
        const itemB = await itemRepo.findById(options.b);

        if (!itemA || !itemB) {
          console.error(chalk.red('One or both items not found'));
          process.exit(1);
        }

        const label = options.better === 'a' ? 1 : -1;
        const reasonTags = options.tags ? options.tags.split(',').map(t => t.trim()) : [];

        const pair = await pairRepo.create({
          id: randomUUID(),
          aItemId: options.a,
          bItemId: options.b,
          label,
          reasonTags,
          source: 'user_choice',
          createdAt: new Date().toISOString(),
        });

        console.log(chalk.green('✅ Pair labeled!'));
        console.log(`  A: "${itemA.sourceRef}"`);
        console.log(`  B: "${itemB.sourceRef}"`);
        console.log(`  Result: ${options.better === 'a' ? 'A > B' : 'B > A'}`);
        if (reasonTags.length > 0) {
          console.log(`  Tags: ${reasonTags.join(', ')}`);
        }

      } catch (error) {
        console.error(chalk.red('Failed to add label:'), error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    }));

  return command;
}

function extractMetrics(item: any, featureNames: string[]): number[] {
  if (!item.metrics) {
    return featureNames.map(() => 0);
  }
  return featureNames.map(name => item.metrics[name] || 0);
}

function computeQualityScore(item: any): number {
  if (!item.metrics) return 0;

  let score = 0;
  const m = item.metrics;

  score += (m.clarity || 0) * 0.3;
  score += (m.impact || 0) * 0.3;
  score += (m.relevance || 0) * 0.2;
  score += (m.completeness || 0) * 0.2;

  return Math.min(1, score);
}

export { rankerCommands };
