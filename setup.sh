#!/bin/bash
# ═══════════════════════════════════════════════
# Radar Cal — GitHub repo setup & deployment
# Run this from inside the radar-cal/ folder
# ═══════════════════════════════════════════════

set -e

echo "🟢 Radar Cal — GitHub Setup"
echo "═══════════════════════════════"

# Check prerequisites
if ! command -v git &> /dev/null; then echo "❌ git not found. Install it first."; exit 1; fi
if ! command -v gh &> /dev/null; then echo "❌ GitHub CLI (gh) not found. Install: https://cli.github.com"; exit 1; fi

# Check auth
if ! gh auth status &> /dev/null; then
  echo "📋 You need to authenticate with GitHub first."
  echo "   Running: gh auth login"
  gh auth login
fi

echo ""
echo "1️⃣  Initializing git repo..."
git init
git add .
git commit -m "Initial commit: Radar Cal — radar-style calendar visualization

Features:
- Radar visualization with animated sweep line
- Events (circles) and Tasks (rounded squares)
- Smart to-do list with urgency scoring
- Task duration learning from completion history
- Custom categories with color picker
- Google Calendar OAuth integration
- Configurable time ranges (1D to 1Y)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

echo ""
echo "2️⃣  Creating GitHub repo..."
gh repo create radar-cal --public --source=. --remote=origin --description "Radar-style calendar visualization — events radiate outward from today"

echo ""
echo "3️⃣  Pushing to GitHub..."
git push -u origin main 2>/dev/null || git push -u origin master

echo ""
echo "4️⃣  Enabling GitHub Pages..."
BRANCH=$(git branch --show-current)
gh api -X PUT "repos/{owner}/radar-cal/pages" \
  -f "build_type=legacy" \
  -f "source[branch]=$BRANCH" \
  -f "source[path]=/" 2>/dev/null || \
gh api -X POST "repos/{owner}/radar-cal/pages" \
  -f "build_type=legacy" \
  -f "source[branch]=$BRANCH" \
  -f "source[path]=/" 2>/dev/null || \
echo "⚠️  Could not auto-enable Pages. Enable manually: repo Settings → Pages → Source: $BRANCH, folder: /"

echo ""
echo "5️⃣  Getting your URLs..."
REPO_URL=$(gh repo view --json url -q .url 2>/dev/null || echo "https://github.com/YOUR_USERNAME/radar-cal")
OWNER=$(gh api user -q .login 2>/dev/null || echo "YOUR_USERNAME")
PAGES_URL="https://${OWNER}.github.io/radar-cal"

echo ""
echo "═══════════════════════════════════════"
echo "✅ All done!"
echo ""
echo "📦 Repo:  $REPO_URL"
echo "🌐 Live:  $PAGES_URL"
echo ""
echo "⏳ GitHub Pages may take 1-2 minutes for the first deploy."
echo "   Check status: gh api repos/{owner}/radar-cal/pages -q .status"
echo ""
echo "💡 Next steps:"
echo "   - Update the README with your actual GitHub Pages URL"
echo "   - Set up Google Calendar OAuth with origin: $PAGES_URL"
echo "═══════════════════════════════════════"
