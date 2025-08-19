#!/bin/bash

echo "🚀 Deploying EqualShield Worker to Railway"

# Check if railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

# Login to Railway
echo "🔐 Logging into Railway..."
railway login

# Create new project or link existing
echo "📦 Setting up Railway project..."
railway link

# Set environment variables
echo "🔧 Setting environment variables..."
railway variables set SUPABASE_URL="$SUPABASE_URL"
railway variables set SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
railway variables set OPENAI_API_KEY="$OPENAI_API_KEY"
railway variables set BROWSERLESS_WS_URL="$BROWSERLESS_WS_URL"

# Deploy
echo "🚢 Deploying to Railway..."
railway up

echo "✅ Deployment complete!"
echo "📊 View logs: railway logs"
echo "🌐 Open dashboard: railway open"