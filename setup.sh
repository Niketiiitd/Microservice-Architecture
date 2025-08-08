#!/bin/bash

# Microservice Development Setup Script
echo "🚀 Setting up Microservice Architecture Development Environment"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js (v16 or higher)"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "⚠️  Docker is not installed. Docker is optional but recommended for deployment"
fi

echo "✅ Prerequisites check completed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating environment file..."
    cp .env.example .env
    echo "⚠️  Please update the .env file with your actual configuration values"
fi

echo "🎉 Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Update the .env file with your configuration"
echo "2. Start MongoDB (if using local instance)"
echo "3. Run 'npm run start:all' to start all services"
echo ""
echo "Available commands:"
echo "- npm run start:all     # Start all services"
echo "- npm run start:auth    # Start auth service (port 3002)"
echo "- npm run start:user    # Start user service (port 3004)"
echo "- npm run start:admin   # Start admin service (port 3001)"
echo "- npm run start:static  # Start static service (port 3003)"
