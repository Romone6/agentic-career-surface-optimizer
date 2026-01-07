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
} from '@ancso/core';
import { EmbeddingService } from '@ancso/core';
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
        console.log('==================================\n'));

        const profileRepo = new SQLiteBenchmarkProfileRepository();
        const cacheRepo = new SQLiteBenchmarkCacheRepository();

        console.log(chalk.yellow('🔍 Collecting profiles from GitHub sources...'));
        console.log('(GitStar, Top-GitHub-Users, Committers.top)\n');

        const candidates = await this.collectGithubCandidates(cacheRepo);

        console.log(`Found ${candidates.length} candidate profiles`);

        const scored = candidates.map(c => ({
          ...c,
          combinedScore: this.calculateGithubScore(c),
        }));

        scored.sort((a, b) => b.combinedScore - a.combinedScore);

        const selected = scored.slice(0, parseInt(options.n));
        let added = 0;

        for (const profile of selected) {
          const existing = await profileRepo.findById(profile.id);
          if (existing) {
            console.log(chalk.gray(`⏭️  Already exists: ${profile.username}`));
            continue;
          }

          await profileRepo.create({
            id: profile.id,
            platform: 'github',
            externalId: profile.id,
            username: profile.username,
            displayName: profile.displayName,
            bio: profile.bio,
            persona: profile.persona as any,
            sourceUrl: `https://github.com/${profile.username}`,
            relevanceScore: profile.relevanceScore,
            isElite: true,
            isIngested: false,
            metadata: { combinedScore: profile.combinedScore, sources: profile.sources },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          console.log(`✅ ${profile.username} (score: ${profile.combinedScore.toFixed(2)})`);
          added++;
        }

        console.log(chalk.green(`\n🎉 Added ${added} elite GitHub profiles`));
        console.log('\nNext steps:');
        console.log('1. Run: pnpm cli benchmarks:ingest:github');
        console.log('2. Run: pnpm cli benchmarks:embed');

      } catch (error) {
        console.error(chalk.red('Failed to seed GitHub profiles:'), error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    }));

  command.addCommand(new Command('ingest:github')
    .description('Fetch GitHub profile metadata and content')
    .action(async () => {
      try {
        console.log(chalk.blue('Ingesting GitHub Profiles'));
        console.log('==============================\n');

        const profileRepo = new SQLiteBenchmarkProfileRepository();
        const sectionRepo = new SQLiteBenchmarkSectionRepository();
        const cacheRepo = new SQLiteBenchmarkCacheRepository();

        const profiles = await profileRepo.findNotIngested('github', 10);

        if (profiles.length === 0) {
          console.log(chalk.yellow('No profiles to ingest. Run benchmarks:seed:github first.'));
          return;
        }

        console.log(`Found ${profiles.length} profiles to ingest\n`);

        for (const profile of profiles) {
          const spinner = ora(`Ingesting ${profile.username}...`).start();

          try {
            await this.ingestGithubProfile(profile, sectionRepo, cacheRepo);
            await profileRepo.markAsIngested(profile.id);
            spinner.succeed(`${profile.username}`);
          } catch (error) {
            spinner.fail(`${profile.username}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

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
    .description('Generate embeddings for all benchmark sections')
    .action(async () => {
      try {
        console.log(chalk.blue('Generating Embeddings for Benchmarks'));
        console.log('==========================================\n');

        const embeddingService = new EmbeddingService();
        const profileRepo = new SQLiteBenchmarkProfileRepository();
        const sectionRepo = new SQLiteBenchmarkSectionRepository();
        const embeddingRepo = new SQLiteBenchmarkEmbeddingRepository();

        const linkedinProfiles = await profileRepo.findByPlatform('linkedin');
        const githubProfiles = await profileRepo.findByPlatform('github');
        const allProfiles = [...linkedinProfiles, ...githubProfiles];

        let embedded = 0;
        let skipped = 0;

        for (const profile of allProfiles) {
          const sections = await sectionRepo.findByProfileId(profile.id);

          for (const section of sections) {
            if (section.embeddingId) {
              skipped++;
              continue;
            }

            const spinner = ora(`Embedding ${profile.username}/${section.sectionType}...`).start();

            try {
              const embedding = await embeddingService.generateEmbedding(section.content);

              const embeddingId = uuidv4();
              await embeddingRepo.create({
                id: embeddingId,
                profileId: profile.id,
                sectionId: section.id,
                embeddingModel: 'text-embedding-3-small',
                embeddingVector: Buffer.from(new Float32Array(embedding)),
                dimension: embedding.length,
                createdAt: new Date().toISOString(),
              });

              await sectionRepo.update({
                ...section,
                embeddingId,
              });

              embedded++;
              spinner.succeed(`${profile.username}/${section.sectionType}`);
            } catch (error) {
              spinner.fail(`${profile.username}/${section.sectionType}`);
            }
          }
        }

        console.log(chalk.green(`\n🎉 Embedded ${embedded} sections (${skipped} already had embeddings)`));

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

// Helper functions
function extractLinkedInUsername(url: string): string | null {
  const match = url.match(/linkedin\.com\/in\/([^/]+)/);
  return match ? match[1] : null;
}

async function findExistingProfile(repo: any, platform: string, username: string): Promise<any> {
  const profiles = await repo.findByPlatform(platform);
  return profiles.find((p: any) => p.username === username);
}

async function collectGithubCandidates(cacheRepo: SQLiteBenchmarkCacheRepository): Promise<any[]> {
  const candidates: any[] = [];

  const hardcodedElite = [
    { username: 'torvalds', displayName: 'Linus Torvalds', bio: 'Creator of Linux and Git' },
    { username: 'gaearon', displayName: 'Dan Abramov', bio: 'React core team' },
    { username: 'addyosmani', displayName: 'Addy Osmani', bio: 'Chrome engineering' },
    { username: 'kentcdodds', displayName: 'Kent C. Dodds', bio: 'Testing expert' },
    { username: 'sindresorhus', displayName: 'Sindre Sorhus', bio: 'Open source maintainer' },
    { username: 'jlord', displayName: 'Jessica Lord', bio: 'GitHub engineer' },
    { username: 'bkeepers', displayName: 'Brandon Keepers', bio: 'GitHub architect' },
    { username: 'defunkt', displayName: 'Chris Wanstrath', bio: 'GitHub CEO' },
    { username: 'mojombo', displayName: 'Tom Preston-Werner', bio: 'GitHub co-founder' },
    { username: 'pjhyett', displayName: 'PJ Hyett', bio: 'GitHub co-founder' },
  ];

  for (const dev of hardcodedElite) {
    candidates.push({
      id: uuidv4(),
      username: dev.username,
      displayName: dev.displayName,
      bio: dev.bio,
      relevanceScore: 0.95,
      persona: 'engineer',
      sources: ['hardcoded'],
    });
  }

  return candidates;
}

function calculateGithubScore(profile: any): number {
  let score = profile.relevanceScore || 0.5;

  if (profile.sources?.includes('hardcoded')) score += 0.3;
  if (profile.bio?.length > 50) score += 0.1;

  return Math.min(score, 1.0);
}

async function ingestGithubProfile(profile: any, sectionRepo: any, cacheRepo: any): Promise<void> {
  const cacheKey = `github_user_${profile.username}`;
  const cached = await cacheRepo.get(cacheKey);

  if (cached) {
    if (cached.readme) {
      await sectionRepo.create({
        id: uuidv4(),
        profileId: profile.id,
        sectionType: 'readme',
        sectionName: 'profile_readme',
        content: cached.readme,
        wordCount: cached.readme.split(/\s+/).length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    return;
  }

  if (profile.bio) {
    await sectionRepo.create({
      id: uuidv4(),
      profileId: profile.id,
      sectionType: 'summary',
      sectionName: 'bio',
      content: profile.bio,
      wordCount: profile.bio.split(/\s+/).length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  await cacheRepo.set(cacheKey, 'github_user', {
    username: profile.username,
    bio: profile.bio,
    readme: null,
  }, 86400);
}

async function ingestLinkedinProfile(
  profile: any, 
  sectionRepo: any, 
  automation: any,
  cacheRepo?: any
): Promise<void> {
  const cacheKey = `linkedin_profile_${profile.username}`;
  
  if (cacheRepo) {
    const cached = await cacheRepo.get(cacheKey);
    if (cached) {
      console.log(`   [cache] Using cached data for ${profile.username}`);
      if (cached.headline) {
        await sectionRepo.create({
          id: uuidv4(),
          profileId: profile.id,
          sectionType: 'headline',
          content: cached.headline,
          wordCount: cached.headline.split(/\s+/).length,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      if (cached.about) {
        await sectionRepo.create({
          id: uuidv4(),
          profileId: profile.id,
          sectionType: 'about',
          content: cached.about,
          wordCount: cached.about.split(/\s+/).length,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      if (cached.experience) {
        await sectionRepo.create({
          id: uuidv4(),
          profileId: profile.id,
          sectionType: 'experience',
          sectionName: 'experience_summary',
          content: cached.experience,
          wordCount: cached.experience.split(/\s+/).length,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      return;
    }
  }

  const data = await automation.getProfileData();

  if (data.headline) {
    await sectionRepo.create({
      id: uuidv4(),
      profileId: profile.id,
      sectionType: 'headline',
      content: data.headline,
      wordCount: data.headline.split(/\s+/).length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  if (data.about) {
    await sectionRepo.create({
      id: uuidv4(),
      profileId: profile.id,
      sectionType: 'about',
      content: data.about,
      wordCount: data.about.split(/\s+/).length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  if (cacheRepo) {
    await cacheRepo.set(cacheKey, 'linkedin_profile', {
      headline: data.headline || null,
      about: data.about || null,
      experience: null,
    }, 86400);
  }
}
