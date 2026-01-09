import { Command } from 'commander';
import chalk from 'chalk';
import crypto from 'crypto';
import https from 'https';
import { initDb, getDb, getDbPath, normalizeUsername, dbRun, dbGet, saveDb } from '../db';

function httpRequest(url: string, headers: Record<string, string> = {}): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 0, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode || 0, data: null });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

async function getUserDetails(username: string, token?: string): Promise<any> {
  const url = `https://api.github.com/users/${username}`;
  const headers: Record<string, string> = { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'ANCSO-Ranker/1.0' };
  if (token) headers['Authorization'] = `token ${token}`;
  
  const result = await httpRequest(url, headers);
  if (result.status !== 200) {
    console.log(`    GitHub API error: HTTP ${result.status}`);
  }
  return result.status === 200 ? result.data : null;
}

async function getUserRepos(username: string, token?: string, limit = 5): Promise<any[]> {
  const url = `https://api.github.com/users/${username}/repos?sort=stars&per_page=${limit}&direction=desc`;
  const headers: Record<string, string> = { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'ANCSO-Ranker/1.0' };
  if (token) headers['Authorization'] = `token ${token}`;
  
  const result = await httpRequest(url, headers);
  if (result.status !== 200) {
    console.log(`    GitHub repos API error: HTTP ${result.status}`);
    return [];
  }
  return result.data || [];
}

async function getUserReadme(username: string, token?: string): Promise<string | null> {
  const url = `https://api.github.com/users/${username}/repos?per_page=100&sort=updated`;
  const headers: Record<string, string> = { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'ANCSO-Ranker/1.0' };
  if (token) headers['Authorization'] = `token ${token}`;
  
  const result = await httpRequest(url, headers);
  if (result.status !== 200 || !result.data) {
    return null;
  }
  
  const repos: any[] = result.data;
  const sortedRepos = repos.sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  
  for (const repo of sortedRepos.slice(0, 5)) {
    const readmeUrl = `https://api.github.com/repos/${username}/${repo.name}/readme`;
    const readmeResult = await httpRequest(readmeUrl, headers);
    if (readmeResult.status === 200 && readmeResult.data?.content) {
      try {
        return Buffer.from(readmeResult.data.content, 'base64').toString('utf-8');
      } catch {
        return null;
      }
    }
  }
  return null;
}

