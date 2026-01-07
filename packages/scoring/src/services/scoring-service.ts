import { ScoringInput, ProfileScoreReport } from '../schemas';
import { OverallScoringAlgorithm } from '../rubrics/overall';
import { TruthfulnessValidator } from '../validators/truthfulness';
import { FactStoreExtractor } from '../extractors/fact-store';
import { Logger } from '@ancso/core';
import { AppError } from '@ancso/core';

export class ScoringService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('ScoringService');
  }

  async generateProfileScoreReport(input: ScoringInput): Promise<ProfileScoreReport> {
    try {
      this.logger.info(`Generating score report for user: ${input.userId}`);

      // Validate input
      const validation = ScoringInputSchema.safeParse(input);
      if (!validation.success) {
        throw new AppError('VALIDATION_ERROR', `Invalid scoring input: ${validation.error.message}`);
      }

      // Generate score report
      const scoreReport = await OverallScoringAlgorithm.generateScoreReport(input);

      this.logger.info(`Score report generated for user: ${input.userId}`);
      this.logger.debug(`Scores - Overall: ${scoreReport.overallScore}, Recruiter: ${scoreReport.recruiterScanScore}, Investor: ${scoreReport.investorCredibilityScore}`);

      return scoreReport;
    } catch (error) {
      this.logger.error(`Generate score report failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('SCORING_ERROR', `Failed to generate score report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async validateContentTruthfulness(
    userId: string,
    content: string,
    factStore: any,
    artifactGraph: any
  ): Promise<{ valid: boolean; blockedClaims: string[]; scoreImpact: number }> {
    try {
      this.logger.info(`Validating content truthfulness for user: ${userId}`);

      const validator = new TruthfulnessValidator(factStore, artifactGraph);
      const validation = validator.validateContent(content);

      // Calculate score impact
      const totalClaims = validation.supportingEvidence ? Object.keys(validation.supportingEvidence).length : 0;
      const scoreImpact = validation.blockedClaims.length > 0
        ? Math.round((validation.blockedClaims.length / (totalClaims + validation.blockedClaims.length)) * 100)
        : 0;

      return {
        valid: validation.valid,
        blockedClaims: validation.blockedClaims,
        scoreImpact
      };
    } catch (error) {
      this.logger.error(`Truthfulness validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('VALIDATION_ERROR', `Failed to validate content truthfulness: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateGapAnalysis(input: ScoringInput): Promise<ProfileScoreReport['gapAnalysis']> {
    try {
      this.logger.info(`Generating gap analysis for user: ${input.userId}`);

      // Generate full score report to get gap analysis
      const scoreReport = await this.generateProfileScoreReport(input);

      return scoreReport.gapAnalysis;
    } catch (error) {
      this.logger.error(`Gap analysis generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('SCORING_ERROR', `Failed to generate gap analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateEditPlan(input: ScoringInput): Promise<ProfileScoreReport['editPlan']> {
    try {
      this.logger.info(`Generating edit plan for user: ${input.userId}`);

      // Generate full score report to get edit plan
      const scoreReport = await this.generateProfileScoreReport(input);

      if (!scoreReport.editPlan) {
        throw new AppError('SCORING_ERROR', 'No edit plan generated - check score report');
      }

      return scoreReport.editPlan;
    } catch (error) {
      this.logger.error(`Edit plan generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('SCORING_ERROR', `Failed to generate edit plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async calculateTruthfulnessScore(
    userId: string,
    factStore: any,
    artifactGraph: any,
    content: string
  ): Promise<number> {
    try {
      this.logger.info(`Calculating truthfulness score for user: ${userId}`);

      const validator = new TruthfulnessValidator(factStore, artifactGraph);
      const validation = validator.validateContent(content);

      const score = validator.calculateTruthfulnessScore(
        validation.blockedClaims,
        validation.blockedClaims.length + 
        (validation.supportingEvidence ? Object.keys(validation.supportingEvidence).length : 0)
      );

      return score;
    } catch (error) {
      this.logger.error(`Truthfulness score calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('SCORING_ERROR', `Failed to calculate truthfulness score: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}