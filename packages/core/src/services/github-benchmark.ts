import { Logger } from '@ancso/core';
import { AppError } from '@ancso/core';
import { GitHubAPI } from '@ancso/adapters';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import {
  SQLiteBenchmarkProfileRepository,
  SQLiteBenchmarkSectionRepository,
  SQLiteBenchmarkCacheRepository,
} from '@ancso/core';

export interface GitHubBenchmarkProfile {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  followers: number;
  following: number;
  publicRepos: number;
  company: string;
  location: string;
  createdAt: string;
  updatedAt: string;
  website: string;
  twitter: string;
  email: string;
}

export interface GitHubBenchmarkSection {
  profileId: string;
  sectionType: 'summary' | 'readme' | 'repo_readme';
  sectionName: string;
  content: string;
  metadata: {
    sourceUrl?: string;
    repoName?: string;
    wordCount: number;
  };
}

export interface GitHubBenchmarkCandidate {
  username: string;
  displayName: string;
  bio: string;
  followers: number;
  following: number;
  publicRepos: number;
  company: string;
  location: string;
  relevanceScore: number;
  qualityScore: number;
  sources: string[];
}

export class GitHubBenchmarkIngestionService {
  private api: GitHubAPI;
  private logger: Logger;
  private profileRepo: SQLiteBenchmarkProfileRepository;
  private sectionRepo: SQLiteBenchmarkSectionRepository;
  private cacheRepo: SQLiteBenchmarkCacheRepository;

  constructor() {
    this.api = new GitHubAPI();
    this.logger = new Logger('GitHubBenchmarkIngestion');
    this.profileRepo = new SQLiteBenchmarkProfileRepository();
    this.sectionRepo = new SQLiteBenchmarkSectionRepository();
    this.cacheRepo = new SQLiteBenchmarkCacheRepository();
  }

  async initialize(): Promise<void> {
    await this.api.initialize();
    this.logger.info('GitHub benchmark ingestion service initialized');
  }

  async seedProfiles(count: number = 50): Promise<GitHubBenchmarkCandidate[]> {
    this.logger.info(`Seeding ${count} elite GitHub profiles`);

    const candidates = await this.collectCandidates();

    candidates.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const selected = candidates.slice(0, count);

    let added = 0;
    for (const candidate of selected) {
      try {
        await this.createBenchmarkProfile(candidate);
        added++;
      } catch (error) {
        this.logger.warn(`Failed to add profile ${candidate.username}: ${error}`);
      }
    }

    this.logger.info(`Added ${added} elite GitHub profiles`);
    return selected;
  }

  async ingestProfile(username: string): Promise<GitHubBenchmarkProfile | null> {
    const cacheKey = `github_profile_${username}`;
    const cached = await this.cacheRepo.get(cacheKey);

    if (cached) {
      this.logger.debug(`Using cached profile for ${username}`);
      return cached as GitHubBenchmarkProfile;
    }

    try {
      const profile = await this.fetchProfile(username);
      
      if (profile) {
        await this.cacheRepo.set(cacheKey, 'github_profile', profile, 86400);
      }

      return profile;
    } catch (error) {
      this.logger.error(`Failed to ingest profile ${username}: ${error}`);
      return null;
    }
  }

