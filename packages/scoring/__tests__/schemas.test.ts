import { ProfileScoreReportSchema, ScoringInputSchema, SectionScoreSchema, KeyFactsSchema } from '../src/schemas';

describe('Scoring Schemas', () => {
  test('ProfileScoreReportSchema validates correct data', () => {
    const validData = {
      id: 'test-id',
      userId: 'test-user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: '1.0',
      overallScore: 85,
      recruiterScanScore: 90,
      investorCredibilityScore: 80,
      truthfulnessScore: 100,
      sections: {
        headline: {
          score: 85,
          reasons: ['Includes target role'],
          missing: [],
          blockedClaims: [],
          recommendedActions: [],
          weight: 0.3
        }
      },
      personaScores: {
        recruiter: 90,
        investor: 80
      },
      gapAnalysis: [],
      editPlan: []
    };

    const result = ProfileScoreReportSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  test('ProfileScoreReportSchema rejects invalid data', () => {
    const invalidData = {
      id: 'test-id',
      userId: 'test-user',
      // Missing required fields
      overallScore: 150, // Exceeds max
      sections: {
        headline: {
          score: 150, // Exceeds max
          reasons: [],
          missing: [],
          blockedClaims: [],
          recommendedActions: [],
          weight: 1.5 // Exceeds max
        }
      }
    };

    const result = ProfileScoreReportSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('ScoringInputSchema validates correct data', () => {
    const validData = {
      userId: 'test-user',
      factStore: {
        id: 'test-store',
        version: '1.0',
        userId: 'test-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        personal: { name: 'Test', email: 'test@example.com' },
        career: {
          currentRole: 'Developer',
          targetRole: 'Senior Developer',
          industry: 'Tech',
          yearsExperience: 5,
          careerSummary: 'Test summary'
        },
        projects: [],
        skills: [],
        education: [],
        experience: []
      },
      platform: 'linkedin',
      targetPersona: 'recruiter'
    };

    const result = ScoringInputSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  test('SectionScoreSchema validates correct data', () => {
    const validData = {
      score: 85,
      reasons: ['Test reason'],
      missing: ['Test missing'],
      blockedClaims: ['Test blocked'],
      recommendedActions: ['Test action'],
      weight: 0.5
    };

    const result = SectionScoreSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  test('KeyFactsSchema validates correct data', () => {
    const validData = {
      personal: {
        name: 'Test',
        email: 'test@example.com',
        location: 'Test Location'
      },
      career: {
        currentRole: 'Developer',
        targetRole: 'Senior Developer',
        industry: 'Tech',
        yearsExperience: 5,
        summary: 'Test summary'
      },
      skills: [{
        name: 'Test Skill',
        category: 'Test Category',
        proficiency: 'advanced',
        years: 3
      }],
      projects: [{
        name: 'Test Project',
        description: 'Test Description',
        technologies: ['Test Tech'],
        achievements: ['Test Achievement']
      }],
      experience: [{
        title: 'Test Title',
        company: 'Test Company',
        years: 2,
        achievements: ['Test Achievement'],
        skills: ['Test Skill']
      }],
      education: [{
        degree: 'Test Degree',
        institution: 'Test Institution',
        field: 'Test Field',
        gpa: '3.5'
      }]
    };

    const result = KeyFactsSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });
});