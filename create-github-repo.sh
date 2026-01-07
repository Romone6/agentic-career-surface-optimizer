#!/bin/bash
# GitHub Repository Creation Script
# Run this after the main setup to create the GitHub repo

echo "GitHub Repository Setup"
echo "======================="
echo ""

# Check if gh is available
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo "   Install from: https://cli.github.com/"
    echo ""
    echo "   Or create repository manually:"
    echo "   1. Go to https://github.com/new"
    echo "   2. Create 'agentic-career-surface-optimizer' repository"
    echo "   3. Run: git remote add origin <repo-url>"
    echo "   4. Run: git push -u origin main"
    exit 1
fi

echo "GitHub CLI found. Options:"
echo ""
echo "1) Authenticate with GitHub (recommended)"
echo "   gh auth login"
echo ""
echo "2) Create repo without gh CLI"
echo "   - Go to https://github.com/new"
echo "   - Create 'agentic-career-surface-optimizer' repository"
echo "   - Run: git remote add origin <your-repo-url>"
echo "   - Run: git push -u origin main"
echo ""

if gh auth status &> /dev/null; then
    echo "✅ GitHub CLI is authenticated!"
    echo ""
    echo "Creating repository..."
    gh repo create agentic-career-surface-optimizer \
        --public \
        --description "Local-first agentic career surface optimizer with benchmark library" \
        --source . \
        --push
    
    echo ""
    echo "✅ Repository created and pushed!"
    echo ""
    echo "Your repository URL:"
    gh repo view --json url -q .url
else
    echo "Please authenticate first:"
    echo "  gh auth login"
    echo ""
    echo "After authentication, run:"
    echo "  gh repo create agentic-career-surface-optimizer --public --description \"Local-first agentic career surface optimizer\" --source . --push"
fi