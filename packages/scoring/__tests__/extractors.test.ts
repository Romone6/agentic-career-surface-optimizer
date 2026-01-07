import { FactStoreExtractor } from '../src/extractors/fact-store';
import { UserFactStore } from '@ancso/core';

describe('FactStoreExtractor', () => {
  const mockFactStore: UserFactStore = {
    id: 'test-id',
    version: '1.0',
    userId: 'test-user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    personal: {
      name: 'John Doe',
      email: 'john@example.com',
      location: 'San Francisco',
      phone: '123-456-7890',
      websites: ['https://john.com']
    },
    career: {
      currentRole: 'Software Engineer',
      targetRole: 'Senior Software Engineer',
      industry: 'Technology',
      yearsExperience: 5,
      careerSummary: 'Experienced software engineer with 5 years of experience'
    },
    projects: [
      {
        id: 'proj-1',
        name: 'Project Alpha',
        description: 'A great project',
        technologies: ['TypeScript', 'React', 'Node'],
        achievements: ['Built scalable architecture', 'Improved performance'],
        startDate: '2020-01-01',
        endDate: '2021-01-01'
      },
      {
        id: 'proj-2',
        name: 'Project Beta',
        description: 'Another project',
        technologies: ['Python', 'Django'],
        achievements: ['Implemented key features'],
        startDate: '2021-01-01'
      }
    ],
    skills: [
      {
        id: 'skill-1',
        name: 'TypeScript',
        category: 'Programming',
        proficiency: 'advanced',
        yearsExperience: 3
      },
      {
        id: 'skill-2',
        name: 'Python',
        category: 'Programming',
        proficiency: 'intermediate',
        yearsExperience: 2
      },
      {
        id: 'skill-3',
        name: 'Project Management',
        category: 'Soft Skills',
        proficiency: 'advanced',
        yearsExperience: 4
      }
    ],
    education: [
      {
        id: 'edu-1',
        degree: 'Bachelor of Science',
        institution: 'University',
        fieldOfStudy: 'Computer Science',
        startDate: '2015-01-01',
        endDate: '2019-01-01',
        gpa: '3.8'
      }
    ],
    experience: [
      {
        id: 'exp-1',
        title: 'Software Engineer',
        company: 'Tech Company',
        location: 'San Francisco',
        startDate: '2019-01-01',
        endDate: '2021-01-01',
        achievements: ['Built key features', 'Improved system performance'],
        skillsUsed: ['TypeScript', 'React']
      },
      {
        id: 'exp-2',
        title: 'Junior Developer',
        company: 'Startup Inc',
        startDate: '2017-01-01',
        endDate: '2019-01-01',
        achievements: ['Developed core functionality'],
        skillsUsed: ['Python', 'Django']
      }
    ]
  };

  test('extractKeyFacts extracts all key information', () => {
    const keyFacts = FactStoreExtractor.extractKeyFacts(mockFactStore);

    expect(keyFacts.personal.name).toBe('John Doe');
    expect(keyFacts.personal.email).toBe('john@example.com');
    expect(keyFacts.personal.location).toBe('San Francisco');

    expect(keyFacts.career.currentRole).toBe('Software Engineer');
    expect(keyFacts.career.targetRole).toBe('Senior Software Engineer');
    expect(keyFacts.career.industry).toBe('Technology');
    expect(keyFacts.career.yearsExperience).toBe(5);

    expect(keyFacts.skills.length).toBe(3);
    expect(keyFacts.projects.length).toBe(2);
    expect(keyFacts.experience.length).toBe(2);
    expect(keyFacts.education.length).toBe(1);
  });

  test('extractSkillCategories counts skills by category', () => {
    const categories = FactStoreExtractor.extractSkillCategories(mockFactStore);

    expect(categories['Programming']).toBe(2);
    expect(categories['Soft Skills']).toBe(1);
  });

  test('extractTopSkills returns top skills by experience and proficiency', () => {
    const topSkills = FactStoreExtractor.extractTopSkills(mockFactStore, 2);

    expect(topSkills.length).toBe(2);
    expect(topSkills[0]).toBe('TypeScript'); // Most years + advanced
  });

  test('extractProjectTechnologies counts technologies across projects', () => {
    const technologies = FactStoreExtractor.extractProjectTechnologies(mockFactStore);

    expect(technologies['TypeScript']).toBe(1);
    expect(technologies['React']).toBe(1);
    expect(technologies['Node']).toBe(1);
    expect(technologies['Python']).toBe(1);
    expect(technologies['Django']).toBe(1);
  });

  test('calculateExperienceYears calculates total experience years', () => {
    const years = FactStoreExtractor.calculateExperienceYears(mockFactStore);

    expect(years).toBe(4); // 2 years each position
  });

  test('extractAchievements extracts all achievements', () => {
    const achievements = FactStoreExtractor.extractAchievements(mockFactStore);

    expect(achievements.length).toBe(5); // 2 from projects + 3 from experience
    expect(achievements).toContain('Built scalable architecture');
    expect(achievements).toContain('Built key features');
  });

  test('createContentSnapshot creates textual summary', () => {
    const snapshot = FactStoreExtractor.createContentSnapshot(mockFactStore);

    expect(snapshot).toContain('John Doe');
    expect(snapshot).toContain('Software Engineer');
    expect(snapshot).toContain('Project Alpha');
    expect(snapshot).toContain('TypeScript');
  });
});