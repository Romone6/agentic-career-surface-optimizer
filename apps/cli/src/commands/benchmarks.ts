import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FactStoreService, QuestionnaireService } from '@ancso/core';
import {
  SQLiteBenchmarkProfileRepository,
  SQLiteBenchmarkSectionRepository,
  SQLiteBenchmarkEmbeddingRepository,
  SQLiteBenchmarkCacheRepository,
  GitHubBenchmarkIngestionService,
} from '@ancso/core';
import { BenchmarkEmbeddingService } from '@ancso/ml';
import { LinkedInAutomation } from '@ancso/automation';
import ora from 'ora';

function benchmarksCommands(): Command {
  const command = new Command('benchmarks')
    .description('Benchmark library management commands');

  command.addCommand(new Command('stats')
    .description('Show benchmark library statistics')
    .action(async () => {
      try {
        console.log(chalk.blue('Benchmark Library Statistics'));
        console.log('==================================\n');

        const profileRepo = new SQLiteBenchmarkProfileRepository();
        const linkedinCount = await profileRepo.count('linkedin');
        const githubCount = await profileRepo.count('github');

        console.log(chalk.green('📊 Overview:'));
        console.log(`   Total Profiles: ${linkedinCount + githubCount}`);
        console.log(`   LinkedIn: ${linkedinCount}`);
        console.log(`   GitHub: ${githubCount}`);

        const eliteLinkedin = await profileRepo.findElite('linkedin', 1000);
        const eliteGithub = await profileRepo.findElite('github', 1000);
        console.log(`   Elite Profiles: ${eliteLinkedin.length + eliteGithub.length}`);

        console.log('\n💡 To populate benchmarks:');
        console.log('   - LinkedIn: pnpm cli benchmarks:add:linkedin');
        console.log('   - GitHub: pnpm cli benchmarks:seed:github --n 50');

      } catch (error) {
        console.error(chalk.red('Failed to get stats:'), error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    }));

  command.addCommand(new Command('add:linkedin')
    .description('Add LinkedIn profile URLs to benchmark library')
    .option('--file <file>', 'JSON/YAML file with LinkedIn URLs and persona tags')
    .option('--urls <urls>', 'Comma-separated LinkedIn profile URLs')
    .action(async (options) => {
      try {
        console.log(chalk.blue('Adding LinkedIn Profiles to Benchmark Library'));
        console.log('===================================================\n');

        const profileRepo = new SQLiteBenchmarkProfileRepository();
        let urls: { url: string; persona: string }[] = [];

        if (options.file) {
          if (!fs.existsSync(options.file)) {
            console.error(chalk.red(`File not found: ${options.file}`));
            process.exit(1);
          }

          const content = fs.readFileSync(options.file, 'utf8');
          if (options.file.endsWith('.yaml') || options.file.endsWith('.yml')) {
            const yaml = await import('yaml');
            const data = yaml.parse(content);
            urls = Array.isArray(data) ? data : data.profiles || data.linkedin || [];
          } else {
            const data = JSON.parse(content);
            urls = Array.isArray(data) ? data : data.profiles || data.linkedin || [];
          }

          console.log(`📄 Loaded ${urls.length} profiles from ${options.file}`);
        } else if (options.urls) {
          const urlList = options.urls.split(',').map(u => u.trim());
          urls = urlList.map(url => ({ url, persona: 'engineer' }));
          console.log(`📄 Loaded ${urls.length} profiles from command line`);
        } else {
          console.log(chalk.yellow('⚠️  No input provided'));
          console.log('Usage: pnpm cli benchmarks:add:linkedin --file profiles.yaml');
          console.log('   or: pnpm cli benchmarks:add:linkedin --urls "url1,url2,..."');
          return;
        }

        let added = 0;
        for (const item of urls) {
          const username = this.extractLinkedInUsername(item.url);
          if (!username) {
            console.log(chalk.yellow(`⚠️  Invalid URL: ${item.url}`));
            continue;
          }

          const existing = await this.findExistingProfile(profileRepo, 'linkedin', username);
          if (existing) {
            console.log(chalk.gray(`⏭️  Already exists: ${username}`));
            continue;
          }

          await profileRepo.create({
            id: uuidv4(),
            platform: 'linkedin',
            externalId: username,
            username,
            displayName: null,
            bio: null,
            persona: item.persona as any,
            sourceUrl: item.url,
            relevanceScore: 0.5,
            isElite: false,
            isIngested: false,
            metadata: { addedAt: new Date().toISOString() },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          console.log(`✅ Added: ${username} (${item.persona})`);
          added++;
        }

        console.log(chalk.green(`\n🎉 Added ${added} LinkedIn profiles to benchmark library`));
        console.log('\nNext steps:');
        console.log('1. Run: pnpm cli benchmarks:ingest:linkedin');
        console.log('2. Run: pnpm cli benchmarks:embed');

      } catch (error) {
        console.error(chalk.red('Failed to add LinkedIn profiles:'), error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    }));

  command.addCommand(new Command('seed:github')
    .description('Auto-collect elite GitHub profiles')
    .option('--n <number>', 'Number of profiles to collect', '50')
    .action(async (options) => {
      try {
        console.log(chalk.blue('Seeding GitHub Benchmark Library'));
        console.log('==================================\n');

        const ingestionService = new GitHubBenchmarkIngestionService();
        await ingestionService.initialize();

        console.log(chalk.yellow('🔍 Collecting elite GitHub profiles...'));
        console.log('(GitHub Stars, Top Contributors, Open Source Maintainers)\n');

        const candidates = await ingestionService.seedProfiles(parseInt(options.n));

        console.log(`\n🎉 Added ${candidates.length} elite GitHub profiles`);
        console.log('\nNext steps:');
        console.log('1. Run: pnpm cli benchmarks:ingest:github');
        console.log('2. Run: pnpm cli benchmarks:embed --platform github');

        console.log('\n💡 Top candidates by relevance:');
        candidates.slice(0, 5).forEach((c, i) => {
          console.log(`  ${i + 1}. ${c.username} (score: ${c.relevanceScore.toFixed(2)}, sources: ${c.sources.join(', ')})`);
        });

      } catch (error) {
        console.error(chalk.red('Failed to seed GitHub profiles:'), error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    }));

  command.addCommand(new Command('ingest:github')
    .description('Fetch GitHub profile metadata and content')
    .option('--limit <number>', 'Number of profiles to ingest', '10')
    .action(async (options) => {
      try {
        console.log(chalk.blue('Ingesting GitHub Profiles'));
        console.log('==============================\n');

        const ingestionService = new GitHubBenchmarkIngestionService();
        await ingestionService.initialize();

        console.log(chalk.yellow('🔍 Fetching profile data and content...\n'));

        const result = await ingestionService.ingestAllPending(parseInt(options.limit));

        console.log(chalk.green(`\n🎉 Ingestion complete!`));
        console.log(`  Success: ${result.success}`);
        console.log(`  Failed: ${result.failed}`);
        console.log('\nNext steps:');
        console.log('1. Run: pnpm cli benchmarks:embed --platform github');
        console.log('2. Run: pnpm cli ranker:bootstrap --platform github --n-pairs 200');

      } catch (error) {
        console.error(chalk.red('Failed to ingest GitHub profiles:'), error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    }));

        console.log(chalk.green('\n🎉 GitHub profile ingestion complete'));

      } catch (error) {
        console.error(chalk.red('Failed to ingest GitHub profiles:'), error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    }));

  command.addCommand(new Command('ingest:linkedin')
    .description('Extract LinkedIn profile data using Playwright')
    .option('--limit <number>', 'Number of profiles to ingest', '10')
    .option('--rate-limit-ms <ms>', 'Minimum delay between profiles', '2500')
    .action(async (options) => {
      try {
        console.log(chalk.blue('Ingesting LinkedIn Profiles'));
        console.log('===============================\n');

        const runAllowed = process.env.LINKEDIN_RUN_ALLOW === 'true';
        if (!runAllowed) {
          console.log(chalk.yellow('⚠️  LINKEDIN_RUN_ALLOW=true not set'));
          console.log('Set this environment variable to enable LinkedIn automation.');
          return;
        }

        const profileRepo = new SQLiteBenchmarkProfileRepository();
        const sectionRepo = new SQLiteBenchmarkSectionRepository();
        const cacheRepo = new SQLiteBenchmarkCacheRepository();

        const profiles = await profileRepo.findNotIngested('linkedin', parseInt(options.limit));

        if (profiles.length === 0) {
          console.log(chalk.yellow('No profiles to ingest. Run benchmarks:add:linkedin first.'));
          return;
        }

        const failureLogPath = 'logs/benchmarks_linkedin_failures.jsonl';
        if (!fs.existsSync('logs')) {
          fs.mkdirSync('logs', { recursive: true });
        }

        const automation = new LinkedInAutomation({
          headless: false,
          userDataDir: './data/linkedin',
          screenshotDir: './screenshots/linkedin',
        });

        console.log(`Found ${profiles.length} profiles to ingest\n`);
        console.log(`Rate limit: ${options.rateLimitMs}ms between profiles`);
        console.log(`Failure log: ${failureLogPath}\n`);

        let successCount = 0;
        let failCount = 0;

        for (const profile of profiles) {
          const spinner = ora(`Ingesting ${profile.username}...`).start();
          const startTime = Date.now();

          try {
            await automation.initialize();
            await automation.login();

            const result = await this.ingestLinkedinProfile(profile, sectionRepo, automation, cacheRepo);
            await profileRepo.markAsIngested(profile.id);

            const elapsed = Date.now() - startTime;
            spinner.succeed(`${profile.username} (${elapsed}ms)`);
            successCount++;

            const rateLimitMs = parseInt(options.rateLimitMs) || 2500;
            if (elapsed < rateLimitMs) {
              await new Promise(resolve => setTimeout(resolve, rateLimitMs - elapsed));
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            spinner.fail(`${profile.username}: ${errorMsg}`);
            failCount++;

            const failureLog = {
              timestamp: new Date().toISOString(),
              profileId: profile.id,
              username: profile.username,
              url: profile.sourceUrl,
              error: errorMsg,
              persona: profile.persona,
            };
            fs.appendFileSync(failureLogPath, JSON.stringify(failureLog) + '\n');
          }
        }

        await automation.close();

        console.log(chalk.green(`\n🎉 LinkedIn profile ingestion complete`));
        console.log(`   Success: ${successCount}`);
        console.log(`   Failed: ${failCount}`);
        if (failCount > 0) {
          console.log(`   Failures logged to: ${failureLogPath}`);
        }

      } catch (error) {
        console.error(chalk.red('Failed to ingest LinkedIn profiles:'), error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    }));

  command.addCommand(new Command('embed')
    .description('Generate embeddings for benchmark sections using @xenova/transformers')
    .option('--platform <platform>', 'Platform to embed (github|linkedin|all)', 'all')
    .action(async (options) => {
      try {
        console.log(chalk.blue('Generating Embeddings for Benchmarks'));
        console.log('==========================================\n');

        const { BenchmarkEmbeddingService } = await import('@ancso/ml');
        const embeddingService = new BenchmarkEmbeddingService();

        console.log(chalk.yellow('🔧 Initializing embedding model...'));
        await embeddingService.initialize();

        const modelInfo = embeddingService.getModelInfo();
        console.log(`  Model: ${modelInfo.model}`);
        console.log(`  Dimensions: ${modelInfo.dimensions}\n`);

        let result: { embedded: number; skipped: number; failed: number };

        if (options.platform === 'all') {
          console.log('Embedding GitHub sections...');
          const githubResult = await embeddingService.embedPlatformSections('github');
          console.log(`  Embedded: ${githubResult.embedded}, Skipped: ${githubResult.skipped}, Failed: ${githubResult.failed}`);

          console.log('\nEmbedding LinkedIn sections...');
          const linkedinResult = await embeddingService.embedPlatformSections('linkedin');
          console.log(`  Embedded: ${linkedinResult.embedded}, Skipped: ${linkedinResult.skipped}, Failed: ${linkedinResult.failed}`);

          result = {
            embedded: githubResult.embedded + linkedinResult.embedded,
            skipped: githubResult.skipped + linkedinResult.skipped,
            failed: githubResult.failed + linkedinResult.failed,
          };
        } else {
          result = await embeddingService.embedPlatformSections(options.platform as 'github' | 'linkedin');
        }

        console.log(chalk.green(`\n🎉 Embedding complete!`));
        console.log(`  Total Embedded: ${result.embedded}`);
        console.log(`  Total Skipped: ${result.skipped} (already had embeddings)`);
        console.log(`  Total Failed: ${result.failed}`);
        console.log('\nNext steps:');
        console.log('1. Run: pnpm cli ranker:bootstrap --platform github --n-pairs 200');
        console.log('2. Run: pnpm cli ranker:export --out data/ranker');
        console.log('3. Run: pnpm cli ranker:train --epochs 50');

      } catch (error) {
        console.error(chalk.red('Failed to generate embeddings:'), error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    }));

  command.addCommand(new Command('neighbors')
    .description('Find similar benchmark examples')
    .option('--platform <platform>', 'Platform (linkedin|github)', 'linkedin')
    .option('--section <section>', 'Section type (headline|about|readme|summary)', 'about')
    .option('--text <text>', 'Query text to find similar profiles')
    .option('--persona <persona>', 'Filter by persona')
    .option('--k <number>', 'Number of neighbors to return', '5')
    .action(async (options) => {
      try {
        console.log(chalk.blue('Finding Similar Benchmarks'));
        console.log('==============================\n');

        const { BenchmarkService } = await import('@ancso/core');
        const benchmarkService = new BenchmarkService();

        if (!options.text) {
          console.log(chalk.yellow('⚠️  No query text provided'));
          console.log('Usage: pnpm cli benchmarks:neighbors --text "Your section text" --platform linkedin --section about');
          return;
        }

        const neighbors = await benchmarkService.findSimilarBenchmarks(options.text, {
          platform: options.platform as any,
          sectionType: options.section as any,
          persona: options.persona,
          limit: parseInt(options.k),
        });

        if (neighbors.length === 0) {
          console.log(chalk.yellow('No similar benchmarks found'));
          console.log('Make sure you have ingested and embedded benchmark profiles.');
          return;
        }

        console.log(chalk.green(`Found ${neighbors.length} similar benchmarks:\n`));

        neighbors.forEach((neighbor, index) => {
          console.log(`${index + 1}. ${neighbor.profile.username} (${neighbor.profile.persona || 'N/A'})`);
          console.log(`   Similarity: ${(neighbor.similarity * 100).toFixed(1)}%`);
          console.log(`   Section: ${neighbor.section.sectionType}`);
          const preview = neighbor.section.content.substring(0, 150).replace(/\n/g, ' ');
          console.log(`   "${preview}..."`);
          console.log('');
        });

      } catch (error) {
        console.error(chalk.red('Failed to find neighbors:'), error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    }));

  command.addCommand(new Command('clear')
    .description('Clear all benchmark data')
    .action(async () => {
      try {
        console.log(chalk.red('⚠️  This will delete all benchmark data'));
        const confirm = await inquirer.prompt([{
          type: 'confirm',
          name: 'proceed',
          message: 'Are you sure you want to continue?',
          default: false,
        }]);

        if (!confirm.proceed) {
          console.log('Operation cancelled');
          return;
        }

        const profileRepo = new SQLiteBenchmarkProfileRepository();
        const sectionRepo = new SQLiteBenchmarkSectionRepository();
        const embeddingRepo = new SQLiteBenchmarkEmbeddingRepository();
        const cacheRepo = new SQLiteBenchmarkCacheRepository();

        const profiles = await profileRepo.findByPlatform('linkedin');
        for (const p of profiles) {
          await embeddingRepo.deleteByProfileId(p.id);
          await sectionRepo.deleteByProfileId(p.id);
          await profileRepo.delete(p.id);
        }

        const ghProfiles = await profileRepo.findByPlatform('github');
        for (const p of ghProfiles) {
          await embeddingRepo.deleteByProfileId(p.id);
          await sectionRepo.deleteByProfileId(p.id);
          await profileRepo.delete(p.id);
        }

        await cacheRepo.clearAll();

        console.log(chalk.green('✅ All benchmark data cleared'));

      } catch (error) {
        console.error(chalk.red('Failed to clear benchmarks:'), error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    }));

  return command;
}

export { benchmarksCommands };
