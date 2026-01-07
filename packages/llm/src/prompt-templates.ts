import { z } from 'zod';

// Base prompt template interface
export interface PromptTemplate {
  id: string;
  version: string;
  name: string;
  description: string;
  inputSchema: z.ZodSchema<any>;
  outputSchema: z.ZodSchema<any>;
  template: string;
}

// LinkedIn Headline Template
const LinkedInHeadlineInputSchema = z.object({
  name: z.string(),
  currentTitle: z.string(),
  targetRole: z.string(),
  keySkills: z.array(z.string()),
  industry: z.string(),
  valueProposition: z.string(),
});

const LinkedInHeadlineOutputSchema = z.object({
  headline: z.string(),
  reasoning: z.string(),
  keywordsUsed: z.array(z.string()),
  claimsUsed: z.array(z.string()),
});

export const linkedinHeadlineTemplate: PromptTemplate = {
  id: 'linkedin_headline_v1',
  version: '1.0',
  name: 'LinkedIn Headline Generator',
  description: 'Generates an optimized LinkedIn headline based on user facts',
  inputSchema: LinkedInHeadlineInputSchema,
  outputSchema: LinkedInHeadlineOutputSchema,
  template: `
You are an expert career coach specializing in LinkedIn profile optimization for technical professionals. 
Generate an optimized LinkedIn headline that maximizes recruiter interest and ATS compatibility.

Constraints:
- Maximum 220 characters
- Must include target role and key skills
- Should highlight unique value proposition
- Use title case for main role, lowercase for descriptors
- Include relevant keywords for ATS

User Context:
- Name: {{name}}
- Current Title: {{currentTitle}}
- Target Role: {{targetRole}}
- Key Skills: {{keySkills.join(', ')}}
- Industry: {{industry}}
- Value Proposition: {{valueProposition}}

Output Format:
{
  "headline": "Generated headline text",
  "reasoning": "Explanation of why this headline is effective",
  "keywordsUsed": ["list", "of", "keywords"],
  "claimsUsed": ["references", "to", "user", "facts"]
}
`,
};

// LinkedIn About Section Template
const LinkedInAboutInputSchema = z.object({
  name: z.string(),
  currentRole: z.string(),
  careerSummary: z.string(),
  keyAchievements: z.array(z.string()),
  skills: z.array(z.string()),
  personality: z.string(),
  callToAction: z.string(),
});

const LinkedInAboutOutputSchema = z.object({
  about: z.string(),
  sections: z.array(z.string()),
  wordCount: z.number(),
  claimsUsed: z.array(z.string()),
});

export const linkedinAboutTemplate: PromptTemplate = {
  id: 'linkedin_about_v1',
  version: '1.0',
  name: 'LinkedIn About Section Generator',
  description: 'Generates an optimized LinkedIn about section',
  inputSchema: LinkedInAboutInputSchema,
  outputSchema: LinkedInAboutOutputSchema,
  template: `
You are an expert career coach creating compelling LinkedIn about sections for technical professionals.
Generate an engaging, achievement-focused about section that tells the user's career story.

Structure:
1. Opening hook (1 sentence)
2. Career summary (2-3 sentences)
3. Key achievements (bullet points)
4. Skills and expertise (paragraph)
5. Personality and values (1-2 sentences)
6. Call to action

Constraints:
- Maximum 2000 characters
- First-person perspective
- Professional yet approachable tone
- Include specific metrics where possible
- End with clear call to action

User Context:
- Name: {{name}}
- Current Role: {{currentRole}}
- Career Summary: {{careerSummary}}
- Key Achievements: {{keyAchievements.join('\\n')}}
- Skills: {{skills.join(', ')}}
- Personality: {{personality}}
- Call to Action: {{callToAction}}

Output Format:
{
  "about": "Generated about section text",
  "sections": ["list", "of", "section", "titles"],
  "wordCount": 250,
  "claimsUsed": ["references", "to", "user", "facts"]
}
`,
};

// GitHub Profile README Template
const GitHubReadmeInputSchema = z.object({
  username: z.string(),
  name: z.string(),
  currentRole: z.string(),
  bio: z.string(),
  featuredProjects: z.array(z.object({
    name: z.string(),
    description: z.string(),
    url: z.string(),
  })),
  skills: z.array(z.string()),
  socialLinks: z.record(z.string()),
});

const GitHubReadmeOutputSchema = z.object({
  readme: z.string(),
  sections: z.array(z.string()),
  hasTableOfContents: z.boolean(),
  claimsUsed: z.array(z.string()),
});

