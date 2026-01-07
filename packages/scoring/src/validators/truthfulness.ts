import { z } from 'zod';
import { UserFactStore, ArtifactNode, ArtifactEdge } from '@ancso/core';
import { AppError } from '@ancso/core';

export class TruthfulnessValidator {
  private factStore: UserFactStore;
  private artifactGraph: { nodes: ArtifactNode[]; edges: ArtifactEdge[] };

  constructor(factStore: UserFactStore, artifactGraph: { nodes: ArtifactNode[]; edges: ArtifactEdge[] }) {
    this.factStore = factStore;
    this.artifactGraph = artifactGraph;
  }

  validateClaim(claim: string): { valid: boolean; supportingEvidence?: string[]; blockedReason?: string } {
    // Implement claim validation logic
    const normalizedClaim = claim.toLowerCase();

    // Check against personal information
    const personalChecks = this.checkPersonalClaims(normalizedClaim);
    if (personalChecks.valid) return personalChecks;

    // Check against career information
    const careerChecks = this.checkCareerClaims(normalizedClaim);
    if (careerChecks.valid) return careerChecks;

    // Check against projects
    const projectChecks = this.checkProjectClaims(normalizedClaim);
    if (projectChecks.valid) return projectChecks;

    // Check against skills
    const skillChecks = this.checkSkillClaims(normalizedClaim);
    if (skillChecks.valid) return skillChecks;

    // Check against experience
    const experienceChecks = this.checkExperienceClaims(normalizedClaim);
    if (experienceChecks.valid) return experienceChecks;

    // Check against education
    const educationChecks = this.checkEducationClaims(normalizedClaim);
    if (educationChecks.valid) return educationChecks;

    // Check against artifact graph
    const artifactChecks = this.checkArtifactClaims(normalizedClaim);
    if (artifactChecks.valid) return artifactChecks;

    return {
      valid: false,
      blockedReason: 'No supporting evidence found in fact store or artifact graph'
    };
  }

  private checkPersonalClaims(claim: string): { valid: boolean; supportingEvidence?: string[] } {
    const evidence: string[] = [];

    if (this.factStore.personal.name && claim.includes(this.factStore.personal.name.toLowerCase())) {
      evidence.push(`personal.name: ${this.factStore.personal.name}`);
    }

    if (this.factStore.personal.email && claim.includes(this.factStore.personal.email.toLowerCase())) {
      evidence.push(`personal.email: ${this.factStore.personal.email}`);
    }

    if (this.factStore.personal.location && claim.includes(this.factStore.personal.location.toLowerCase())) {
      evidence.push(`personal.location: ${this.factStore.personal.location}`);
    }

    if (this.factStore.personal.phone && claim.includes(this.factStore.personal.phone.toLowerCase())) {
      evidence.push(`personal.phone: ${this.factStore.personal.phone}`);
    }

    // Check websites if they exist
    if (this.factStore.personal.websites) {
      for (const website of this.factStore.personal.websites) {
        if (website && claim.includes(website.toLowerCase())) {
          evidence.push(`personal.websites: ${website}`);
        }
      }
    }

    return {
      valid: evidence.length > 0,
      supportingEvidence: evidence.length > 0 ? evidence : undefined
    };
  }

  private checkCareerClaims(claim: string): { valid: boolean; supportingEvidence?: string[] } {
    const evidence: string[] = [];

    if (this.factStore.career.currentRole && claim.includes(this.factStore.career.currentRole.toLowerCase())) {
      evidence.push(`career.currentRole: ${this.factStore.career.currentRole}`);
    }

    if (this.factStore.career.targetRole && claim.includes(this.factStore.career.targetRole.toLowerCase())) {
      evidence.push(`career.targetRole: ${this.factStore.career.targetRole}`);
    }

    if (this.factStore.career.industry && claim.includes(this.factStore.career.industry.toLowerCase())) {
      evidence.push(`career.industry: ${this.factStore.career.industry}`);
    }

    if (this.factStore.career.careerSummary && claim.includes(this.factStore.career.careerSummary.toLowerCase())) {
      evidence.push(`career.careerSummary: (partial match)`);
    }

    // Check years of experience
    if (claim.includes('year') && claim.includes('experience')) {
      evidence.push(`career.yearsExperience: ${this.factStore.career.yearsExperience} years`);
    }

    return {
      valid: evidence.length > 0,
      supportingEvidence: evidence.length > 0 ? evidence : undefined
    };
  }

  private checkProjectClaims(claim: string): { valid: boolean; supportingEvidence?: string[] } {
    const evidence: string[] = [];

    for (const project of this.factStore.projects) {
      if (project.name && claim.includes(project.name.toLowerCase())) {
        evidence.push(`projects.${project.id}.name: ${project.name}`);
      }

      if (project.description && claim.includes(project.description.toLowerCase())) {
        evidence.push(`projects.${project.id}.description: (partial match)`);
      }

      // Check technologies
      for (const tech of project.technologies) {
        if (tech && claim.includes(tech.toLowerCase())) {
          evidence.push(`projects.${project.id}.technologies: ${tech}`);
        }
      }

      // Check achievements
      for (const achievement of project.achievements) {
        if (achievement && claim.includes(achievement.toLowerCase())) {
          evidence.push(`projects.${project.id}.achievements: (partial match)`);
        }
      }
    }

    return {
      valid: evidence.length > 0,
      supportingEvidence: evidence.length > 0 ? evidence : undefined
    };
  }

