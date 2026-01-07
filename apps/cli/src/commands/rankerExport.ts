import { Command } from 'commander';
import chalk from 'chalk';
import { RankerDatasetService } from '@ancso/ml';
import fs from 'fs';
import path from 'path';
import ora from 'ora';

export function rankerExportCommand(): Command {
  return new Command('export')
    .description('Export ranker dataset to JSONL format')
    .option('-u, --user-id <userId>', 'User ID for the dataset', 'default-user')
    .option('-o, --output <path>', 'Output file path')
    .option('-s, --stats', 'Show dataset statistics only')
    .action(async (options) => {
      try {
        console.log(chalk.blue('Exporting ranker dataset...\n'));

        // Initialize service
        const rankerService = new RankerDatasetService();

        if (options.stats) {
          // Show statistics only
          const spinner = ora('Calculating dataset statistics...').start();
          const stats = await rankerService.getDatasetStatistics(options.userId);
          spinner.succeed('Statistics calculated!');

          console.log('\n📊 DATASET STATISTICS');
          console.log('=====================');
          console.log(`User ID: ${options.userId}`);
          console.log(`Total Items: ${stats.itemCount}`);
          console.log(`Total Pairs: ${stats.pairCount}`);
          console.log('\nLabel Distribution:');
          Object.entries(stats.labelDistribution).forEach(([label, count]) => {
            const labelName = label === '1' ? 'A > B' : label === '-1' ? 'B > A' : 'A = B';
            const percentage = Math.round((count / stats.pairCount) * 100);
            console.log(`  ${labelName}: ${count} (${percentage}%)`);
          });

          if (stats.pairCount > 0) {
            console.log('\n💡 Dataset Quality Indicators:');
            const balance = Math.abs((stats.labelDistribution['1'] || 0) - (stats.labelDistribution['-1'] || 0));
            const balanceScore = Math.max(0, 100 - (balance / stats.pairCount) * 100);
            console.log(`  Balance Score: ${balanceScore.toFixed(1)}/100`);
            
            const diversity = Object.keys(stats.labelDistribution).length;
            console.log(`  Label Diversity: ${diversity}/3`);
            
            const pairsPerItem = stats.pairCount / stats.itemCount;
            console.log(`  Pairs per Item: ${pairsPerItem.toFixed(2)}`);
          }

          return;
        }

        // Validate output path
        if (!options.output) {
          console.log(chalk.red('Error: --output is required for export'));
          process.exit(1);
        }

        const outputPath = path.resolve(options.output);
        
        // Ensure directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        // Export dataset
        const spinner = ora('Exporting dataset...').start();
        
        // First get statistics
        const stats = await rankerService.getDatasetStatistics(options.userId);
        
        if (stats.pairCount === 0) {
          spinner.fail('No pairwise preferences found in dataset');
          console.log('Add some preferences first using: pnpm run ranker:add-pair');
          process.exit(1);
        }

        // Export to JSONL
        await rankerService.exportDatasetToJSONL(options.userId, outputPath);
        spinner.succeed(`Dataset exported to ${outputPath}`);

        console.log('\n🎉 DATASET EXPORT COMPLETE');
        console.log('==========================');
        console.log(`Output File: ${outputPath}`);
        console.log(`Format: JSONL (JSON Lines)`);
        console.log(`Total Rows: ${stats.pairCount}`);

        // Show sample row
        console.log('\n📋 SAMPLE DATASET ROW:');
        console.log('=====================');
        
        // Read first line of the file to show sample
        const fileContent = fs.readFileSync(outputPath, 'utf8');
        const firstLine = fileContent.split('\n')[0];
        const sampleRow = JSON.parse(firstLine);
        
        console.log(JSON.stringify(sampleRow, null, 2));

        console.log('\n💡 USAGE TIPS:');
        console.log('==============');
        console.log('1. Use this file to train your ranker model');
        console.log('2. Each line is a JSON object with pairwise preferences');
        console.log('3. Label field: 1 (A > B), -1 (B > A), 0 (equal)');
        console.log('4. Similarity field: cosine similarity between embeddings (if available)');
        console.log('5. Reason tags: explanations for the preference');

        console.log('\n📊 DATASET QUALITY:');
        console.log('==================');
        const balance = Math.abs((stats.labelDistribution['1'] || 0) - (stats.labelDistribution['-1'] || 0));
        const balanceScore = Math.max(0, 100 - (balance / stats.pairCount) * 100);
        console.log(`Balance Score: ${balanceScore.toFixed(1)}/100`);
        
        const diversity = Object.keys(stats.labelDistribution).length;
        console.log(`Label Diversity: ${diversity}/3`);
        
        const pairsPerItem = stats.pairCount / stats.itemCount;
        console.log(`Pairs per Item: ${pairsPerItem.toFixed(2)}`);

        if (balanceScore < 70) {
          console.log('\n⚠️  WARNING: Dataset is unbalanced. Consider adding more diverse preferences.');
        }

        if (pairsPerItem < 2) {
          console.log('\n⚠️  WARNING: Low pairs per item. Consider adding more comparisons for each item.');
        }

      } catch (error) {
        console.error(chalk.red('Dataset export failed:'), error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}