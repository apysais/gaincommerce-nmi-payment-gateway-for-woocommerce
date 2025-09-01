#!/usr/bin/env bash

# WordPress Test Environment Setup Helper
# This script provides an easy way to set up the WordPress testing environment

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Default values
DB_NAME="wordpress_test"
DB_USER="root"
DB_PASS=""
DB_HOST="localhost"
WP_VERSION="latest"

# Function to display usage
usage() {
    echo "WordPress Test Environment Setup"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --db-name NAME       Database name (default: wordpress_test)"
    echo "  --db-user USER       Database user (default: root)"
    echo "  --db-pass PASS       Database password (default: empty)"
    echo "  --db-host HOST       Database host (default: localhost)"
    echo "  --wp-version VER     WordPress version (default: latest)"
    echo "  -h, --help           Display this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Use default settings"
    echo "  $0 --db-pass mypass                  # Set database password"
    echo "  $0 --db-name wp_test --wp-version 5.8 # Custom DB name and WP version"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --db-name)
            DB_NAME="$2"
            shift 2
            ;;
        --db-user)
            DB_USER="$2"
            shift 2
            ;;
        --db-pass)
            DB_PASS="$2"
            shift 2
            ;;
        --db-host)
            DB_HOST="$2"
            shift 2
            ;;
        --wp-version)
            WP_VERSION="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

echo -e "${BLUE}WordPress Test Environment Setup${NC}"
echo "================================="
echo ""
echo "Configuration:"
echo "  Database Name: $DB_NAME"
echo "  Database User: $DB_USER"
echo "  Database Host: $DB_HOST"
echo "  WordPress Version: $WP_VERSION"
echo ""

# Confirm settings
read -p "Continue with these settings? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup cancelled."
    exit 0
fi

echo -e "${YELLOW}Setting up WordPress test environment...${NC}"
echo ""

# Run the installation script
"$SCRIPT_DIR/install-wp-tests.sh" "$DB_NAME" "$DB_USER" "$DB_PASS" "$DB_HOST" "$WP_VERSION"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ WordPress test environment setup completed!${NC}"
    echo ""
    echo "You can now run tests with:"
    echo "  composer test                    # Run all tests"
    echo "  bin/run-wp-tests.sh             # Run tests directly"
    echo "  bin/run-wp-tests.sh --filter TestName  # Run specific tests"
    echo ""
else
    echo ""
    echo -e "${RED}✗ Setup failed. Please check the error messages above.${NC}"
    exit 1
fi
