import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { LinkedInSelectors, getSelectorWithFallback } from './selectors';
import { Logger } from '@ancso/core';
import path from 'path';
import fs from 'fs';

export interface LinkedInCredentials {
  email: string;
  password: string;
}

export interface LinkedInProfileData {
  headline: string;
  about: string;
}

export interface LinkedInAutomationOptions {
  credentials?: LinkedInCredentials;
  headless?: boolean;
  userDataDir?: string;
  timeout?: number;
  screenshotDir?: string;
}

export interface LinkedInAutomationResult {
  success: boolean;
  message: string;
  headline?: {
    original: string;
    updated: string;
    verified: boolean;
  };
  about?: {
    original: string;
    updated: string;
    verified: boolean;
  };
  error?: {
    type: string;
    message: string;
    screenshotPath?: string;
    htmlDumpPath?: string;
  };
  actions: string[];
}

export class LinkedInAutomation {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private logger: Logger;
  private options: LinkedInAutomationOptions;
  private screenshotDir: string;

  constructor(options: LinkedInAutomationOptions = {}) {
    this.logger = new Logger('LinkedInAutomation');
    this.options = {
      headless: false,
      timeout: 30000,
      userDataDir: './data/linkedin',
      screenshotDir: './screenshots/linkedin',
      ...options,
    };
    this.screenshotDir = this.options.screenshotDir || './screenshots/linkedin';
    
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    const dirs = [this.screenshotDir, this.options.userDataDir];
    dirs.forEach(dir => {
      if (dir && !fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing LinkedIn automation...');

    const runAllowed = process.env.LINKEDIN_RUN_ALLOW === 'true';
    if (!runAllowed) {
      throw new Error(
        'LINKEDIN_RUN_ALLOW is not set to "true". ' +
        'Set LINKEDIN_RUN_ALLOW=true to enable LinkedIn automation. ' +
        'Note: This requires manual browser interaction for login.'
      );
    }

    this.logger.info('Launching browser (headed mode)...');

    this.browser = await chromium.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1920,1080',
      ],
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      storageState: this.options.userDataDir 
        ? path.join(this.options.userDataDir, 'storageState.json')
        : undefined,
    });

    this.page = await this.context.newPage();

    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        this.logger.error(`Browser console error: ${msg.text()}`);
      }
    });

    this.page.on('pageerror', error => {
      this.logger.error(`Page error: ${error.message}`);
    });

    this.logger.info('Browser initialized successfully');
  }

  async navigateToProfile(): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    this.logger.info('Navigating to LinkedIn profile...');
    await this.page.goto('https://www.linkedin.com/in/me', {
      waitUntil: 'networkidle',
      timeout: this.options.timeout,
    });

    await this.page.waitForTimeout(2000);
    this.logger.info('Navigated to profile page');
  }

  async login(credentials?: LinkedInCredentials): Promise<boolean> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    if (credentials) {
      this.logger.info('Attempting login with provided credentials...');
      
      await this.page.goto('https://www.linkedin.com/login', {
        waitUntil: 'networkidle',
        timeout: this.options.timeout,
      });

      await this.page.fill('input#username', credentials.email);
      await this.page.fill('input#password', credentials.password);
      await this.page.click('button[type="submit"]');

      await this.page.waitForTimeout(3000);

      if (this.page.url().includes('feed')) {
        this.logger.info('Login successful');
        
        if (this.options.userDataDir) {
          await this.context?.storageState({
            path: path.join(this.options.userDataDir, 'storageState.json'),
          });
          this.logger.info('Saved login state');
        }
        
        return true;
      }

      this.logger.warn('Login may have failed - continuing with saved state');
      return false;
    }

    this.logger.info('No credentials provided, checking for existing session...');
    return true;
  }

  async getProfileData(): Promise<LinkedInProfileData> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    const result: LinkedInProfileData = {
      headline: '',
      about: '',
    };

    await this.navigateToProfile();

    try {
      const headlineSelector = getSelectorWithFallback(LinkedInSelectors.headline.displayText);
      const headlineElement = await this.page.$(headlineSelector);
      if (headlineElement) {
        result.headline = await headlineElement.textContent() || '';
        this.logger.info(`Current headline: ${result.headline.substring(0, 50)}...`);
      }
    } catch (error) {
      this.logger.warn(`Could not fetch headline: ${error}`);
    }

    try {
      const aboutSelector = getSelectorWithFallback(LinkedInSelectors.about.displayText);
      const aboutElement = await this.page.$(aboutSelector);
      if (aboutElement) {
        result.about = await aboutElement.textContent() || '';
        this.logger.info(`Current about section: ${result.about.substring(0, 50)}...`);
      }
    } catch (error) {
      this.logger.warn(`Could not fetch about section: ${error}`);
    }

    return result;
  }

  async updateHeadline(newHeadline: string, dryRun: boolean = false): Promise<{
    success: boolean;
    original: string;
    updated: string;
    verified: boolean;
    actions: string[];
  }> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    const actions: string[] = [];
    let original = '';
    let verified = false;

    await this.navigateToProfile();

    try {
      const displaySelector = getSelectorWithFallback(LinkedInSelectors.headline.displayText);
      const displayElement = await this.page.locator(displaySelector).first();
      original = await displayElement.textContent() || '';
      actions.push(`Retrieved current headline: "${original.substring(0, 30)}..."`);

      if (dryRun) {
        actions.push(`DRY RUN: Would update headline to: "${newHeadline.substring(0, 30)}..."`);
        return { success: true, original, updated: newHeadline, verified: false, actions };
      }

      actions.push(`Updating headline to: "${newHeadline.substring(0, 30)}..."`);

      const editButtonSelector = getSelectorWithFallback(LinkedInSelectors.headline.editButton);
      await this.page.locator(editButtonSelector).click();
      await this.page.waitForTimeout(1000);
      actions.push('Clicked edit button');

      const textAreaSelector = getSelectorWithFallback(LinkedInSelectors.headline.textArea);
      await this.page.locator(textAreaSelector).fill(newHeadline);
      actions.push('Filled new headline');

      const saveButtonSelector = getSelectorWithFallback(LinkedInSelectors.headline.saveButton);
      await this.page.locator(saveButtonSelector).click();
      actions.push('Clicked save button');

      await this.page.waitForTimeout(3000);
      await this.page.reload({ waitUntil: 'networkidle' });
      actions.push('Reloaded page to verify');

      const verifySelector = getSelectorWithFallback(LinkedInSelectors.headline.displayText);
      const verifiedElement = await this.page.locator(verifySelector).first();
      const verifiedText = await verifiedElement.textContent() || '';
      
      verified = verifiedText.includes(newHeadline) || verifiedText.trim() === newHeadline.trim();
      actions.push(`Verification: ${verified ? 'SUCCESS' : 'FAILED'}`);

      if (!verified) {
        actions.push(`Expected: "${newHeadline.substring(0, 30)}..."`);
        actions.push(`Got: "${verifiedText.substring(0, 30)}..."`);
      }

      return { success: true, original, updated: newHeadline, verified, actions };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      actions.push(`ERROR: ${errorMsg}`);
      
      const { screenshotPath, htmlDumpPath } = await this.captureFailure('headline_update');
      
      return { 
        success: false, 
        original, 
        updated: newHeadline, 
        verified: false, 
        actions,
        error: { type: 'HEADLINE_UPDATE_ERROR', message: errorMsg, screenshotPath, htmlDumpPath }
      };
    }
  }

  async updateAbout(newAbout: string, dryRun: boolean = false): Promise<{
    success: boolean;
    original: string;
    updated: string;
    verified: boolean;
    actions: string[];
  }> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    const actions: string[] = [];
    let original = '';
    let verified = false;

    await this.navigateToProfile();

    try {
      const displaySelector = getSelectorWithFallback(LinkedInSelectors.about.displayText);
      const displayElement = await this.page.locator(displaySelector).first();
      original = await displayElement.textContent() || '';
      actions.push(`Retrieved current about section: "${original.substring(0, 50)}..."`);

      if (dryRun) {
        actions.push(`DRY RUN: Would update about section (${newAbout.length} characters)`);
        return { success: true, original, updated: newAbout, verified: false, actions };
      }

      actions.push(`Updating about section (${newAbout.length} characters)`);

      const editButtonSelector = getSelectorWithFallback(LinkedInSelectors.about.editButton);
      await this.page.locator(editButtonSelector).click();
      await this.page.waitForTimeout(1000);
      actions.push('Clicked edit button');

      const textAreaSelector = getSelectorWithFallback(LinkedInSelectors.about.textArea);
      await this.page.locator(textAreaSelector).fill(newAbout);
      actions.push('Filled new about section');

      const saveButtonSelector = getSelectorWithFallback(LinkedInSelectors.about.saveButton);
      await this.page.locator(saveButtonSelector).click();
      actions.push('Clicked save button');

      await this.page.waitForTimeout(3000);
      await this.page.reload({ waitUntil: 'networkidle' });
      actions.push('Reloaded page to verify');

      const verifySelector = getSelectorWithFallback(LinkedInSelectors.about.displayText);
      const verifiedElement = await this.page.locator(verifySelector).first();
      const verifiedText = await verifiedElement.textContent() || '';
      
      verified = verifiedText.includes(newAbout.substring(0, 100)) || 
                 verifiedText.trim() === newAbout.trim();
      actions.push(`Verification: ${verified ? 'SUCCESS' : 'FAILED'}`);

      if (!verified) {
        const preview = verifiedText.substring(0, 50);
        actions.push(`Expected content starting with: "${newAbout.substring(0, 50)}..."`);
        actions.push(`Got: "${preview}..."`);
      }

      return { success: true, original, updated: newAbout, verified, actions };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      actions.push(`ERROR: ${errorMsg}`);
      
      const { screenshotPath, htmlDumpPath } = await this.captureFailure('about_update');
      
      return { 
        success: false, 
        original, 
        updated: newAbout, 
        verified: false, 
        actions,
        error: { type: 'ABOUT_UPDATE_ERROR', message: errorMsg, screenshotPath, htmlDumpPath }
      };
    }
  }

  async applyProfileUpdates(
    headline: string,
    about: string,
    dryRun: boolean = false
  ): Promise<LinkedInAutomationResult> {
    const actions: string[] = [];
    let headlineResult: LinkedInAutomationResult['headline'];
    let aboutResult: LinkedInAutomationResult['about'];
    let error: LinkedInAutomationResult['error'];

    try {
      await this.initialize();
      await this.login(this.options.credentials);

      const headlineResponse = await this.updateHeadline(headline, dryRun);
      actions.push(...headlineResponse.actions);
      
      if (!headlineResponse.success) {
        return {
          success: false,
          message: 'Failed to update headline',
          headline: headlineResponse,
          actions,
          error: headlineResponse.error,
        };
      }

      headlineResult = {
        original: headlineResponse.original,
        updated: headlineResponse.updated,
        verified: headlineResponse.verified,
      };

      const aboutResponse = await this.updateAbout(about, dryRun);
      actions.push(...aboutResponse.actions);
      
      if (!aboutResponse.success) {
        return {
          success: false,
          message: 'Failed to update about section',
          headline: headlineResult,
          about: aboutResponse,
          actions,
          error: aboutResponse.error,
        };
      }

      aboutResult = {
        original: aboutResponse.original,
        updated: aboutResponse.updated,
        verified: aboutResponse.verified,
      };

      return {
        success: true,
        message: dryRun 
          ? 'Dry run completed - no changes made' 
          : 'Profile updates completed successfully',
        headline: headlineResult,
        about: aboutResult,
        actions,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      actions.push(`CRITICAL ERROR: ${errorMsg}`);
      
      const { screenshotPath, htmlDumpPath } = await this.captureFailure('critical_error');
      
      return {
        success: false,
        message: 'Critical error during profile update',
        actions,
        error: {
          type: 'CRITICAL_ERROR',
          message: errorMsg,
          screenshotPath,
          htmlDumpPath,
        },
      };
    } finally {
      await this.close();
    }
  }

  private async captureFailure(context: string): Promise<{
    screenshotPath?: string;
    htmlDumpPath?: string;
  }> {
    if (!this.page) return {};

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = `${context}-${timestamp}`;

    try {
      const screenshotPath = path.join(this.screenshotDir, `${baseName}.png`);
      await this.page.screenshot({ 
        path: screenshotPath, 
        fullPage: true 
      });
      this.logger.error(`Failure screenshot saved: ${screenshotPath}`);

      const htmlDumpPath = path.join(this.screenshotDir, `${baseName}.html`);
      const html = await this.page.content();
      fs.writeFileSync(htmlDumpPath, html);
      this.logger.error(`HTML dump saved: ${htmlDumpPath}`);

      return { screenshotPath, htmlDumpPath };
    } catch (screenshotError) {
      this.logger.error(`Failed to capture failure data: ${screenshotError}`);
      return {};
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
      this.logger.info('Browser closed');
    }
  }

  isInitialized(): boolean {
    return this.browser !== null;
  }
}

export async function runLinkedInAutomation(
  headline: string,
  about: string,
  options: LinkedInAutomationOptions = {}
): Promise<LinkedInAutomationResult> {
  const automation = new LinkedInAutomation(options);
  return automation.applyProfileUpdates(headline, about, options.headless === true);
}
