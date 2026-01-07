import { KeyFacts } from '../schemas';
import { ProfileScoreReport, ScoringInput } from '../schemas';
import { LinkedInScoringRubric } from './linkedin';
import { GitHubScoringRubric } from './github';
import { FactStoreExtractor } from '../extractors/fact-store';
import { v4 as uuidv4 } from 'uuid';

export class OverallScoringAlgorithm {
  static async generateScoreReport(input: ScoringInput): Promise<ProfileScoreReport> {
    const now = new Date().toISOString();
    const keyFacts = FactStoreExtractor.extractKeyFacts(input.factStore);

    // Initialize score report
    const scoreReport: ProfileScoreReport = {
      id: uuidv4(),
      userId: input.userId,
      createdAt: now,
      updatedAt: now,
      version: '1.0',
      overallScore: 0,
      recruiterScanScore: 0,
      investorCredibilityScore: 0,
      truthfulnessScore: 100, // Start with perfect truthfulness
      sections: {},
      personaScores: {},
      gapAnalysis: [],
      editPlan: []
    };

    // Score by platform
    if (input.platform === 'linkedin' || input.platform === 'combined') {
      this.scoreLinkedInSections(keyFacts, scoreReport);
    }

    if (input.platform === 'github' || input.platform === 'combined') {
      this.scoreGitHubSections(keyFacts, scoreReport);
    }

    // Calculate overall scores
    this.calculateOverallScores(scoreReport, input.targetPersona);

    // Generate gap analysis
    this.generateGapAnalysis(scoreReport, keyFacts, input.jobDescription);

    // Generate edit plan
    this.generateEditPlan(scoreReport);

    return scoreReport;
  }

  private static scoreLinkedInSections(facts: KeyFacts, report: ProfileScoreReport) {
    // Score each LinkedIn section
    report.sections.headline = LinkedInScoringRubric.scoreHeadline(facts);
    report.sections.about = LinkedInScoringRubric.scoreAboutSection(facts);
    report.sections.experience = LinkedInScoringRubric.scoreExperience(facts);
    report.sections.skills = LinkedInScoringRubric.scoreSkills(facts);

    // Add LinkedIn-specific sections
    report.sections['linkedin-completeness'] = LinkedInScoringRubric.scoreLinkedInCompleteness(facts);
  }

  private static scoreGitHubSections(facts: KeyFacts, report: ProfileScoreReport) {
    // Score GitHub sections
    report.sections.readme = GitHubScoringRubric.scoreReadme(facts);
    report.sections.repositories = GitHubScoringRubric.scoreRepositories(facts);
    report.sections.activity = GitHubScoringRubric.scoreActivity(facts);

    // Add GitHub-specific sections
    report.sections['github-completeness'] = GitHubScoringRubric.scoreGitHubCompleteness(facts);
  }

  private static calculateOverallScores(report: ProfileScoreReport, targetPersona: string) {
    // Calculate weighted section scores
    let totalWeight = 0;
    let weightedScore = 0;

    Object.values(report.sections).forEach(section => {
      totalWeight += section.weight;
      weightedScore += section.score * section.weight;
    });

    // Calculate base overall score
    report.overallScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;

    // Calculate persona-specific scores
    if (targetPersona === 'recruiter' || targetPersona === 'both') {
      report.recruiterScanScore = this.calculateRecruiterScore(report);
      report.personaScores.recruiter = report.recruiterScanScore;
    }

    if (targetPersona === 'investor' || targetPersona === 'both') {
      report.investorCredibilityScore = this.calculateInvestorScore(report);
      report.personaScores.investor = report.investorCredibilityScore;
    }

    // Calculate truthfulness score (would integrate with validator in real implementation)
    report.truthfulnessScore = this.calculateTruthfulnessScore(report);
  }

  private static calculateRecruiterScore(report: ProfileScoreReport): number {
    // Recruiter-focused scoring weights different sections
    const recruiterWeights = {
      'headline': 0.25,
      'about': 0.20,
      'experience': 0.30,
      'skills': 0.15,
      'linkedin-completeness': 0.10
    };

    let score = 0;
    let weight = 0;

    Object.entries(recruiterWeights).forEach(([section, sectionWeight]) => {
      if (report.sections[section]) {
        score += report.sections[section].score * sectionWeight;
        weight += sectionWeight;
      }
    });

    return weight > 0 ? Math.round(score / weight) : 0;
  }

  private static calculateInvestorScore(report: ProfileScoreReport): number {
    // Investor-focused scoring weights different sections
    const investorWeights = {
      'about': 0.30,
      'experience': 0.25,
      'projects': 0.20,
      'skills': 0.15,
      'linkedin-completeness': 0.10
    };

    let score = 0;
    let weight = 0;

    Object.entries(investorWeights).forEach(([section, sectionWeight]) => {
      if (report.sections[section]) {
        score += report.sections[section].score * sectionWeight;
        weight += sectionWeight;
      }
    });

    return weight > 0 ? Math.round(score / weight) : 0;
  }

  private static calculateTruthfulnessScore(report: ProfileScoreReport): number {
    // Calculate based on blocked claims
    let totalBlocked = 0;
    let totalClaims = 0;

    Object.values(report.sections).forEach(section => {
      totalBlocked += section.blockedClaims.length;
      // Estimate total claims from reasons + blocked
      totalClaims += section.reasons.length + section.blockedClaims.length;
    });

    if (totalClaims === 0) return 100;

    // Truthfulness = 100 - (blocked / total * 100)
    const truthfulness = 100 - Math.round((totalBlocked / totalClaims) * 100);
    return Math.max(0, truthfulness);
  }

