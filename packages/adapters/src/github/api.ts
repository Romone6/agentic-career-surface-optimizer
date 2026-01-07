import { Logger } from '@ancso/core';
import { AppError } from '@ancso/core';
import { GitHubOAuth, GitHubUser } from './oauth';
import { Octokit } from 'octokit';

export interface RepositoryInfo {
  id: number;
  name: string;
  fullName: string;
  description: string;
  htmlUrl: string;
  cloneUrl: string;
  language: string;
  stargazersCount: number;
  forksCount: number;
  topics: string[];
  updatedAt: Date;
  isFork: boolean;
  visibility: 'public' | 'private';
}

export interface ReadmeContent {
  content: string;
  sha: string;
  downloadUrl: string;
}

export class GitHubAPI {
  private oauth: GitHubOAuth;
  private logger: Logger;
  private octokit: Octokit | null = null;

  constructor(oauth?: GitHubOAuth) {
    this.oauth = oauth || new GitHubOAuth();
    this.logger = new Logger('GitHubAPI');
  }

  async initialize(): Promise<void> {
    try {
      const accessToken = await this.oauth.getAccessToken();
      
      if (!accessToken) {
        throw new AppError('AUTH_ERROR', 'No GitHub access token available');
      }

      this.octokit = new Octokit({
        auth: accessToken,
      });

      this.logger.info('GitHub API client initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize GitHub API: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async getAuthenticatedUser(): Promise<GitHubUser> {
    try {
      if (!this.octokit) {
        await this.initialize();
      }

      const { data: user } = await this.octokit!.rest.users.getAuthenticated();
      
      return {
        id: user.id,
        login: user.login,
        name: user.name || user.login,
        email: user.email || '',
        avatarUrl: user.avatar_url,
      };
    } catch (error) {
      this.logger.error(`Failed to get authenticated user: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('API_ERROR', `Failed to get authenticated user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getUserRepositories(username: string, limit: number = 10): Promise<RepositoryInfo[]> {
    try {
      if (!this.octokit) {
        await this.initialize();
      }

      const { data: repos } = await this.octokit!.rest.repos.listForUser({
        username,
        sort: 'updated',
        direction: 'desc',
        per_page: limit,
      });

      return repos.map(repo => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description || '',
        htmlUrl: repo.html_url,
        cloneUrl: repo.clone_url,
        language: repo.language || '',
        stargazersCount: repo.stargazers_count,
        forksCount: repo.forks_count,
        topics: repo.topics || [],
        updatedAt: new Date(repo.updated_at!),
        isFork: repo.fork,
        visibility: repo.visibility as 'public' | 'private',
      }));
    } catch (error) {
      this.logger.error(`Failed to get user repositories: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('API_ERROR', `Failed to get user repositories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getRepositoryReadme(owner: string, repo: string): Promise<ReadmeContent | null> {
    try {
      if (!this.octokit) {
        await this.initialize();
      }

      const { data } = await this.octokit!.rest.repos.getReadme({
        owner,
        repo,
        mediaType: {
          format: 'raw',
        },
      });

      if (data) {
        return {
          content: data.content ? Buffer.from(data.content, 'base64').toString('utf8') : '',
          sha: data.sha,
          downloadUrl: data.download_url || '',
        };
      }

      return null;
    } catch (error: any) {
      if (error.status === 404) {
        this.logger.debug(`No README found for ${owner}/${repo}`);
        return null;
      }
      
      this.logger.error(`Failed to get repository README: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('API_ERROR', `Failed to get repository README: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateRepositoryReadme(
    owner: string,
    repo: string,
    content: string,
    commitMessage: string = 'Update README via Agentic Neural Career Optimizer'
  ): Promise<void> {
    try {
      if (!this.octokit) {
        await this.initialize();
      }

      // Get current README to get SHA
      const currentReadme = await this.getRepositoryReadme(owner, repo);
      
      const contentBase64 = Buffer.from(content, 'utf8').toString('base64');

      await this.octokit!.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: 'README.md',
        message: commitMessage,
        content: contentBase64,
        sha: currentReadme?.sha,
      });

      this.logger.info(`Successfully updated README for ${owner}/${repo}`);
    } catch (error) {
      this.logger.error(`Failed to update repository README: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('API_ERROR', `Failed to update repository README: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createRepository(
    name: string,
    description: string,
    isPrivate: boolean = false,
    autoInit: boolean = true
  ): Promise<RepositoryInfo> {
    try {
      if (!this.octokit) {
        await this.initialize();
      }

      const { data: repo } = await this.octokit!.rest.repos.createForAuthenticatedUser({
        name,
        description,
        private: isPrivate,
        auto_init: autoInit,
      });

      return {
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description || '',
        htmlUrl: repo.html_url,
        cloneUrl: repo.clone_url,
        language: repo.language || '',
        stargazersCount: repo.stargazers_count,
        forksCount: repo.forks_count,
        topics: repo.topics || [],
        updatedAt: new Date(repo.updated_at!),
        isFork: repo.fork,
        visibility: repo.visibility as 'public' | 'private',
      };
    } catch (error) {
      this.logger.error(`Failed to create repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('API_ERROR', `Failed to create repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    body: string,
    head: string,
    base: string = 'main'
  ): Promise<string> {
    try {
      if (!this.octokit) {
        await this.initialize();
      }

      const { data: pr } = await this.octokit!.rest.pulls.create({
        owner,
        repo,
        title,
        body,
        head,
        base,
      });

      this.logger.info(`Successfully created PR #${pr.number} for ${owner}/${repo}`);
      return pr.html_url;
    } catch (error) {
      this.logger.error(`Failed to create pull request: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('API_ERROR', `Failed to create pull request: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateRepositoryTopics(owner: string, repo: string, topics: string[]): Promise<void> {
    try {
      if (!this.octokit) {
        await this.initialize();
      }

      await this.octokit!.rest.repos.replaceAllTopics({
        owner,
        repo,
        names: topics,
      });

      this.logger.info(`Successfully updated topics for ${owner}/${repo}`);
    } catch (error) {
      this.logger.error(`Failed to update repository topics: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('API_ERROR', `Failed to update repository topics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getRepositoryTopics(owner: string, repo: string): Promise<string[]> {
    try {
      if (!this.octokit) {
        await this.initialize();
      }

      const { data } = await this.octokit!.rest.repos.getAllTopics({
        owner,
        repo,
      });

      return data.names || [];
    } catch (error) {
      this.logger.error(`Failed to get repository topics: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('API_ERROR', `Failed to get repository topics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async checkRateLimit(): Promise<{ remaining: number; reset: Date }> {
    try {
      if (!this.octokit) {
        await this.initialize();
      }

      const { data } = await this.octokit!.rest.rateLimit.get();

      return {
        remaining: data.rate.remaining,
        reset: new Date(data.rate.reset * 1000),
      };
    } catch (error) {
      this.logger.error(`Failed to check rate limit: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('API_ERROR', `Failed to check rate limit: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getRepositoryStats(owner: string, repo: string): Promise<{
    stars: number;
    forks: number;
    watchers: number;
    openIssues: number;
    size: number;
  }> {
    try {
      if (!this.octokit) {
        await this.initialize();
      }

      const { data } = await this.octokit!.rest.repos.get({
        owner,
        repo,
      });

      return {
        stars: data.stargazers_count,
        forks: data.forks_count,
        watchers: data.watchers_count,
        openIssues: data.open_issues_count,
        size: data.size,
      };
    } catch (error) {
      this.logger.error(`Failed to get repository stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('API_ERROR', `Failed to get repository stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createBranch(owner: string, repo: string, branchName: string, sourceBranch: string = 'main'): Promise<void> {
    try {
      if (!this.octokit) {
        await this.initialize();
      }

      // Get the SHA of the source branch
      const { data: sourceBranchData } = await this.octokit!.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${sourceBranch}`,
      });

      // Create new branch
      await this.octokit!.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branchName}`,
        sha: sourceBranchData.object.sha,
      });

      this.logger.info(`Successfully created branch: ${branchName} from ${sourceBranch}`);
    } catch (error) {
      this.logger.error(`Failed to create branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('API_ERROR', `Failed to create branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createBranchWithReadmeUpdate(
    owner: string,
    repo: string,
    branchName: string,
    content: string,
    commitMessage: string,
    sourceBranch: string = 'main'
  ): Promise<void> {
    try {
      // Create the branch
      await this.createBranch(owner, repo, branchName, sourceBranch);

      // Get current README to get SHA
      const currentReadme = await this.getRepositoryReadme(owner, repo);
      const contentBase64 = Buffer.from(content, 'utf8').toString('base64');

      // Update README on the new branch
      await this.octokit!.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: 'README.md',
        message: commitMessage,
        content: contentBase64,
        sha: currentReadme?.sha,
        branch: branchName,
      });

      this.logger.info(`Successfully updated README on branch: ${branchName}`);
    } catch (error) {
      this.logger.error(`Failed to create branch with README update: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('API_ERROR', `Failed to create branch with README update: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteBranch(owner: string, repo: string, branchName: string): Promise<void> {
    try {
      if (!this.octokit) {
        await this.initialize();
      }

      await this.octokit!.rest.git.deleteRef({
        owner,
        repo,
        ref: `heads/${branchName}`,
      });

      this.logger.info(`Successfully deleted branch: ${branchName}`);
    } catch (error) {
      this.logger.error(`Failed to delete branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('API_ERROR', `Failed to delete branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}