async function doIngest(profilesToIngest: string[], refresh: boolean, token?: string): Promise<void> {
  console.log(chalk.blue(`\nFetching profile data for ${profilesToIngest.length} profiles...\n`));

  let profilesInserted = 0;
  let profilesUpdated = 0;
  let sectionsInserted = 0;
  let sectionsUpdated = 0;
  let skipped = 0;
  let errors = 0;

  for (const username of profilesToIngest) {
    const normalizedUsername = normalizeUsername(username);
    console.log(`  Processing: ${normalizedUsername}`);

    try {
      const existing = dbGet<{ id: string }>("SELECT id FROM benchmark_profiles WHERE platform = 'github' AND LOWER(username) = ?", [normalizedUsername]);
      
      if (existing && !refresh) {
        console.log(`    ${normalizedUsername} (already ingested, skipped)`);
        skipped++;
        continue;
      }

      console.log(`    Fetching user data from GitHub...`);
      const userData = await getUserDetails(normalizedUsername, token);
      
      if (!userData) {
        console.log(`    ${normalizedUsername} (GitHub API error: user not found)`);
        errors++;
        continue;
      }

      const login = normalizeUsername(userData.login || normalizedUsername);
      const profileId = existing?.id || crypto.randomUUID();
      const profileData = {
        login: userData.login,
        name: userData.name,
        bio: userData.bio,
        followers: userData.followers,
        following: userData.following,
        public_repos: userData.public_repos,
        company: userData.company,
        location: userData.location,
        blog: userData.blog,
        twitter: userData.twitter_username,
        hireable: userData.hireable,
        updated_at: userData.updated_at,
      };

      if (existing) {
        dbRun(`UPDATE benchmark_profiles SET raw_data_json = ? WHERE id = ?`,
          [JSON.stringify(profileData), profileId]);
        profilesUpdated++;
        console.log(`    ${normalizedUsername} (profile updated, followers: ${userData.followers})`);
      } else {
        dbRun(`INSERT INTO benchmark_profiles (id, platform, username, url, is_elite, raw_data_json) VALUES (?, ?, ?, ?, ?, ?)`,
          [profileId, 'github', login, `https://github.com/${login}`, 0, JSON.stringify(profileData)]);
        profilesInserted++;
        console.log(`    ${normalizedUsername} (profile created, followers: ${userData.followers})`);
      }

      if (userData.bio) {
        const existingBio = dbGet<{ id: string }>("SELECT id FROM benchmark_sections WHERE profile_id = ? AND section_type = 'bio'", [profileId]);
        const wordCount = (userData.bio || '').split(/\s+/).length;
        
        if (existingBio) {
          dbRun(`UPDATE benchmark_sections SET content = ?, word_count = ?, metadata_json = ? WHERE id = ?`,
            [userData.bio, wordCount, JSON.stringify({ sectionName: 'bio' }), existingBio.id]);
          sectionsUpdated++;
        } else {
          dbRun(`INSERT INTO benchmark_sections (id, profile_id, section_type, content, word_count, metadata_json) VALUES (?, ?, ?, ?, ?, ?)`,
            [crypto.randomUUID(), profileId, 'bio', userData.bio, wordCount, JSON.stringify({ sectionName: 'bio' })]);
          sectionsInserted++;
        }
      }

      console.log(`    Fetching repos and README...`);
      const repos = await getUserRepos(login, token, 5);
      
      if (repos && repos.length > 0) {
        for (const repo of repos.slice(0, 3)) {
          const existingRepo = dbGet<{ id: string }>("SELECT id FROM benchmark_sections WHERE profile_id = ? AND section_type = 'repo_desc' AND json_extract(metadata_json, '$.repoName') = ?", [profileId, repo.name]);
          
          if (repo.description) {
            const wordCount = (repo.description || '').split(/\s+/).length;
            
            if (existingRepo) {
              dbRun(`UPDATE benchmark_sections SET content = ?, word_count = ?, metadata_json = ? WHERE id = ?`,
                [`${repo.name}: ${repo.description}`, wordCount, JSON.stringify({ repoName: repo.name, stars: repo.stargazers_count, url: repo.html_url }), existingRepo.id]);
              sectionsUpdated++;
            } else {
              dbRun(`INSERT INTO benchmark_sections (id, profile_id, section_type, content, word_count, metadata_json) VALUES (?, ?, ?, ?, ?, ?)`,
                [crypto.randomUUID(), profileId, 'repo_desc', `${repo.name}: ${repo.description}`, wordCount, JSON.stringify({ repoName: repo.name, stars: repo.stargazers_count, url: repo.html_url })]);
              sectionsInserted++;
            }
          }
        }
      }

      console.log(`    Fetching profile README...`);
      const readme = await getUserReadme(login, token);
      if (readme && readme.length > 50) {
        const existingReadme = dbGet<{ id: string }>("SELECT id FROM benchmark_sections WHERE profile_id = ? AND section_type = 'profile_readme'", [profileId]);
        const wordCount = readme.split(/\s+/).length;
        
        if (existingReadme) {
          dbRun(`UPDATE benchmark_sections SET content = ?, word_count = ?, metadata_json = ? WHERE id = ?`,
            [readme, wordCount, JSON.stringify({ sectionName: 'profile_readme' }), existingReadme.id]);
          sectionsUpdated++;
        } else {
          dbRun(`INSERT INTO benchmark_sections (id, profile_id, section_type, content, word_count, metadata_json) VALUES (?, ?, ?, ?, ?, ?)`,
            [crypto.randomUUID(), profileId, 'profile_readme', readme, wordCount, JSON.stringify({ sectionName: 'profile_readme' })]);
          sectionsInserted++;
        }
        console.log(`    README: ${readme.length} chars`);
      }

      saveDb();
      await new Promise(r => setTimeout(r, 500));

    } catch (error) {
      console.log(`    ${normalizedUsername}: ERROR - ${error instanceof Error ? error.message : 'Unknown error'}`);
      errors++;
    }
  }

  console.log(chalk.green('\nIngestion complete!'));
  console.log(`   Profiles inserted: ${profilesInserted}`);
  console.log(`   Profiles updated: ${profilesUpdated}`);
  console.log(`   Sections inserted: ${sectionsInserted}`);
  console.log(`   Sections updated: ${sectionsUpdated}`);
  console.log(`   Skipped (already exists): ${skipped}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   DB path: ${getDbPath()}`);
}

export function rankerIngestCommands(): Command {
  const command = new Command('ingest')
    .description('Ingest GitHub profile data')
    .option('--platform <platform>', 'Platform to ingest from', 'github')
    .option('--usernames <csv>', 'Comma-separated usernames (manual override)')
    .option('--refresh', 'Force refresh cached data')
    .action(async (options) => {
      console.log(chalk.blue('\nIngesting GitHub Profiles'));
      console.log('================================\n');

      const platform = options.platform;
      const usernames = options.usernames ? options.usernames.split(',').map((u: string) => normalizeUsername(u)).filter((u: string) => u.length > 0) : [];
      const refresh = options.refresh || false;

      console.log(`DB path: ${getDbPath()}`);

      if (platform !== 'github') {
        console.log(chalk.yellow('Only GitHub platform is supported at this time.'));
        return;
      }

      const token = process.env.GITHUB_TOKEN;
      if (token) {
        console.log('GITHUB_TOKEN found - using authenticated requests');
      } else {
        console.log(chalk.yellow('GITHUB_TOKEN not set - using unauthenticated requests'));
      }

      await initDb();

      if (usernames.length > 0) {
        console.log(`Manual mode: ingesting ${usernames.length} specified users`);
        await doIngest(usernames, refresh, token);
      } else {
        console.log(chalk.yellow('No --usernames specified.'));
        console.log('Example: ancso ranker:ingest --platform github --usernames torvalds,facebook');
      }
    });

  return command;
}
