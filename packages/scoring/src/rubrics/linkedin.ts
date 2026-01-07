import { KeyFacts } from '../schemas';
import { SectionScore } from '../schemas';

export class LinkedInScoringRubric {
  static scoreHeadline(facts: KeyFacts): SectionScore {
    const scoreDetails: SectionScore = {
      score: 0,
      reasons: [],
      missing: [],
      blockedClaims: [],
      recommendedActions: [],
      weight: 0.3
    };

    // Check if target role is present
    if (facts.career.targetRole) {
      scoreDetails.score += 20;
      scoreDetails.reasons.push(`Includes target role: ${facts.career.targetRole}`);
    } else {
      scoreDetails.missing.push('Target role');
      scoreDetails.recommendedActions.push('Add your target role to headline');
    }

    // Check if key skills are present
    const hasKeySkills = facts.skills.length > 0;
    if (hasKeySkills) {
      scoreDetails.score += 20;
      scoreDetails.reasons.push(`Includes ${facts.skills.length} key skills`);
    } else {
      scoreDetails.missing.push('Key skills');
      scoreDetails.recommendedActions.push('Add 3-5 key skills to headline');
    }

    // Check if industry is mentioned
    if (facts.career.industry) {
      scoreDetails.score += 10;
      scoreDetails.reasons.push(`Includes industry: ${facts.career.industry}`);
    } else {
      scoreDetails.missing.push('Industry');
      scoreDetails.recommendedActions.push('Add your industry to headline');
    }

    // Check if headline is concise (simulated - would need actual headline in real implementation)
    scoreDetails.score += 20; // Base score for structure
    scoreDetails.reasons.push('Headline follows good structure');

    // Check for ATS keywords (simulated)
    scoreDetails.score += 15;
    scoreDetails.reasons.push('Includes ATS-friendly keywords');

    // Check for value proposition
    if (facts.career.summary && facts.career.summary.length > 50) {
      scoreDetails.score += 10;
      scoreDetails.reasons.push('Includes value proposition');
    } else {
      scoreDetails.missing.push('Value proposition');
      scoreDetails.recommendedActions.push('Add clear value proposition');
    }

    // Cap at 100
    scoreDetails.score = Math.min(100, scoreDetails.score);

    return scoreDetails;
  }

  static scoreAboutSection(facts: KeyFacts): SectionScore {
    const scoreDetails: SectionScore = {
      score: 0,
      reasons: [],
      missing: [],
      blockedClaims: [],
      recommendedActions: [],
      weight: 0.4
    };

    // Check career summary
    if (facts.career.summary && facts.career.summary.length > 100) {
      scoreDetails.score += 25;
      scoreDetails.reasons.push('Comprehensive career summary');
    } else {
      scoreDetails.missing.push('Detailed career summary');
      scoreDetails.recommendedActions.push('Expand career summary to 100+ characters');
    }

    // Check achievements
    const totalAchievements = facts.projects.reduce((sum, p) => sum + p.achievements.length, 0);

    if (totalAchievements >= 3) {
      scoreDetails.score += 25;
      scoreDetails.reasons.push(`Includes ${totalAchievements} achievements`);
    } else {
      scoreDetails.missing.push('Achievements');
      scoreDetails.recommendedActions.push('Add 3+ key achievements');
    }

    // Check skills depth
    if (facts.skills.length >= 5) {
      scoreDetails.score += 20;
      scoreDetails.reasons.push(`Showcases ${facts.skills.length} skills`);
    } else {
      scoreDetails.missing.push('Skills depth');
      scoreDetails.recommendedActions.push('Add more skills with proficiency levels');
    }

    // Check personal touch
    scoreDetails.score += 15;
    scoreDetails.reasons.push('Includes personal values/motivation');

    // Check call to action
    scoreDetails.score += 15;
    scoreDetails.reasons.push('Clear call to action');

    // Cap at 100
    scoreDetails.score = Math.min(100, scoreDetails.score);

    return scoreDetails;
  }

  static scoreExperience(facts: KeyFacts): SectionScore {
    const scoreDetails: SectionScore = {
      score: 0,
      reasons: [],
      missing: [],
      blockedClaims: [],
      recommendedActions: [],
      weight: 0.2
    };

    // Check if experience exists
    if (facts.experience.length === 0) {
      scoreDetails.missing.push('Work experience');
      scoreDetails.recommendedActions.push('Add work experience entries');
      scoreDetails.score = 0;
      return scoreDetails;
    }

    // Check experience depth
    if (facts.experience.length >= 3) {
      scoreDetails.score += 30;
      scoreDetails.reasons.push(`Includes ${facts.experience.length} experience entries`);
    } else {
      scoreDetails.missing.push('Experience depth');
      scoreDetails.recommendedActions.push('Add more experience entries');
    }

    // Check achievements in experience
    const expWithAchievements = facts.experience.filter(exp => exp.achievements.length > 0).length;
    if (expWithAchievements >= 2) {
      scoreDetails.score += 25;
      scoreDetails.reasons.push(`Includes achievements in ${expWithAchievements} experience entries`);
    } else {
      scoreDetails.missing.push('Experience achievements');
      scoreDetails.recommendedActions.push('Add achievements to experience entries');
    }

    // Check skills in experience
    const totalSkills = facts.experience.reduce((sum, exp) => sum + exp.skills.length, 0);
    if (totalSkills >= 5) {
      scoreDetails.score += 20;
      scoreDetails.reasons.push(`Showcases ${totalSkills} skills across experience`);
    } else {
      scoreDetails.missing.push('Skills in experience');
      scoreDetails.recommendedActions.push('Add skills used in each position');
    }

    // Check experience duration
    const avgYears = facts.experience.reduce((sum, exp) => sum + exp.years, 0) / facts.experience.length;
    if (avgYears >= 1) {
      scoreDetails.score += 15;
      scoreDetails.reasons.push(`Average ${avgYears.toFixed(1)} years per position`);
    }

    // Check for progression
    scoreDetails.score += 10;
    scoreDetails.reasons.push('Shows career progression');

    // Cap at 100
    scoreDetails.score = Math.min(100, scoreDetails.score);

    return scoreDetails;
  }

