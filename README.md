# Agentic Neural Career Surface Optimizer

A personal-first, open-source, local-first agentic system that learns what elite LinkedIn + GitHub profiles look like and why, then aggressively optimizes your profiles.

## Features

- **Profile Optimization**: Automatically optimizes LinkedIn and GitHub profiles based on elite profile analysis
- **Job Matching**: Matches your profile against job descriptions and identifies gaps
- **Resume Generation**: Generates ATS-focused and investor-focused resumes
- **Cover Letter Generation**: Creates personalized cover letters based on job descriptions
- **Continuous Learning**: Continuously learns from public exemplars and career commentary

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Run the doctor command to check setup
pnpm run doctor

# Start the questionnaire to build your fact store
pnpm run facts:new

# Analyze your current profiles
pnpm run profile:analyze

# Generate and apply optimizations
pnpm run profile:plan
pnpm run profile:apply:github
pnpm run profile:apply:linkedin
```

## Architecture

This is a monorepo with the following structure:

- `apps/cli`: Main CLI application
- `apps/ui`: Optional web UI (feature-flagged)
- `packages/core`: Core types, config, logging, storage
- `packages/llm`: OpenRouter client, prompt templates, caching
- `packages/scoring`: Rubrics, validators, diff engine
- `packages/adapters`: GitHub and LinkedIn adapters
- `packages/automation`: Playwright drivers and site runners
- `packages/ml`: Embeddings and ranker training scaffold

## Safety & Compliance

- Local-first: All data stored locally by default
- No password collection or session hijacking
- Manual login required for all platforms
- Single run-level approval for automation
- Stop-before-submit for form filling

See [SECURITY.md](SECURITY.md) and [DATA_POLICY.md](DATA_POLICY.md) for details.

## Documentation

- [Setup Guide](docs/SETUP.md)
- [Architecture](ARCHITECTURE.md)
- [Scoring Model](docs/SCORING.md)
- [Prompt Templates](docs/PROMPTS.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## License

MIT License - See [LICENSE](LICENSE)