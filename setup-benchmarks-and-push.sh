#!/bin/bash

# LinkedIn Benchmark Setup and Git Push Script
# =============================================
# This script sets up the benchmark library and pushes to GitHub

set -e

echo "🔧 LinkedIn Benchmark Setup & Git Push"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Initialize Git
echo "📦 Step 1: Initializing Git repository..."
if [ -d ".git" ]; then
    echo "${YELLOW}Git repository already exists${NC}"
else
    git init
    git checkout -b main
    echo "${GREEN}Git repository initialized${NC}"
fi
echo ""

# Step 2: Verify seed file
echo "📋 Step 2: Verifying LinkedIn seed file..."
SEED_FILE="data/benchmarks/linkedin.seed.json"
if [ -f "$SEED_FILE" ]; then
    PROFILE_COUNT=$(grep -c '"url"' "$SEED_FILE")
    echo "${GREEN}Found $PROFILE_COUNT LinkedIn profiles${NC}"
else
    echo "${RED}Seed file not found: $SEED_FILE${NC}"
    exit 1
fi
echo ""

# Step 3: Show commands to run
echo "🚀 Step 3: Commands to run (execute in order):"
echo ""
echo "3a. Import LinkedIn profiles from seed file:"
echo "   pnpm cli benchmarks:add:linkedin --file $SEED_FILE"
echo ""
echo "3b. Ingest LinkedIn profiles (requires browser login):"
echo "   LINKEDIN_RUN_ALLOW=true pnpm cli benchmarks:ingest:linkedin --limit 10 --rate-limit-ms 2500"
echo ""
echo "3c. Generate embeddings for all benchmarks:"
echo "   pnpm cli benchmarks:embed"
echo ""
echo "3d. Test neighbors query:"
echo "   pnpm cli benchmarks:neighbors --text \"Senior software engineer with 10 years experience\" --platform linkedin --section about --k 5"
echo ""

# Step 4: Git operations
echo "🔐 Step 4: GitHub Setup"
echo ""

if command -v gh &> /dev/null; then
    echo "GitHub CLI (gh) found. Checking authentication..."
    if gh auth status &> /dev/null; then
        echo "${GREEN}GitHub CLI is authenticated${NC}"
        echo ""
        echo "Creating GitHub repository..."
        read -p "Enter repository name (default: agentic-career-surface-optimizer): " REPO_NAME
        REPO_NAME=${REPO_NAME:-agentic-career-surface-optimizer}
        
        echo ""
        echo "Repository visibility:"
        echo "  1) Public"
        echo "  2) Private"
        read -p "Choose (1/2): " VISIBILITY_CHOICE
        
        if [ "$VISIBILITY_CHOICE" = "2" ]; then
            VISIBILITY="--private"
        else
            VISIBILITY="--public"
        fi
        
        echo ""
        echo "Creating repository '$REPO_NAME'..."
        gh repo create "$REPO_NAME" $VISIBILITY --description "Local-first agentic career surface optimizer" --source . --push
        
        echo ""
        echo "${GREEN}✅ Repository created and pushed!${NC}"
        echo ""
        echo "Repository URL: $(gh repo view --json url -q .url)"
    else
        echo "${YELLOW}GitHub CLI not authenticated. Run 'gh auth login' first.${NC}"
        echo ""
        echo "Alternative: Manual remote setup"
        echo "  git remote add origin git@github.com:yourusername/$REPO_NAME.git"
        echo "  git push -u origin main"
    fi
else
    echo "GitHub CLI (gh) not found."
    echo ""
    echo "To create repository manually:"
    echo "  1. Go to https://github.com/new"
    echo "  2. Create repository '$REPO_NAME'"
    echo "  3. Run these commands:"
    echo ""
    echo "  git remote add origin git@github.com:yourusername/agentic-career-surface-optimizer.git"
    echo "  git branch -M main"
    echo "  git push -u origin main"
fi
echo ""

# Step 5: Final git commit and push
echo "📝 Step 5: Commit and prepare for push"
echo ""
echo "Adding all files to git..."
git add -A

echo ""
echo "Commit message:"
read -p "Enter commit message (default: 'Initial commit: local-first agentic career surface optimizer'): " COMMIT_MSG
COMMIT_MSG=${COMMIT_MSG:-"Initial commit: local-first agentic career surface optimizer"}

git commit -m "$COMMIT_MSG"

echo ""
echo "${GREEN}Changes committed!${NC}"
echo ""
echo "To push to GitHub:"
echo "  git push -u origin main"
echo ""
echo "======================================"
echo "✅ Setup complete!"
echo "======================================"