  private static generateGapAnalysis(report: ProfileScoreReport, facts: KeyFacts, jobDescription?: string) {
    // Generate gap analysis based on current scores and targets
    const gaps: ProfileScoreReport['gapAnalysis'] = [];

    // Analyze each section for gaps
    Object.entries(report.sections).forEach(([section, score]) => {
      if (score.score < 80) { // If section score is below 80, identify gaps
        score.missing.forEach(missing => {
          gaps.push({
            gap: `Missing ${missing} in ${section}`,
            current: 'Not present',
            target: `Include ${missing}`,
            impact: 80 - score.score,
            difficulty: 'medium',
            actions: score.recommendedActions
          });
        });
      }
    });

    // Add persona-specific gaps
    if (report.recruiterScanScore < 85) {
      gaps.push({
        gap: 'Recruiter scan score below target',
        current: `${report.recruiterScanScore}/100`,
        target: '85+/100',
        impact: 85 - report.recruiterScanScore,
        difficulty: 'high',
        actions: [
          'Improve headline with target role and key skills',
          'Expand about section with quantifiable achievements',
          'Add more relevant experience details'
        ]
      });
    }

    if (report.investorCredibilityScore < 80) {
      gaps.push({
        gap: 'Investor credibility score below target',
        current: `${report.investorCredibilityScore}/100`,
        target: '80+/100',
        impact: 80 - report.investorCredibilityScore,
        difficulty: 'high',
        actions: [
          'Highlight leadership and impact in about section',
          'Showcase high-impact projects with metrics',
          'Emphasize strategic thinking and vision'
        ]
      });
    }

    // Add job description specific gaps if provided
    if (jobDescription) {
      this.addJobDescriptionGaps(gaps, jobDescription, facts);
    }

    report.gapAnalysis = gaps;
  }

  private static addJobDescriptionGaps(gaps: any[], jobDescription: string, facts: KeyFacts) {
    // Simple keyword matching for job description gaps
    const jdLower = jobDescription.toLowerCase();
    
    // Check for missing skills
    const missingSkills: string[] = [];
    
    // Common skill keywords to check
    const skillKeywords = ['javascript', 'typescript', 'python', 'java', 'react', 'node', 'aws', 'azure', 'docker', 'kubernetes'];
    
    skillKeywords.forEach(keyword => {
      if (jdLower.includes(keyword) && 
          !facts.skills.some(s => s.name.toLowerCase().includes(keyword))) {
        missingSkills.push(keyword);
      }
    });

    if (missingSkills.length > 0) {
      gaps.push({
        gap: 'Missing skills mentioned in job description',
        current: 'Not listed in skills',
        target: `Add: ${missingSkills.join(', ')}`,
        impact: 15,
        difficulty: 'medium',
        actions: [
          'Add missing skills to your profile',
          'Highlight relevant experience with these skills',
          'Consider learning these skills if critical for the role'
        ]
      });
    }

    // Check for experience requirements
    const experienceMatch = jdLower.match(/(\d+)\s*(?:year|yr|years|yrs)\s*(?:experience|exp)/);
    if (experienceMatch) {
      const requiredYears = parseInt(experienceMatch[1]);
      if (facts.career.yearsExperience < requiredYears) {
        gaps.push({
          gap: 'Experience requirement not met',
          current: `${facts.career.yearsExperience} years`,
          target: `${requiredYears}+ years`,
          impact: 20,
          difficulty: 'high',
          actions: [
            'Highlight transferable experience',
            'Emphasize relevant projects and achievements',
            'Consider additional experience or training'
          ]
        });
      }
    }
  }

  private static generateEditPlan(report: ProfileScoreReport) {
    // Generate prioritized edit plan
    const editPlan: ProfileScoreReport['editPlan'] = [];

    // Collect all recommended actions with their impact
    const actionsWithImpact: { action: string; section: string; impact: number; priority: number }[] = [];

    Object.entries(report.sections).forEach(([section, score]) => {
      score.recommendedActions.forEach(action => {
        // Estimate impact based on current score
        const impact = Math.min(20, 100 - score.score);
        actionsWithImpact.push({
          action,
          section,
          impact,
          priority: impact >= 15 ? 1 : impact >= 10 ? 2 : 3
        });
      });
    });

    // Add persona-specific high-impact actions
    if (report.recruiterScanScore < 85) {
      actionsWithImpact.push({
        action: 'Optimize headline for ATS with target role and key skills',
        section: 'headline',
        impact: 20,
        priority: 1
      });
    }

    if (report.investorCredibilityScore < 80) {
      actionsWithImpact.push({
        action: 'Add leadership narrative and vision to about section',
        section: 'about',
        impact: 25,
        priority: 1
      });
    }

    // Sort by priority and impact
    actionsWithImpact.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.impact - a.impact;
    });

    // Create edit plan items
    actionsWithImpact.forEach((item, index) => {
      editPlan.push({
        action: item.action,
        section: item.section,
        expectedLift: item.impact,
        risk: item.impact > 15 ? 'medium' : 'low',
        priority: item.priority,
        dependencies: item.section === 'about' ? ['headline'] : []
      });
    });

    report.editPlan = editPlan;
  }
}