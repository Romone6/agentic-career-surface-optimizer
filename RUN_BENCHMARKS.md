# LinkedIn Benchmark Pipeline - Run Commands
# ===========================================
# Execute these commands in order

## Step 1: Import LinkedIn Profiles from Seed File
# ------------------------------------------------
# This loads the 50 LinkedIn benchmark profiles into the database
pnpm cli benchmarks:add:linkedin --file data/benchmarks/linkedin.seed.json

## Step 2: Ingest LinkedIn Profiles (Requires Browser)
# ----------------------------------------------------
# IMPORTANT: This requires LINKEDIN_RUN_ALLOW=true
# A browser window will open - log into LinkedIn manually
# The automation will then visit each profile and extract data

# Rate limit: 2500ms between profiles to respect LinkedIn
# Failures are logged to logs/benchmarks_linkedin_failures.jsonl
LINKEDIN_RUN_ALLOW=true pnpm cli benchmarks:ingest:linkedin --limit 50 --rate-limit-ms 2500

## Step 3: Generate Embeddings for All Benchmarks
# ------------------------------------------------
# This creates vector embeddings for similarity search
pnpm cli benchmarks:embed

## Step 4: Test Neighbors Query
# ------------------------------
# Find similar benchmarks to a sample profile text
pnpm cli benchmarks:neighbors \
  --text "Senior software engineer with 10+ years of experience building scalable systems" \
  --platform linkedin \
  --section about \
  --k 5

## Step 5: Generate Data-Driven Plan
# -----------------------------------
# Use benchmark data to generate optimization suggestions
pnpm cli profile:plan --mode data-driven --platform linkedin

## Step 6: View Benchmark Stats
# ------------------------------
# Check how many profiles have been ingested
pnpm cli benchmarks:stats

## Git Setup Commands (run separately)
# =====================================

# Initialize git (if not already done)
git init
git checkout -b main

# Add all files (respects .gitignore)
git add -A

# Commit
git commit -m "Initial commit: local-first agentic career surface optimizer"

# Create GitHub repo (requires gh CLI and authentication)
gh repo create agentic-career-surface-optimizer --public --description "Local-first agentic career surface optimizer"
git remote add origin git@github.com:yourusername/agentic-career-surface-optimizer.git
git push -u origin main

# OR if gh is not available, create repo manually at https://github.com/new then:
# git remote add origin git@github.com:yourusername/agentic-career-surface-optimizer.git
# git push -u origin main

## Troubleshooting
# ================

# If LinkedIn ingestion fails:
# 1. Check logs/benchmarks_linkedin_failures.jsonl
# 2. Ensure you're logged into LinkedIn in the browser
# 3. Try with smaller --limit to test

# If embeddings fail:
# 1. Check OPENROUTER_API_KEY is set in .env
# 2. Run pnpm cli benchmarks:stats to verify profiles exist

# To clear all benchmark data and start fresh:
# pnpm cli benchmarks:clear
