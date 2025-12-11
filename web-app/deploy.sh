#!/bin/bash

# Enterprise Auth Demo - Azure Deployment Script
# This script deploys the web application to Azure App Service

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
RESOURCE_GROUP="enterprise-auth-rg"
APP_NAME="enterprise-auth-demo-web"
LOCATION="uksouth"

echo -e "${GREEN}🚀 Enterprise Auth Demo - Azure Deployment${NC}"
echo "============================================"
echo ""

# Create deployment package
echo -e "${GREEN}📦 Creating deployment package...${NC}"
rm -f deploy.zip
zip -r deploy.zip . \
    -x "*.git*" \
    -x "*.env" \
    -x "*.env.*" \
    -x "node_modules/*" \
    -x ".vscode/*" \
    -x "*.log" \
    -x "*.md" \
    -x "deploy.sh" \
    -x "deploy.tar.gz" \
    -x "deploy.zip"

# Deploy using ZIP deployment
echo -e "${GREEN}📤 Deploying to Azure...${NC}"
az webapp deployment source config-zip \
    --name $APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --src deploy.zip

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo "🌐 App URL: https://$APP_NAME.azurewebsites.net"
echo ""
