import { TruthfulnessValidator } from '../src/validators/truthfulness';
import { UserFactStore } from '@ancso/core';

describe('TruthfulnessValidator', () => {
  const mockFactStore: UserFactStore = {
    id: 'test-id',
    version: '1.0',
    userId: 'test-user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    personal: {
      name: 'John Doe',
      email: 'john@example.com',
      location: 'San Francisco'
    },
    career: {
      currentRole: 'Software Engineer',
      targetRole: 'Senior Software Engineer',
      industry: 'Technology',
      yearsExperience: 5,
      careerSummary: 'Experienced software engineer'
    },
    projects: [
      {
        id: 'proj-1',
        name: 'Project Alpha',
        description: 'A great project',
        technologies: ['TypeScript', 'React'],
        achievements: ['Built scalable architecture'],
        startDate: '2020-01-01'
      }
    ],
    skills: [
      {
        id: 'skill-1',
        name: 'TypeScript',
        category: 'Programming',
        proficiency: 'advanced',
        yearsExperience: 3
      }
    ],
    education: [
      {
        id: 'edu-1',
        degree: 'Bachelor of Science',
        institution: 'University',
        fieldOfStudy: 'Computer Science',
        startDate: '2015-01-01',
        endDate: '2019-01-01'
      }
    ],
    experience: [
      {
        id: 'exp-1',
        title: 'Software Engineer',
        company: 'Tech Company',
        startDate: '2019-01-01',
        achievements: ['Built key features'],
        skillsUsed: ['TypeScript']
      }
    ]
  };

  const mockArtifactGraph = {
    nodes: [],
    edges: []
  };

  test('validateClaim returns valid for supported claims', () => {
    const validator = new TruthfulnessValidator(mockFactStore, mockArtifactGraph);

    // Test personal info
    const personalResult = validator.validateClaim('John Doe');
    expect(personalResult.valid).toBe(true);
    expect(personalResult.supportingEvidence).toContain('personal.name: John Doe');

    // Test career info
    const careerResult = validator.validateClaim('Software Engineer');
    expect(careerResult.valid).toBe(true);
    expect(careerResult.supportingEvidence).toContain('career.currentRole: Software Engineer');

    // Test project info
    const projectResult = validator.validateClaim('Project Alpha');
    expect(projectResult.valid).toBe(true);
    expect(projectResult.supportingEvidence).toContain('projects.proj-1.name: Project Alpha');

    // Test skill info
    const skillResult = validator.validateClaim('TypeScript');
    expect(skillResult.valid).toBe(true);
    expect(skillResult.supportingEvidence).toContain('skills.skill-1.name: TypeScript');
  });

  test('validateClaim returns invalid for unsupported claims', () => {
    const validator = new TruthfulnessValidator(mockFactStore, mockArtifactGraph);

    const result = validator.validateClaim('I have 10 years of experience with Rust');
    expect(result.valid).toBe(false);
    expect(result.blockedReason).toBe('No supporting evidence found in fact store or artifact graph');
  });

  test('validateContent identifies blocked claims', () => {
    const validator = new TruthfulnessValidator(mockFactStore, mockArtifactGraph);

    const content = 'John Doe is a Software Engineer with 10 years of Rust experience. He built Project Alpha using TypeScript.';
    const result = validator.validateContent(content);

    expect(result.valid).toBe(false);
    expect(result.blockedClaims).toContain('I have 10 years of experience with Rust');
    expect(result.supportingEvidence).toBeDefined();
    expect(Object.keys(result.supportingEvidence).length).toBeGreaterThan(0);
  });

  test('calculateTruthfulnessScore calculates correctly', () => {
    const validator = new TruthfulnessValidator(mockFactStore, mockArtifactGraph);

    // 100% truthfulness
    const score1 = validator.calculateTruthfulnessScore([], 10);
    expect(score1).toBe(100);

    // 50% truthfulness
    const score2 = validator.calculateTruthfulnessScore([5], 10);
    expect(score2).toBe(50);

    // 0% truthfulness
    const score3 = validator.calculateTruthfulnessScore([10], 10);
    expect(score3).toBe(0);
  });
});