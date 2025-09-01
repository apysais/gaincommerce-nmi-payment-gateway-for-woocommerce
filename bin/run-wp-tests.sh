#!/usr/bin/env bash

# WordPress Unit Test Runner Script
# This script runs PHPUnit tests for WordPress plugins using the standard WordPress testing framework

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PLUGIN_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
PHPUNIT_CONFIG="$PLUGIN_DIR/phpunit.xml"
TEST_DIR="$PLUGIN_DIR/tests"
COVERAGE=false
FILTER=""

# Function to display usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -c, --config FILE     Specify PHPUnit configuration file (default: phpunit.xml)"
    echo "  -f, --filter PATTERN  Run only tests matching the given pattern"
    echo "  --coverage           Generate code coverage report"
    echo "  -h, --help           Display this help message"
    echo ""
    echo "Examples:"
    echo "  $0                           # Run all tests"
    echo "  $0 --filter TestGateway      # Run tests matching 'TestGateway'"
    echo "  $0 --coverage               # Run tests with coverage report"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -c|--config)
            PHPUNIT_CONFIG="$2"
            shift 2
            ;;
        -f|--filter)
            FILTER="$2"
            shift 2
            ;;
        --coverage)
            COVERAGE=true
            shift
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

# Check if WordPress test environment is set up
if [ ! -d "/tmp/wordpress-tests-lib" ]; then
    echo -e "${YELLOW}Warning: WordPress test environment not found.${NC}"
    echo "Please run the following command to set up the test environment:"
    echo ""
    echo "  bin/install-wp-tests.sh <db-name> <db-user> <db-pass> [db-host] [wp-version]"
    echo ""
    echo "Example:"
    echo "  bin/install-wp-tests.sh wordpress_test root '' localhost latest"
    echo ""
    exit 1
fi

# Check if PHPUnit configuration exists
if [ ! -f "$PHPUNIT_CONFIG" ]; then
    echo -e "${RED}Error: PHPUnit configuration file not found: $PHPUNIT_CONFIG${NC}"
    exit 1
fi

# Check if test directory exists
if [ ! -d "$TEST_DIR" ]; then
    echo -e "${RED}Error: Test directory not found: $TEST_DIR${NC}"
    exit 1
fi

# Build PHPUnit command
PHPUNIT_CMD="$PLUGIN_DIR/vendor/bin/phpunit"

# Check if PHPUnit is installed
if [ ! -f "$PHPUNIT_CMD" ]; then
    echo -e "${RED}Error: PHPUnit not found. Please run 'composer install' first.${NC}"
    exit 1
fi

# Build command arguments
ARGS="--configuration=$PHPUNIT_CONFIG"

if [ ! -z "$FILTER" ]; then
    ARGS="$ARGS --filter=$FILTER"
fi

if [ "$COVERAGE" = true ]; then
    ARGS="$ARGS --coverage-html=coverage"
    echo -e "${YELLOW}Code coverage report will be generated in 'coverage' directory${NC}"
fi

# Change to plugin directory
cd "$PLUGIN_DIR"

echo -e "${GREEN}Running WordPress Unit Tests...${NC}"
echo "Configuration: $PHPUNIT_CONFIG"
echo "Test Directory: $TEST_DIR"
if [ ! -z "$FILTER" ]; then
    echo "Filter: $FILTER"
fi
echo ""

# Run PHPUnit
$PHPUNIT_CMD $ARGS

# Capture exit code
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
else
    echo -e "${RED}✗ Some tests failed (exit code: $EXIT_CODE)${NC}"
fi

exit $EXIT_CODE
