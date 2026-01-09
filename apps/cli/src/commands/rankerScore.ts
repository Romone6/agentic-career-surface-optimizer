import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import https from 'https';
import sqlite3 from 'sqlite3';

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function getDbPath(): string {
  const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'ranker', 'benchmark.db');
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  return dbPath;
}

function getModelPath(): string {
  return path.join(process.cwd(), 'models', 'ranker.json');
}

function getDb(): sqlite3.Database {
  return new sqlite3.Database(getDbPath());
}

function getProfileSectionsByUsername(username: string): Promise<Array<{ id: string; section_type: string; content: string; word_count: number }>> {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const normalizedUsername = normalizeUsername(username);
    db.all(`
      SELECT s.id, s.section_type, s.content, s.word_count
      FROM benchmark_sections s
      JOIN benchmark_profiles p ON s.profile_id = p.id
      WHERE p.platform = 'github' AND LOWER(p.username) = ?
      ORDER BY s.section_type
    `, [normalizedUsername], (err: Error | null, rows: any[]) => {
      db.close();
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function concatenateProfileSections(sections: Array<{ section_type: string; content: string }>): string {
  if (sections.length === 0) return '';
  
  const separator = '\n\n--- SECTION: ';
  let result = '';
  
  for (const section of sections) {
    if (section.content && section.content.trim().length > 0) {
      result += `${separator}${section.section_type.toUpperCase()} ---\n${section.content.trim()}`;
    }
  }
  
  return result.length > 0 ? result.substring(2) : '';
}

function extractFeatures(text: string) {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const wordCount = words.length;
  const sentenceCount = sentences.length;

  const computeReadabilityScore = () => {
    if (wordCount === 0) return 0;
    const countSyllables = (txt: string) => {
      const w = txt.toLowerCase().split(/\s+/);
      let count = 0;
      for (const word of w) {
        const cleaned = word.replace(/[^a-z]/g, '');
        if (cleaned.length <= 3) count += cleaned.length;
        else { const vowels = cleaned.match(/[aeiouy]+/g); count += vowels ? vowels.length : 1; }
      }
      return count;
    };
    const syllables = countSyllables(text);
    const avgWordsPerSentence = wordCount / Math.max(sentenceCount, 1);
    const avgSyllablesPerWord = syllables / wordCount;
    const fleschKincaid = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;
    return Math.max(0, Math.min(100, Math.round(fleschKincaid)));
  };

  const skillKeywords = ['javascript', 'typescript', 'python', 'java', 'rust', 'go', 'react', 'node', 'aws', 'docker', 'kubernetes', 'sql', 'postgresql', 'mongodb', 'redis', 'git', 'github', 'ml', 'ai', 'machine learning', 'tensorflow', 'pytorch', 'cloud', 'microservices', 'api', 'rest', 'graphql'];
  
  const computeSkillDensity = () => {
    if (wordCount === 0) return 0;
    let matches = 0;
    for (const skill of skillKeywords) {
      const regex = new RegExp(`\\b${skill}\\b`, 'gi');
      const m = text.match(regex);
      if (m) matches += m.length;
    }
    return Math.min(100, Math.round((matches / wordCount) * 100 * 10));
  };

  const computeAchievementRatio = () => {
    if (sentenceCount === 0) return 0;
    const patterns = [/\d+[+%]/g, /\b(improved|increased|decreased|reduced|optimized|achieved|delivered|built|created|led|managed)/gi, /\b(\$[\d,]+|\$\d+[kmb]?)/g];
    let achievementSentences = 0;
    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      for (const pattern of patterns) { if (pattern.test(lower)) { achievementSentences++; break; } }
    }
    return Math.min(100, Math.round((achievementSentences / sentenceCount) * 100));
  };

  const computeKeywordDensity = () => {
    if (wordCount === 0) return 0;
    let matches = 0;
    for (const keyword of skillKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const m = text.match(regex);
      if (m) matches += m.length;
    }
    return Math.min(100, Math.round((matches / wordCount) * 100 * 20));
  };

  const computeCompletenessScore = () => {
    let score = 0;
    if (text.length > 200) score += 20;
    if (text.length > 500) score += 20;
    if (text.length > 1000) score += 20;
    const lower = text.toLowerCase();
    if (/\b(years?|yr|experience)\b/.test(lower)) score += 15;
    if (/\b(skills?|technologies?)\b/.test(lower)) score += 15;
    if (/\b(achievements?)\b/.test(lower)) score += 10;
    return Math.min(100, score);
  };

  const computeImpactScore = () => {
    let impactScore = 0;
    const verbs = /\b(improved|increased|decreased|reduced|optimized|achieved|delivered|built|created|led|managed|designed|developed|implemented|launched|scaled)/gi;
    const metrics = /\d+[+%]|[\d,]+|\$[\d,]+/g;
    for (const sentence of sentences) {
      if (verbs.test(sentence)) impactScore += 5;
      const m = sentence.match(metrics);
      if (m && m.length > 0) impactScore += 5;
    }
    return Math.min(100, impactScore);
  };

  const professionalKeywords = ['professional', 'experienced', 'skilled', 'expert', 'senior', 'lead', 'engineer', 'developer', 'architect', 'manager', 'team', 'stakeholders', 'requirements', 'solutions', 'implementation'];
  
  const computeProfessionalismScore = () => {
    if (wordCount === 0) return 0;
    let matches = 0;
    for (const keyword of professionalKeywords) {
      if (text.toLowerCase().includes(keyword)) matches++;
    }
    return Math.min(100, Math.round((matches / Math.min(wordCount, 100)) * 100 * 3));
  };

  return {
    readabilityScore: computeReadabilityScore(),
    skillDensity: computeSkillDensity(),
    achievementRatio: computeAchievementRatio(),
    keywordDensity: computeKeywordDensity(),
    completenessScore: computeCompletenessScore(),
    impactScore: computeImpactScore(),
    professionalismScore: computeProfessionalismScore(),
  };
}

function computeSectionContributions(text: string, featureNames: string[], weights: number[]): Array<{ sectionType: string; contribution: number }> {
  const sections = text.split(/--- SECTION: [A-Z]+ ---\n/g).filter(s => s.trim().length > 0);
  const sectionTypes = text.match(/--- SECTION: [A-Z]+ ---/g) || [];
  
  if (sections.length === 0) return [];
  
  const contributions: Array<{ sectionType: string; contribution: number }> = [];
  
  for (let i = 0; i < sections.length; i++) {
    const sectionText = sections[i];
    const sectionType = sectionTypes[i]?.replace(/--- SECTION: | ---/g, '') || 'unknown';
    
    if (sectionText.trim().length < 10) continue;
    
    const metrics = extractFeatures(sectionText);
    const features = featureNames.map((f: string) => {
      const key = f.replace(/_([a-z])/g, (_: any, c: string) => c.toUpperCase());
      return metrics[key as keyof typeof metrics] / 100;
    });
    
    const contribution = features.reduce((sum: number, f: number, j: number) => sum + f * weights[j], 0);
    
    contributions.push({ sectionType, contribution: Math.abs(contribution) });
  }
  
  return contributions.sort((a, b) => b.contribution - a.contribution);
}

export function rankerScoreCommands(): Command {
  const command = new Command('score')
    .description('Score a profile against the ranker model')
    .option('--text <string>', 'Profile text to score')
    .option('--file <path>', 'Path to file with profile text')
    .option('--platform <platform>', 'Platform (github)', 'github')
    .option('--username <name>', 'GitHub username to score (loads from DB)')
    .action(async (options) => {
      let text = '';
      
      if (options.username && options.platform === 'github') {
        const normalizedUsername = normalizeUsername(options.username);
        console.log(chalk.blue(`\nLoading profile for: ${normalizedUsername}`));
        
        const sections = await getProfileSectionsByUsername(normalizedUsername);
        
        if (sections.length === 0) {
          console.log(chalk.yellow(`\nUser '${normalizedUsername}' not found in database.`));
          console.log(`Run: ancso ranker:ingest --platform github --usernames ${normalizedUsername}`);
          return;
        }
        
        text = concatenateProfileSections(sections);
        console.log(`Loaded ${sections.length} sections (${text.split(/\s+/).length} words)`);
      } else if (options.text) {
        text = options.text;
      } else if (options.file && fs.existsSync(options.file)) {
        text = fs.readFileSync(options.file, 'utf-8');
      } else {
        console.log('Provide --text, --file, or --platform github --username <name>');
        return;
      }
      
      console.log(chalk.blue('\nScoring profile...\n'));
      
      if (!fs.existsSync(getModelPath())) {
        console.log(chalk.yellow('No model found. Run ranker:train first.'));
        return;
      }
      
      try {
        const model = JSON.parse(fs.readFileSync(getModelPath(), 'utf-8'));
        const metrics = extractFeatures(text);
        
        const features = model.featureNames.map((f: string) => {
          const key = f.replace(/_([a-z])/g, (_: any, c: string) => c.toUpperCase());
          return metrics[key as keyof typeof metrics] / 100;
        });
        
        const score = features.reduce((sum: number, f: number, i: number) => sum + f * model.weights[i], 0) + model.bias;
        const probability = 1 / (1 + Math.exp(-score));
        
        console.log('Feature scores:');
        for (const feature of model.featureNames) {
          const key = feature.replace(/_([a-z])/g, (_: any, c: string) => c.toUpperCase());
          const value = metrics[key as keyof typeof metrics];
          console.log(`  ${feature.padEnd(25)} ${value.toString().padStart(3)}`);
        }
        
        console.log(`\nRaw score: ${score.toFixed(4)}`);
        console.log(`Quality probability: ${(probability * 100).toFixed(1)}%`);
        console.log(chalk.green(`\nProfile quality: ${probability > 0.7 ? 'HIGH' : probability > 0.4 ? 'MEDIUM' : 'LOW'}`));
        
        if (options.username && options.platform === 'github') {
          const topSections = computeSectionContributions(
            concatenateProfileSections(await getProfileSectionsByUsername(normalizeUsername(options.username))),
            model.featureNames,
            model.weights
          ).slice(0, 5);
          
          console.log('\nTop contributing sections:');
          for (let i = 0; i < topSections.length; i++) {
            console.log(`  ${i + 1}. ${topSections[i].sectionType}: ${(topSections[i].contribution * 100).toFixed(1)}%`);
          }
        }
      } catch (error) {
        console.error(chalk.red('\nScoring failed:'), error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  return command;
}

export function rankerDumpCommands(): Command {
  const command = new Command('dump')
    .description('Export profile text used for scoring (debugging)')
    .option('--platform <platform>', 'Platform (github)', 'github')
    .option('--username <name>', 'GitHub username to dump')
    .option('--out <path>', 'Output file path', '-')
    .action(async (options) => {
      console.log(chalk.blue('\nDumping profile text for scoring...\n'));
      
      if (!options.username) {
        console.log('Provide --username <name>');
        return;
      }
      
      const normalizedUsername = normalizeUsername(options.username);
      console.log(`DB path: ${getDbPath()}`);
      
      try {
        const sections = await getProfileSectionsByUsername(normalizedUsername);
        
        if (sections.length === 0) {
          console.log(chalk.yellow(`User '${normalizedUsername}' not found in database.`));
          console.log(`Run: ancso ranker:ingest --platform github --usernames ${normalizedUsername}`);
          return;
        }
        
        const text = concatenateProfileSections(sections);
        
        if (options.out && options.out !== '-') {
          const outDir = path.dirname(options.out);
          if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
          fs.writeFileSync(options.out, text, 'utf-8');
          console.log(chalk.green(`\nProfile text written to: ${options.out}`));
          console.log(`Words: ${text.split(/\s+/).length}`);
          console.log(`Sections: ${sections.length}`);
        } else {
          console.log('\n--- PROFILE TEXT FOR SCORING ---\n');
          console.log(text);
          console.log('\n--- END ---\n');
        }
      } catch (error) {
        console.error(chalk.red('\nDump failed:'), error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  return command;
}