  private checkSkillClaims(claim: string): { valid: boolean; supportingEvidence?: string[] } {
    const evidence: string[] = [];

    for (const skill of this.factStore.skills) {
      if (skill.name && claim.includes(skill.name.toLowerCase())) {
        evidence.push(`skills.${skill.id}.name: ${skill.name}`);
      }

      if (skill.category && claim.includes(skill.category.toLowerCase())) {
        evidence.push(`skills.${skill.id}.category: ${skill.category}`);
      }

      if (skill.proficiency && claim.includes(skill.proficiency.toLowerCase())) {
        evidence.push(`skills.${skill.id}.proficiency: ${skill.proficiency}`);
      }
    }

    return {
      valid: evidence.length > 0,
      supportingEvidence: evidence.length > 0 ? evidence : undefined
    };
  }

  private checkExperienceClaims(claim: string): { valid: boolean; supportingEvidence?: string[] } {
    const evidence: string[] = [];

    for (const exp of this.factStore.experience) {
      if (exp.title && claim.includes(exp.title.toLowerCase())) {
        evidence.push(`experience.${exp.id}.title: ${exp.title}`);
      }

      if (exp.company && claim.includes(exp.company.toLowerCase())) {
        evidence.push(`experience.${exp.id}.company: ${exp.company}`);
      }

      if (exp.location && claim.includes(exp.location.toLowerCase())) {
        evidence.push(`experience.${exp.id}.location: ${exp.location}`);
      }

      // Check achievements
      for (const achievement of exp.achievements) {
        if (achievement && claim.includes(achievement.toLowerCase())) {
          evidence.push(`experience.${exp.id}.achievements: (partial match)`);
        }
      }

      // Check skills
      for (const skill of exp.skillsUsed) {
        if (skill && claim.includes(skill.toLowerCase())) {
          evidence.push(`experience.${exp.id}.skillsUsed: ${skill}`);
        }
      }
    }

    return {
      valid: evidence.length > 0,
      supportingEvidence: evidence.length > 0 ? evidence : undefined
    };
  }

  private checkEducationClaims(claim: string): { valid: boolean; supportingEvidence?: string[] } {
    const evidence: string[] = [];

    for (const edu of this.factStore.education) {
      if (edu.degree && claim.includes(edu.degree.toLowerCase())) {
        evidence.push(`education.${edu.id}.degree: ${edu.degree}`);
      }

      if (edu.institution && claim.includes(edu.institution.toLowerCase())) {
        evidence.push(`education.${edu.id}.institution: ${edu.institution}`);
      }

      if (edu.fieldOfStudy && claim.includes(edu.fieldOfStudy.toLowerCase())) {
        evidence.push(`education.${edu.id}.fieldOfStudy: ${edu.fieldOfStudy}`);
      }

      if (edu.gpa && claim.includes(edu.gpa.toLowerCase())) {
        evidence.push(`education.${edu.id}.gpa: ${edu.gpa}`);
      }
    }

    return {
      valid: evidence.length > 0,
      supportingEvidence: evidence.length > 0 ? evidence : undefined
    };
  }

  private checkArtifactClaims(claim: string): { valid: boolean; supportingEvidence?: string[] } {
    const evidence: string[] = [];

    // Check artifact nodes
    for (const node of this.artifactGraph.nodes) {
      if (node.name && claim.includes(node.name.toLowerCase())) {
        evidence.push(`artifact.${node.type}.${node.id}: ${node.name}`);
      }

      if (node.description && claim.includes(node.description.toLowerCase())) {
        evidence.push(`artifact.${node.type}.${node.id}.description: (partial match)`);
      }

      if (node.url && claim.includes(node.url.toLowerCase())) {
        evidence.push(`artifact.${node.type}.${node.id}.url: ${node.url}`);
      }

      // Check metadata
      if (node.metadata) {
        for (const [key, value] of Object.entries(node.metadata)) {
          if (typeof value === 'string' && claim.includes(value.toLowerCase())) {
            evidence.push(`artifact.${node.type}.${node.id}.metadata.${key}: ${value}`);
          }
        }
      }
    }

    return {
      valid: evidence.length > 0,
      supportingEvidence: evidence.length > 0 ? evidence : undefined
    };
  }

  validateContent(content: string): { valid: boolean; blockedClaims: string[]; supportingEvidence: Record<string, string[]> } {
    // Split content into claims (simple implementation)
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const result = {
      valid: true,
      blockedClaims: [] as string[],
      supportingEvidence: {} as Record<string, string[]>
    };

    for (const sentence of sentences) {
      const validation = this.validateClaim(sentence.trim());
      if (!validation.valid) {
        result.valid = false;
        result.blockedClaims.push(sentence.trim());
      } else if (validation.supportingEvidence) {
        result.supportingEvidence[sentence.trim()] = validation.supportingEvidence;
      }
    }

    return result;
  }

  calculateTruthfulnessScore(blockedClaims: string[], totalClaims: number): number {
    if (totalClaims === 0) return 100;

    // Truthfulness = 100 - (blocked / total * 100)
    const truthfulness = 100 - Math.round((blockedClaims.length / totalClaims) * 100);
    return Math.max(0, truthfulness);
  }
}