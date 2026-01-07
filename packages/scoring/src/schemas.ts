import { z } from 'zod';
import { UserFactStore } from '@ancso/core';

// Profile Score Report Schema
export const ProfileScoreReportSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  version: z.string().default('1.0'),
  overallScore: z.number().min(0).max(100),
  recruiterScanScore: z.number().min(0).max(100),
  investorCredibilityScore: z.number().min(0).max(100),
  truthfulnessScore: z.number().min(0).max(100),
  sections: z.record(
    z.object({
      score: z.number().min(0).max(100),
      reasons: z.array(z.string()),
      missing: z.array(z.string()),
      blockedClaims: z.array(z.string()),
      recommendedActions: z.array(z.string()),
      weight: z.number().min(0).max(1).default(1)
    })
  ),
  personaScores: z.record(z.number().min(0).max(100)),
  gapAnalysis: z.array(z.object({
    gap: z.string(),
    current: z.string().optional(),
    target: z.string(),
    impact: z.number().min(0).max(100),
    difficulty: z.enum(['low', 'medium', 'high']),
    actions: z.array(z.string())
  })),
  editPlan: z.array(z.object({
    action: z.string(),
    section: z.string(),
    expectedLift: z.number().min(0).max(100),
    risk: z.enum(['low', 'medium', 'high']),
    dependencies: z.array(z.string()).optional(),
    priority: z.number().min(1).max(5)
  })).optional()
});

export type ProfileScoreReport = z.infer<typeof ProfileScoreReportSchema>;

// Section Score Schema
export const SectionScoreSchema = z.object({
  score: z.number().min(0).max(100),
  reasons: z.array(z.string()),
  missing: z.array(z.string()),
  blockedClaims: z.array(z.string()),
  recommendedActions: z.array(z.string()),
  weight: z.number().min(0).max(1).default(1)
});

export type SectionScore = z.infer<typeof SectionScoreSchema>;

// Scoring Input Schema
export const ScoringInputSchema = z.object({
  userId: z.string(),
  factStore: z.custom<UserFactStore>((val) => {
    // Basic validation - full validation happens in the service
    return val && typeof val === 'object' && val.userId && val.id;
  }),
  platform: z.enum(['linkedin', 'github', 'resume', 'combined']).default('combined'),
  targetPersona: z.enum(['recruiter', 'investor', 'both']).default('both'),
  currentContent: z.record(z.string()).optional(),
  jobDescription: z.string().optional()
});

export type ScoringInput = z.infer<typeof ScoringInputSchema>;

// Key Facts Schema (for extractors)
export const KeyFactsSchema = z.object({
  personal: z.object({
    name: z.string(),
    email: z.string(),
    location: z.string(),
  }),
  career: z.object({
    currentRole: z.string(),
    targetRole: z.string(),
    industry: z.string(),
    yearsExperience: z.number(),
    summary: z.string(),
  }),
  skills: z.array(z.object({
    name: z.string(),
    category: z.string(),
    proficiency: z.string(),
    years: z.number(),
  })),
  projects: z.array(z.object({
    name: z.string(),
    description: z.string(),
    technologies: z.array(z.string()),
    achievements: z.array(z.string()),
  })),
  experience: z.array(z.object({
    title: z.string(),
    company: z.string(),
    years: z.number(),
    achievements: z.array(z.string()),
    skills: z.array(z.string()),
  })),
  education: z.array(z.object({
    degree: z.string(),
    institution: z.string(),
    field: z.string(),
    gpa: z.string(),
  })),
});

export type KeyFacts = z.infer<typeof KeyFactsSchema>;