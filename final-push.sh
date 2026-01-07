#!/bin/bash
# Final Setup and GitHub Push Script
# ===================================
# Run this script to complete the project setup and push to GitHub

set -e

echo "🚀 Final Setup & GitHub Push"
echo "============================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Step 1: Check and create GitHub repo
echo "📦 Step 1: GitHub Repository Setup"
echo "-----------------------------------"

if command -v gh &> /dev/null; then
    echo "GitHub CLI found. Checking authentication..."
    
    if gh auth status &> /dev/null; then
        echo -e "${GREEN}✅ Authenticated with GitHub${NC}"
        
        # Create repo
        echo ""
        echo "Creating GitHub repository..."
        gh repo create agentic-career-surface-optimizer \
            --public \
            --description "Local-first agentic career surface optimizer with LinkedIn benchmark library" \
            --source . \
            --push
        
        echo ""
        echo -e "${GREEN}✅ Repository created and pushed!${NC}"
        echo ""
        echo "Your repository:"
        gh repo view --json url -q .url
    else
        echo -e "${YELLOW}⚠️  Not authenticated with GitHub${NC}"
        echo ""
        echo "Please run: gh auth login"
        echo ""
        echo "After authentication, run:"
        echo "  gh repo create agentic-career-surface-optimizer --public --description 'Local-first agentic career surface optimizer' --source . --push"
    fi
else
    echo -e "${YELLOW}⚠️  GitHub CLI not found${NC}"
    echo ""
    echo "Please install GitHub CLI: https://cli.github.com/"
    echo ""
    echo "Manual instructions:"
    echo "1. Go to https://github.com/new"
    echo "2. Create 'agentic-career-surface-optimizer' repository"
    echo "3. Run: git remote add origin git@github.com:yourusername/agentic-career-surface-optimizer.git"
    echo "4. Run: git push -u origin main"
fi

echo ""
echo "============================"
echo "✅ Setup Complete!"
echo "============================"
echo ""
echo "📋 Next Steps:"
echo "1. Authenticate with GitHub: gh auth login"
echo "2. Create and push repo: gh repo create agentic-career-surface-optimizer --public --source . --push"
echo ""
echo "📊 Benchmark Commands:"
echo "   pnpm cli benchmarks:add:linkedin --file data/benchmarks/linkedin.seed.json"
echo "   LINKEDIN_RUN_ALLOW=true pnpm cli benchmarks:ingest:linkedin --limit 50"
echo "   pnpm cli benchmarks:embed"
echo "   pnpm cli benchmarks:neighbors --text 'Your text' --platform linkedin --k 5"
echo ""
echo "🧠 Data-Driven Planning:"
echo "   pnpm cli profile:plan --mode data-driven --platform linkedin"