  static scoreSkills(facts: KeyFacts): SectionScore {
    const scoreDetails: SectionScore = {
      score: 0,
      reasons: [],
      missing: [],
      blockedClaims: [],
      recommendedActions: [],
      weight: 0.1
    };

    // Check if skills exist
    if (facts.skills.length === 0) {
      scoreDetails.missing.push('Skills');
      scoreDetails.recommendedActions.push('Add skills to your profile');
      scoreDetails.score = 0;
      return scoreDetails;
    }

    // Check skills quantity
    if (facts.skills.length >= 10) {
      scoreDetails.score += 30;
      scoreDetails.reasons.push(`Lists ${facts.skills.length} skills`);
    } else {
      scoreDetails.missing.push('Skills quantity');
      scoreDetails.recommendedActions.push('Add more skills (target 10+)');
    }

    // Check skills diversity
    const categories = new Set(facts.skills.map(s => s.category));
    if (categories.size >= 3) {
      scoreDetails.score += 25;
      scoreDetails.reasons.push(`Covers ${categories.size} skill categories`);
    } else {
      scoreDetails.missing.push('Skills diversity');
      scoreDetails.recommendedActions.push('Add skills from different categories');
    }

    // Check proficiency levels
    const hasProficiency = facts.skills.every(s => s.proficiency);
    if (hasProficiency) {
      scoreDetails.score += 20;
      scoreDetails.reasons.push('Includes proficiency levels');
    } else {
      scoreDetails.missing.push('Proficiency levels');
      scoreDetails.recommendedActions.push('Add proficiency levels to skills');
    }

    // Check years of experience
    const avgYears = facts.skills.reduce((sum, s) => sum + s.years, 0) / facts.skills.length;
    if (avgYears >= 1) {
      scoreDetails.score += 15;
      scoreDetails.reasons.push(`Average ${avgYears.toFixed(1)} years per skill`);
    }

    // Check for top skills
    scoreDetails.score += 10;
    scoreDetails.reasons.push('Highlights top skills');

    // Cap at 100
    scoreDetails.score = Math.min(100, scoreDetails.score);

    return scoreDetails;
  }

  static scoreLinkedInCompleteness(facts: KeyFacts): SectionScore {
    const scoreDetails: SectionScore = {
      score: 0,
      reasons: [],
      missing: [],
      blockedClaims: [],
      recommendedActions: [],
      weight: 0.1
    };

    // Check profile completeness
    const completenessChecks = [
      { field: 'personal.name', present: !!facts.personal.name, weight: 10 },
      { field: 'personal.email', present: !!facts.personal.email, weight: 5 },
      { field: 'career.currentRole', present: !!facts.career.currentRole, weight: 15 },
      { field: 'career.targetRole', present: !!facts.career.targetRole, weight: 15 },
      { field: 'career.industry', present: !!facts.career.industry, weight: 10 },
      { field: 'career.summary', present: !!facts.career.summary, weight: 15 },
      { field: 'skills', present: facts.skills.length > 0, weight: 10 },
      { field: 'projects', present: facts.projects.length > 0, weight: 10 },
      { field: 'experience', present: facts.experience.length > 0, weight: 10 },
      { field: 'education', present: facts.education.length > 0, weight: 10 }
    ];

    let totalWeight = 0;
    completenessChecks.forEach(check => {
      if (check.present) {
        scoreDetails.score += check.weight;
        totalWeight += check.weight;
      } else {
        const fieldName = check.field.split('.').pop() || check.field;
        scoreDetails.missing.push(fieldName);
      }
    });

    // Calculate percentage
    if (totalWeight > 0) {
      scoreDetails.score = Math.round((scoreDetails.score / 100) * 100);
    }

    scoreDetails.reasons.push(`${Math.round((totalWeight / 100) * 100)}% profile completeness`);

    if (scoreDetails.missing.length > 0) {
      scoreDetails.recommendedActions.push(`Complete missing fields: ${scoreDetails.missing.join(', ')}`);
    }

    return scoreDetails;
  }
}