export const githubProfileReadmeTemplate: PromptTemplate = {
  id: 'github_profile_readme_v1',
  version: '1.0',
  name: 'GitHub Profile README Generator',
  description: 'Generates an optimized GitHub profile README',
  inputSchema: GitHubReadmeInputSchema,
  outputSchema: GitHubReadmeOutputSchema,
  template: `
You are a technical writer creating professional GitHub profile READMEs.
Generate a comprehensive, well-structured README that showcases the user's technical expertise.

Structure:
1. Header with name and role
2. Brief bio (2-3 sentences)
3. Featured projects (with descriptions and links)
4. Skills section (categorized)
5. Social links
6. Call to action

Constraints:
- Use Markdown formatting
- Include table of contents if >3 sections
- Project descriptions should be technical and specific
- Skills should be categorized (languages, frameworks, tools)
- Include emojis sparingly for visual interest

User Context:
- Username: {{username}}
- Name: {{name}}
- Current Role: {{currentRole}}
- Bio: {{bio}}
- Featured Projects: {{featuredProjects.map(p => "`{\\n  name: \${p.name},\\n  description: \${p.description},\\n  url: \${p.url}\n}").join('\\n')}}
- Skills: {{skills.join(', ')}}
- Social Links: {{Object.entries(socialLinks).map(([key, value]) => "`\${key}: \${value}").join('\\n')}}

Output Format:
{
  "readme": "Generated README content in Markdown",
  "sections": ["list", "of", "section", "titles"],
  "hasTableOfContents": true,
  "claimsUsed": ["references", "to", "user", "facts"]
}
`,
};

// Resume ATS Template
const ResumeATSInputSchema = z.object({
  name: z.string(),
  contactInfo: z.object({
    email: z.string(),
    phone: z.string().optional(),
    location: z.string().optional(),
    linkedin: z.string().optional(),
    github: z.string().optional(),
  }),
  summary: z.string(),
  experience: z.array(z.object({
    title: z.string(),
    company: z.string(),
    dates: z.string(),
    achievements: z.array(z.string()),
  })),
  education: z.array(z.object({
    degree: z.string(),
    institution: z.string(),
    dates: z.string(),
  })),
  skills: z.array(z.string()),
  targetJobDescription: z.string().optional(),
});

const ResumeATSOutputSchema = z.object({
  resume: z.string(),
  keywordMatchScore: z.number(),
  atsCompatibilityScore: z.number(),
  claimsUsed: z.array(z.string()),
});

export const resumeATSTemplate: PromptTemplate = {
  id: 'resume_ats_v1',
  version: '1.0',
  name: 'ATS-Focused Resume Generator',
  description: 'Generates a resume optimized for Applicant Tracking Systems',
  inputSchema: ResumeATSInputSchema,
  outputSchema: ResumeATSOutputSchema,
  template: `
You are a professional resume writer specializing in ATS optimization.
Generate a clean, keyword-rich resume that maximizes ATS compatibility while remaining human-readable.

ATS Optimization Guidelines:
- Use standard section headings (Experience, Education, Skills)
- Avoid tables, columns, or complex formatting
- Include relevant keywords from target job description
- Use simple, clean formatting
- Keep consistent date formats
- Use standard font styles

Structure:
1. Contact Information
2. Professional Summary (3-4 sentences)
3. Technical Skills (bullet list)
4. Professional Experience (reverse chronological)
5. Education
6. Additional Sections (if relevant)

User Context:
- Name: {{name}}
- Contact Info: {{JSON.stringify(contactInfo, null, 2)}}
- Summary: {{summary}}
- Experience: {{experience.map(e => "`{\\n  title: \${e.title},\\n  company: \${e.company},\\n  dates: \${e.dates},\\n  achievements: [\${e.achievements.map(a => "`\${a}").join(', ')}]\n}").join('\\n')}}
- Education: {{education.map(e => "`{\\n  degree: \${e.degree},\\n  institution: \${e.institution},\\n  dates: \${e.dates}\n}").join('\\n')}}
- Skills: {{skills.join(', ')}}
- Target Job Description: {{targetJobDescription || 'Not provided'}}

Output Format:
{
  "resume": "Generated resume content",
  "keywordMatchScore": 85,
  "atsCompatibilityScore": 95,
  "claimsUsed": ["references", "to", "user", "facts"]
}
`,
};

// Export all templates
export const PROMPT_TEMPLATES = {
  linkedinHeadlineTemplate,
  linkedinAboutTemplate,
  githubProfileReadmeTemplate,
  resumeATSTemplate,
};

export type PromptTemplates = typeof PROMPT_TEMPLATES;