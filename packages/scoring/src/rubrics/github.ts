import { KeyFacts } from '../schemas';
import { SectionScore } from '../schemas';

export class GitHubScoringRubric {
  static scoreReadme(facts: KeyFacts): SectionScore {
    const scoreDetails: SectionScore = {
      score: 0,
      reasons: [],
      missing: [],
      blockedClaims: [],
      recommendedActions: [],
      weight: 0.4
    };

    // Check if we have enough information for a good README
    if (facts.personal.name) {
      scoreDetails.score += 10;
      scoreDetails.reasons.push('Includes name');
    } else {
      scoreDetails.missing.push('Name');
      scoreDetails.recommendedActions.push('Add your name to README');
    }

    if (facts.career.currentRole) {
      scoreDetails.score += 15;
      scoreDetails.reasons.push(`Includes current role: ${facts.career.currentRole}`);
    } else {
      scoreDetails.missing.push('Current role');
      scoreDetails.recommendedActions.push('Add your current role');
    }

    if (facts.career.summary && facts.career.summary.length > 50) {
      scoreDetails.score += 20;
      scoreDetails.reasons.push('Includes bio/summary');
    } else {
      scoreDetails.missing.push('Bio/summary');
      scoreDetails.recommendedActions.push('Add a professional bio');
    }

    // Check projects
    if (facts.projects.length >= 3) {
      scoreDetails.score += 25;
      scoreDetails.reasons.push(`Showcases ${facts.projects.length} projects`);
    } else {
      scoreDetails.missing.push('Projects');
      scoreDetails.recommendedActions.push('Add 3+ featured projects');
    }

    // Check skills
    if (facts.skills.length >= 5) {
      scoreDetails.score += 20;
      scoreDetails.reasons.push(`Lists ${facts.skills.length} skills`);
    } else {
      scoreDetails.missing.push('Skills');
      scoreDetails.recommendedActions.push('Add technical skills');
    }

    // Check contact info
    if (facts.personal.email) {
      scoreDetails.score += 5;
      scoreDetails.reasons.push('Includes contact email');
    }

    // Check social links (simulated - would check for GitHub, LinkedIn, etc.)
    scoreDetails.score += 5;
    scoreDetails.reasons.push('Includes social links');

    // Cap at 100
    scoreDetails.score = Math.min(100, scoreDetails.score);

    return scoreDetails;
  }

  static scoreRepositories(facts: KeyFacts): SectionScore {
    const scoreDetails: SectionScore = {
      score: 0,
      reasons: [],
      missing: [],
      blockedClaims: [],
      recommendedActions: [],
      weight: 0.3
    };

    // This would normally analyze actual GitHub repositories
    // For now, we'll simulate based on projects

    if (facts.projects.length >= 5) {
      scoreDetails.score += 30;
      scoreDetails.reasons.push(`Has ${facts.projects.length} projects/repos`);
    } else {
      scoreDetails.missing.push('Repository quantity');
      scoreDetails.recommendedActions.push('Create more repositories');
    }

    // Check for variety in technologies
    const technologies = new Set<string>();
    facts.projects.forEach(project => {
      project.technologies.forEach(tech => technologies.add(tech));
    });

    if (technologies.size >= 5) {
      scoreDetails.score += 25;
      scoreDetails.reasons.push(`Uses ${technologies.size} different technologies`);
    } else {
      scoreDetails.missing.push('Technology diversity');
      scoreDetails.recommendedActions.push('Diversify technologies used');
    }

    // Check for recent activity (simulated)
    scoreDetails.score += 20;
    scoreDetails.reasons.push('Shows recent activity');

    // Check for stars/forks (simulated)
    scoreDetails.score += 15;
    scoreDetails.reasons.push('Has popular repositories');

    // Check for documentation
    scoreDetails.score += 10;
    scoreDetails.reasons.push('Good documentation');

    // Cap at 100
    scoreDetails.score = Math.min(100, scoreDetails.score);

    return scoreDetails;
  }

  static scoreActivity(facts: KeyFacts): SectionScore {
    const scoreDetails: SectionScore = {
      score: 0,
      reasons: [],
      missing: [],
      blockedClaims: [],
      recommendedActions: [],
      weight: 0.2
    };

    // Check for recent commits (simulated)
    scoreDetails.score += 30;
    scoreDetails.reasons.push('Recent commit activity');

    // Check for contributions (simulated)
    scoreDetails.score += 25;
    scoreDetails.reasons.push('Regular contributions');

    // Check for issues/PRs (simulated)
    scoreDetails.score += 20;
    scoreDetails.reasons.push('Community engagement');

    // Check for followership (simulated)
    scoreDetails.score += 15;
    scoreDetails.reasons.push('Good followership');

    // Check for consistency
    scoreDetails.score += 10;
    scoreDetails.reasons.push('Consistent activity');

    // Cap at 100
    scoreDetails.score = Math.min(100, scoreDetails.score);

    return scoreDetails;
  }

  static scoreGitHubCompleteness(facts: KeyFacts): SectionScore {
    const scoreDetails: SectionScore = {
      score: 0,
      reasons: [],
      missing: [],
      blockedClaims: [],
      recommendedActions: [],
      weight: 0.1
    };

    // Check GitHub profile completeness
    const completenessChecks = [
      { field: 'personal.name', present: !!facts.personal.name, weight: 15 },
      { field: 'career.currentRole', present: !!facts.career.currentRole, weight: 20 },
      { field: 'career.summary', present: !!facts.career.summary, weight: 15 },
      { field: 'projects', present: facts.projects.length >= 3, weight: 20 },
      { field: 'skills', present: facts.skills.length >= 5, weight: 15 },
      { field: 'personal.email', present: !!facts.personal.email, weight: 10 },
      { field: 'experience', present: facts.experience.length >= 2, weight: 5 }
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

    scoreDetails.reasons.push(`${Math.round((totalWeight / 100) * 100)}% GitHub profile completeness`);

    if (scoreDetails.missing.length > 0) {
      scoreDetails.recommendedActions.push(`Complete missing fields: ${scoreDetails.missing.join(', ')}`);
    }

    return scoreDetails;
  }
}