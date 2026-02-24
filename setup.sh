#!/bin/bash

# Accounting Assistant Bot - Setup Script
# This script helps set up the backend for the first time

echo "╔════════════════════════════════════════════════════════╗"
echo "║  Accounting Assistant Bot - Backend Setup              ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16 or higher."
    exit 1
fi

echo "✓ Node.js $(node -v) detected"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm."
    exit 1
fi

echo "✓ npm $(npm -v) detected"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✓ Dependencies installed"

# Check if .env exists
echo ""
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✓ .env file created"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env file with your configuration:"
    echo "   - Database credentials"
    echo "   - OpenAI API key"
    echo "   - CORS origin (your website URL)"
    echo "   - Admin API key"
else
    echo "✓ .env file already exists"
fi

# Check MySQL connection
echo ""
echo "🔍 Checking MySQL connection..."

# Try to connect to MySQL (this is a simple check)
if command -v mysql &> /dev/null; then
    read -p "Enter MySQL host (default: localhost): " db_host
    db_host=${db_host:-localhost}
    
    read -p "Enter MySQL user (default: root): " db_user
    db_user=${db_user:-root}
    
    read -sp "Enter MySQL password: " db_password
    echo ""
    
    mysql -h "$db_host" -u "$db_user" -p"$db_password" -e "SELECT 1" > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo "✓ MySQL connection successful"
        
        read -p "Enter database name (default: accounting_bot): " db_name
        db_name=${db_name:-accounting_bot}
        
        echo ""
        echo "📊 Creating database and tables..."
        mysql -h "$db_host" -u "$db_user" -p"$db_password" -e "CREATE DATABASE IF NOT EXISTS $db_name;"
        
        if [ $? -eq 0 ]; then
            echo "✓ Database created"
            
            mysql -h "$db_host" -u "$db_user" -p"$db_password" "$db_name" < src/db/schema.sql
            
            if [ $? -eq 0 ]; then
                echo "✓ Tables created successfully"
            else
                echo "❌ Failed to create tables"
                exit 1
            fi
        else
            echo "❌ Failed to create database"
            exit 1
        fi
    else
        echo "❌ MySQL connection failed"
        echo "Please ensure MySQL is running and credentials are correct"
        exit 1
    fi
else
    echo "⚠️  MySQL client not found. Please run the following manually:"
    echo "   mysql -u root -p < src/db/schema.sql"
fi

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║  Setup Complete!                                       ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration"
echo "2. Run: npm start (or npm run dev for development)"
echo "3. Visit: http://localhost:3000"
echo ""
echo "For more information, see README.md"
