import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Configuration schema
const ConfigSchema = z.object({
  // OpenRouter configuration
  OPENROUTER_API_KEY: z.string().min(1, 'OPENROUTER_API_KEY is required'),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  OPENROUTER_DEFAULT_MODEL: z.string().min(1, 'OPENROUTER_DEFAULT_MODEL is required'),
  OPENROUTER_FALLBACK_MODEL: z.string().min(1, 'OPENROUTER_FALLBACK_MODEL is required'),
  OPENROUTER_USE_STRUCTURED_OUTPUT: z
    .string()
    .transform((val) => val.toLowerCase() === 'true')
    .default('true'),
  OPENROUTER_MAX_TOKENS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default('1024'),
  OPENROUTER_TEMPERATURE: z
    .string()
    .transform((val) => parseFloat(val))
    .default('0.4'),

  // Application configuration
  APP_DATA_DIR: z.string().default('./data'),
  SQLITE_PATH: z.string().default('./data/app.sqlite'),
  CACHE_DIR: z.string().default('./cache'),
  LOG_DIR: z.string().default('./logs'),

  // GitHub configuration
  GITHUB_OAUTH_CLIENT_ID: z.string().min(1, 'GITHUB_OAUTH_CLIENT_ID is required'),
  GITHUB_OAUTH_CLIENT_SECRET: z.string().min(1, 'GITHUB_OAUTH_CLIENT_SECRET is required'),
  GITHUB_OAUTH_CALLBACK_URL: z
    .string()
    .url()
    .default('http://localhost:8787/callback'),

  // Playwright configuration
  PLAYWRIGHT_BROWSER: z.string().default('chromium'),
  PLAYWRIGHT_HEADLESS: z
    .string()
    .transform((val) => val.toLowerCase() === 'true')
    .default('false'),

  // LinkedIn configuration
  LINKEDIN_RUN_ALLOW: z
    .string()
    .transform((val) => val.toLowerCase() === 'true')
    .default('false'),

  // Job application configuration
  JOB_APPLY_ALLOWLIST_DOMAINS: z.string().optional(),
  STOP_BEFORE_FINAL_SUBMIT: z
    .string()
    .transform((val) => val.toLowerCase() === 'true')
    .default('true'),
});

export type Config = z.infer<typeof ConfigSchema>;

let config: Config | null = null;

export function loadConfig(): Config {
  if (config) {
    return config;
  }

  // Validate environment variables
  const envValidation = ConfigSchema.safeParse(process.env);

  if (!envValidation.success) {
    const errorMessage = `Configuration validation failed:\n${envValidation.error.errors
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n')}`;
    
    console.error(errorMessage);
    console.error('\nPlease check your .env file and ensure all required variables are set.');
    console.error('See .env.example for the required configuration.');
    
    process.exit(1);
  }

  config = envValidation.data;

  // Ensure directories exist
  ensureDirectoriesExist(config);

  return config;
}

function ensureDirectoriesExist(config: Config): void {
  const dirsToCreate = [
    config.APP_DATA_DIR,
    path.dirname(config.SQLITE_PATH),
    config.CACHE_DIR,
    config.LOG_DIR,
  ];

  dirsToCreate.forEach((dir) => {
    const fullPath = path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`Created directory: ${fullPath}`);
    }
  });
}

export function getConfig(): Config {
  if (!config) {
    return loadConfig();
  }
  return config;
}