#!/bin/bash

# Deployment script for Azure App Service
# This script is run by Kudu during deployment

# Exit on error
set -e

echo "Starting deployment..."

# Install production dependencies
echo "Installing Node.js dependencies..."
npm install --production

echo "Deployment script completed successfully!"