  async ingestSections(profileId: string, username: string): Promise<void> {
    const sections: GitHubBenchmarkSection[] = [];

    const profile = await this.ingestProfile(username);
    if (!profile) {
      throw new AppError('INGEST_ERROR', `Failed to ingest profile ${username}`);
    }

    if (profile.bio) {
      sections.push({
        profileId,
        sectionType: 'summary',
        sectionName: 'bio',
        content: profile.bio,
        metadata: {
          wordCount: profile.bio.split(/\s+/).length,
        },
      });
    }

    const profileReadme = await this.getProfileReadme(username);
    if (profileReadme) {
      sections.push({
        profileId,
        sectionType: 'readme',
        sectionName: 'profile_readme',
        content: profileReadme,
        metadata: {
          sourceUrl: `https://github.com/${username}`,
          wordCount: profileReadme.split(/\s+/).length,
        },
      });
    }

    const topRepos = await this.getTopRepositories(username, 5);
    for (const repo of topRepos) {
      const readme = await this.getRepositoryReadme(username, repo.name);
      if (readme && readme.length > 100) {
        sections.push({
          profileId,
          sectionType: 'repo_readme',
          sectionName: repo.name,
          content: readme,
          metadata: {
            sourceUrl: `https://github.com/${username}/${repo.name}`,
            repoName: repo.name,
            wordCount: readme.split(/\s+/).length,
          },
        });
      }
    }

    for (const section of sections) {
      const textHash = crypto.createHash('sha256').update(section.content).digest('hex');
      
      const existingSection = await this.sectionRepo.findByTextHash(textHash);
      if (existingSection) {
        this.logger.debug(`Skipping duplicate section: ${section.sectionName}`);
        continue;
      }

      await this.sectionRepo.create({
        id: uuidv4(),
        profileId: section.profileId,
        sectionType: section.sectionType,
        sectionName: section.sectionName,
        content: section.content,
        wordCount: section.metadata.wordCount,
        textHash,
        metadata: section.metadata as any,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    this.logger.info(`Ingested ${sections.length} sections for ${username}`);
  }

  async ingestAllPending(limit: number = 10): Promise<{ success: number; failed: number }> {
    const profiles = await this.profileRepo.findNotIngested('github', limit);

    let success = 0;
    let failed = 0;

    for (const profile of profiles) {
      try {
        await this.ingestSections(profile.id, profile.username);
        await this.profileRepo.markAsIngested(profile.id);
        success++;
      } catch (error) {
        this.logger.error(`Failed to ingest ${profile.username}: ${error}`);
        failed++;
      }
    }

    this.logger.info(`Ingestion complete: ${success} success, ${failed} failed`);
    return { success, failed };
  }

  private async collectCandidates(): Promise<GitHubBenchmarkCandidate[]> {
    const candidates: GitHubBenchmarkCandidate[] = [];

    const eliteSources = [
      this.collectFromGitStars(),
      this.collectFromTrending(),
      this.collectFromTopRepositories(),
      this.collectHardcodedElite(),
    ];

    const allCandidates = await Promise.all(eliteSources);
    const merged = allCandidates.flat();

    const seen = new Map<string, GitHubBenchmarkCandidate>();
    for (const candidate of merged) {
      if (!seen.has(candidate.username)) {
        seen.set(candidate.username, candidate);
      } else {
        const existing = seen.get(candidate.username)!;
        existing.sources = [...new Set([...existing.sources, ...candidate.sources])];
        existing.qualityScore = (existing.qualityScore + candidate.qualityScore) / 2;
        existing.relevanceScore = Math.min(1, existing.relevanceScore + 0.1);
      }
    }

    return Array.from(seen.values());
  }

  private async collectFromGitStars(): Promise<GitHubBenchmarkCandidate[]> {
    const cacheKey = 'github_candidates_stars';
    const cached = await this.cacheRepo.get(cacheKey);
    
    if (cached) {
      return cached as GitHubBenchmarkCandidate[];
    }

    const candidates: GitHubBenchmarkCandidate[] = [];

    const starUsers = [
      'torvalds',
      'gaearon',
      'addyosmani',
      'kentcdodds',
      'sindresorhus',
      'jlord',
      'bkeepers',
      'defunkt',
      'mojombo',
      'pjhyett',
      'brendaneich',
      'dhh',
      'mheob',
      'hswolff',
      'andreimaximov',
    ];

    for (const username of starUsers) {
      try {
        const profile = await this.ingestProfile(username);
        if (profile) {
          candidates.push({
            username: profile.username,
            displayName: profile.displayName,
            bio: profile.bio,
            followers: profile.followers,
            following: profile.following,
            publicRepos: profile.publicRepos,
            company: profile.company,
            location: profile.location,
            relevanceScore: this.calculateRelevanceScore(profile),
            qualityScore: this.calculateQualityScore(profile),
            sources: ['gitstars'],
          });
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch profile for ${username}: ${error}`);
      }
    }

    await this.cacheRepo.set(cacheKey, 'github_candidates', candidates, 3600);
    return candidates;
  }

  private async collectFromTrending(): Promise<GitHubBenchmarkCandidate[]> {
    return [];
  }

  private async collectFromTopRepositories(): Promise<GitHubBenchmarkCandidate[]> {
    return [];
  }

  private collectHardcodedElite(): GitHubBenchmarkCandidate[] {
    const hardcodedElite: GitHubBenchmarkCandidate[] = [
      {
        username: 'torvalds',
        displayName: 'Linus Torvalds',
        bio: 'Creator of Linux and Git',
        followers: 100000,
        following: 0,
        publicRepos: 6,
        company: '',
        location: '',
        relevanceScore: 0.95,
        qualityScore: 0.98,
        sources: ['hardcoded'],
      },
      {
        username: 'gaearon',
        displayName: 'Dan Abramov',
        bio: 'React core team at Meta. Creating JavaScript tools.',
        followers: 50000,
        following: 200,
        publicRepos: 200,
        company: 'Meta',
        location: 'New York',
        relevanceScore: 0.92,
        qualityScore: 0.95,
        sources: ['hardcoded'],
      },
      {
        username: 'addyosmani',
        displayName: 'Addy Osmani',
        bio: 'Engineering Manager working on Chrome. Author of "Learning JavaScript Design Patterns" and "Image Optimization"',
        followers: 45000,
        following: 300,
        publicRepos: 150,
        company: 'Google',
        location: 'Mountain View',
        relevanceScore: 0.90,
        qualityScore: 0.93,
        sources: ['hardcoded'],
      },
      {
        username: 'kentcdodds',
        displayName: 'Kent C. Dodds',
        bio: 'World class speaker, trainer, and author and he\'s happily married and the proud dad of a warrior princess',
        followers: 40000,
        following: 500,
        publicRepos: 300,
        company: 'Remix',
        location: 'Utah',
        relevanceScore: 0.88,
        qualityScore: 0.91,
        sources: ['hardcoded'],
      },
      {
        username: 'sindresorhus',
        displayName: 'Sindre Sorhus',
        bio: 'Open source maintainer. Created 1000+ modules. Living the dream.',
        followers: 35000,
        following: 200,
        publicRepos: 500,
        company: '',
        location: '',
        relevanceScore: 0.87,
        qualityScore: 0.90,
        sources: ['hardcoded'],
      },
    ];

    return hardcodedElite;
  }

  private async fetchProfile(username: string): Promise<GitHubBenchmarkProfile | null> {
    try {
      const user = await this.api.getAuthenticatedUser();
      
      if (user.login !== username) {
        throw new AppError('API_ERROR', 'Profile mismatch');
      }

      return {
        id: uuidv4(),
        username: user.login,
        displayName: user.name,
        bio: '',
        followers: 0,
        following: 0,
        publicRepos: 0,
        company: '',
        location: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        website: '',
        twitter: '',
        email: user.email,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch profile: ${error}`);
      return null;
    }
  }

  private async getProfileReadme(username: string): Promise<string | null> {
    try {
      const readme = await this.api.getRepositoryReadme(username, username);
      return readme?.content || null;
    } catch (error) {
      return null;
    }
  }

  private async getRepositoryReadme(owner: string, repo: string): Promise<string | null> {
    try {
      const readme = await this.api.getRepositoryReadme(owner, repo);
      return readme?.content || null;
    } catch (error) {
      return null;
    }
  }

  private async getTopRepositories(username: string, limit: number = 5): Promise<{ name: string }[]> {
    try {
      const repos = await this.api.getUserRepositories(username, limit);
      return repos.map(r => ({ name: r.name }));
    } catch (error) {
      return [];
    }
  }

  private async createBenchmarkProfile(candidate: GitHubBenchmarkCandidate): Promise<void> {
    const existing = await this.profileRepo.findByPlatform('github');
    if (existing.some(p => p.username === candidate.username)) {
      this.logger.debug(`Profile ${candidate.username} already exists`);
      return;
    }

    await this.profileRepo.create({
      id: uuidv4(),
      platform: 'github',
      externalId: candidate.username,
      username: candidate.username,
      displayName: candidate.displayName,
      bio: candidate.bio,
      persona: 'engineer',
      sourceUrl: `https://github.com/${candidate.username}`,
      relevanceScore: candidate.relevanceScore,
      isElite: candidate.qualityScore > 0.85,
      isIngested: false,
      metadata: {
        followers: candidate.followers,
        following: candidate.following,
        publicRepos: candidate.publicRepos,
        company: candidate.company,
        location: candidate.location,
        sources: candidate.sources,
        qualityScore: candidate.qualityScore,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  private calculateRelevanceScore(profile: GitHubBenchmarkProfile): number {
    let score = 0.5;

    if (profile.followers > 10000) score += 0.3;
    else if (profile.followers > 1000) score += 0.2;
    else if (profile.followers > 100) score += 0.1;

    if (profile.bio && profile.bio.length > 50) score += 0.1;
    if (profile.company) score += 0.05;
    if (profile.location) score += 0.05;

    return Math.min(1, score);
  }

  private calculateQualityScore(profile: GitHubBenchmarkProfile): number {
    let score = 0.5;

    if (profile.followers > 50000) score += 0.3;
    else if (profile.followers > 10000) score += 0.2;
    else if (profile.followers > 1000) score += 0.1;

    if (profile.publicRepos > 100) score += 0.1;
    if (profile.publicRepos > 50) score += 0.05;

    return Math.min(1, score);
  }
}