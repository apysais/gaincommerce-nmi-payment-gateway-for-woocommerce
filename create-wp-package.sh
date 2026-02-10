#!/bin/bash

# WordPress Plugin Packager for Production Deployment
# Creates a clean WordPress plugin package for repository submission via SVN
# Excludes development files, tests, documentation, and build artifacts

# Exit on any error
set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Plugin configuration
PLUGIN_NAME="gaincommerce-nmi-payment-gateway-for-woocommerce"
MAIN_FILE="gaincommerce-nmi-payment-gateway-for-woocommerce.php"
BUILD_DIR="wp-dist"

# Helper functions
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Pre-flight validation checks
echo "=============================================="
echo "📦 WordPress Plugin Packager"
echo "=============================================="

print_info "Running pre-flight checks..."

# Check required files exist
if [ ! -f "$MAIN_FILE" ]; then
    print_error "Main plugin file not found: $MAIN_FILE"
    exit 1
fi

if [ ! -f "readme.txt" ]; then
    print_error "WordPress readme.txt not found"
    exit 1
fi

if [ ! -f "composer.json" ]; then
    print_warning "composer.json not found"
fi

if [ ! -f "package.json" ]; then
    print_warning "package.json not found"
fi

print_success "Required files found"

# Extract version from main plugin file
VERSION=$(grep "Version:" "$MAIN_FILE" | sed 's/.*Version: *\([0-9.]*\).*/\1/')
if [ -z "$VERSION" ]; then
    print_error "Could not extract version from $MAIN_FILE"
    exit 1
fi

ZIP_FILE="${PLUGIN_NAME}-${VERSION}.zip"

echo ""
echo "Plugin: $PLUGIN_NAME"
echo "Version: $VERSION"
echo "Output: $ZIP_FILE"
echo "=============================================="
echo ""

# Clean previous builds
if [ -f "$ZIP_FILE" ]; then
    print_info "Removing previous package: $ZIP_FILE"
    rm -f "$ZIP_FILE"
fi

if [ -d "$BUILD_DIR" ]; then
    print_info "Removing previous build directory: $BUILD_DIR"
    rm -rf "$BUILD_DIR"
fi

# Install production-only Composer dependencies
if [ -f "composer.json" ] && command -v composer &> /dev/null; then
    print_info "Installing production Composer dependencies..."
    if composer install --no-dev --optimize-autoloader --quiet; then
        print_success "Composer dependencies installed"
        
        # Verify vendor autoload exists
        if [ ! -f "vendor/autoload.php" ]; then
            print_error "Composer autoloader not found after installation"
            exit 1
        fi
    else
        print_error "Composer install failed"
        exit 1
    fi
elif [ -f "composer.json" ]; then
    print_warning "Composer not found, skipping dependency installation"
fi

# Build production assets with npm
if [ -f "package.json" ] && command -v npm &> /dev/null; then
    print_info "Building production assets with npm..."
    if npm run build --silent; then
        print_success "Production assets built successfully"
        
        # Verify built assets exist (if using webpack/wp-scripts)
        if [ -d "assets/js/build" ]; then
            BUILT_FILES=$(find assets/js/build -type f -name "*.js" | wc -l)
            if [ "$BUILT_FILES" -gt 0 ]; then
                print_success "Found $BUILT_FILES built JavaScript file(s)"
            else
                print_warning "No built JavaScript files found in assets/js/build"
            fi
        fi
    else
        print_error "npm build failed"
        exit 1
    fi
elif [ -f "package.json" ]; then
    print_warning "npm not found, skipping asset build"
fi

# Create package directory
echo ""
print_info "Creating clean package directory..."
mkdir -p "$BUILD_DIR"

# Copy essential files
echo ""
print_info "Copying production files..."

# Main plugin file
cp "$MAIN_FILE" "$BUILD_DIR/"
print_success "Main plugin file"

# WordPress readme
cp readme.txt "$BUILD_DIR/"
print_success "WordPress readme"

# License
if [ -f "LICENSE" ]; then
    cp LICENSE "$BUILD_DIR/"
    print_success "License file"
fi

# Core directories
if [ -d "src" ]; then
    cp -r src/ "$BUILD_DIR/"
    print_success "Source files (src/)"
fi

if [ -d "includes" ]; then
    cp -r includes/ "$BUILD_DIR/"
    print_success "Includes directory"
fi

if [ -d "template" ]; then
    cp -r template/ "$BUILD_DIR/"
    print_success "Template files"
fi

if [ -d "assets" ]; then
    cp -r assets/ "$BUILD_DIR/"
    print_success "Assets (CSS/JS)"
fi

if [ -d "vendor" ]; then
    cp -r vendor/ "$BUILD_DIR/"
    print_success "Composer vendor (production only)"
fi

if [ -d "languages" ]; then
    cp -r languages/ "$BUILD_DIR/"
    print_success "Language files"
fi

# Additional essential files
if [ -f "define.php" ]; then
    cp define.php "$BUILD_DIR/"
    print_success "Plugin definitions (define.php)"
fi

if [ -f "enqueue-scripts.php" ]; then
    cp enqueue-scripts.php "$BUILD_DIR/"
    print_success "Script enqueuing (enqueue-scripts.php)"
fi

# Copy composer.json (required when vendor folder is present)
if [ -f "composer.json" ] && [ -d "vendor" ]; then
    cp composer.json "$BUILD_DIR/"
    print_success "Composer configuration"
fi

# Remove development files and build artifacts
echo ""
print_info "Cleaning development files and build artifacts..."

# Remove Git files
find "$BUILD_DIR" -type d -name ".git" -exec rm -rf {} + 2>/dev/null || true
find "$BUILD_DIR" -type f -name ".gitignore" -delete 2>/dev/null || true
find "$BUILD_DIR" -type f -name ".gitattributes" -delete 2>/dev/null || true
find "$BUILD_DIR" -type d -name ".github" -exec rm -rf {} + 2>/dev/null || true
print_success "Git files removed"

# Remove node_modules (critical - can be hundreds of MB)
find "$BUILD_DIR" -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true
print_success "node_modules removed"

# Remove test directories and files
find "$BUILD_DIR" -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true
find "$BUILD_DIR" -type d -name "test" -exec rm -rf {} + 2>/dev/null || true
find "$BUILD_DIR" -type d -name "__tests__" -exec rm -rf {} + 2>/dev/null || true
find "$BUILD_DIR" -type f -name "phpunit.xml" -delete 2>/dev/null || true
find "$BUILD_DIR" -type f -name "phpunit*.xml" -delete 2>/dev/null || true
find "$BUILD_DIR" -type f -name ".phpunit.*" -delete 2>/dev/null || true
print_success "Test files and directories removed"

# Remove documentation directories
find "$BUILD_DIR" -type d -name "doc" -exec rm -rf {} + 2>/dev/null || true
find "$BUILD_DIR" -type d -name "docs" -exec rm -rf {} + 2>/dev/null || true
find "$BUILD_DIR" -type d -name "documentation" -exec rm -rf {} + 2>/dev/null || true
print_success "Documentation directories removed"

# Remove bin directory (test scripts)
find "$BUILD_DIR" -type d -name "bin" -exec rm -rf {} + 2>/dev/null || true
print_success "Bin directory removed"

# Remove build configuration files
find "$BUILD_DIR" -type f -name "webpack.config.js" -delete 2>/dev/null || true
find "$BUILD_DIR" -type f -name "package.json" -delete 2>/dev/null || true
find "$BUILD_DIR" -type f -name "package-lock.json" -delete 2>/dev/null || true
find "$BUILD_DIR" -type f -name "composer.lock" -delete 2>/dev/null || true
find "$BUILD_DIR" -type f -name ".eslintrc*" -delete 2>/dev/null || true
find "$BUILD_DIR" -type f -name ".prettierrc*" -delete 2>/dev/null || true
find "$BUILD_DIR" -type f -name ".editorconfig" -delete 2>/dev/null || true
find "$BUILD_DIR" -type f -name "tsconfig.json" -delete 2>/dev/null || true
find "$BUILD_DIR" -type f -name "babel.config.js" -delete 2>/dev/null || true
print_success "Build configuration files removed"

# Remove build scripts
find "$BUILD_DIR" -type f -name "create-wp-package.sh" -delete 2>/dev/null || true
find "$BUILD_DIR" -type f -name "build*.sh" -delete 2>/dev/null || true
print_success "Build scripts removed"

# Remove source maps and SCSS files
find "$BUILD_DIR" -type f -name "*.map" -delete
find "$BUILD_DIR" -type f -name "*.scss" -delete
find "$BUILD_DIR" -type f -name "*.sass" -delete
print_success "Source maps and SCSS files removed"

# Remove OS-specific files
find "$BUILD_DIR" -type f -name ".DS_Store" -delete
find "$BUILD_DIR" -type f -name "Thumbs.db" -delete
find "$BUILD_DIR" -type f -name "desktop.ini" -delete
print_success "OS-specific files removed"

# Remove log files
find "$BUILD_DIR" -type f -name "*.log" -delete
find "$BUILD_DIR" -type f -name "npm-debug.log*" -delete
find "$BUILD_DIR" -type f -name "yarn-debug.log*" -delete
find "$BUILD_DIR" -type f -name "yarn-error.log*" -delete
print_success "Log files removed"

# Remove editor files
find "$BUILD_DIR" -type f -name "*.swp" -delete
find "$BUILD_DIR" -type f -name "*.swo" -delete
find "$BUILD_DIR" -type f -name "*~" -delete
print_success "Editor temporary files removed"

# Remove common development markdown files (except in languages/)
find "$BUILD_DIR" -type f -name "README.md" ! -path "*/languages/*" -delete 2>/dev/null || true
find "$BUILD_DIR" -type f -name "CHANGELOG.md" ! -path "*/languages/*" -delete 2>/dev/null || true
find "$BUILD_DIR" -type f -name "CONTRIBUTING.md" ! -path "*/languages/*" -delete 2>/dev/null || true
find "$BUILD_DIR" -type f -name "*.md" ! -path "*/languages/*" ! -name "readme.txt" -delete 2>/dev/null || true
print_success "Development markdown files removed"

# Create zip package
echo ""
print_info "Creating zip package..."
cd "$BUILD_DIR"
if zip -r "../$ZIP_FILE" . -q; then
    cd ..
    print_success "Package created: $ZIP_FILE"
else
    cd ..
    print_error "Failed to create zip package"
    exit 1
fi

# Package validation
echo ""
print_info "Validating package..."

# Check critical files are present
VALIDATION_PASSED=true

unzip -l "$ZIP_FILE" | grep -q "$MAIN_FILE" || { print_error "Main plugin file missing from package"; VALIDATION_PASSED=false; }
unzip -l "$ZIP_FILE" | grep -q "readme.txt" || { print_error "readme.txt missing from package"; VALIDATION_PASSED=false; }

# Check excluded files are NOT present
if unzip -l "$ZIP_FILE" | grep -q "node_modules/"; then
    print_error "node_modules found in package!"
    VALIDATION_PASSED=false
fi

if unzip -l "$ZIP_FILE" | grep -q "\.git/"; then
    print_error ".git directory found in package!"
    VALIDATION_PASSED=false
fi

if unzip -l "$ZIP_FILE" | grep -q "tests/"; then
    print_error "tests directory found in package!"
    VALIDATION_PASSED=false
fi

if unzip -l "$ZIP_FILE" | grep -q "phpunit.xml"; then
    print_error "phpunit.xml found in package!"
    VALIDATION_PASSED=false
fi

if unzip -l "$ZIP_FILE" | grep -q "package.json"; then
    print_error "package.json found in package!"
    VALIDATION_PASSED=false
fi

if [ "$VALIDATION_PASSED" = true ]; then
    print_success "Package validation passed"
else
    print_error "Package validation failed - please review the package contents"
    exit 1
fi

# Package information
FILE_SIZE=$(du -h "$ZIP_FILE" | cut -f1)
FILE_COUNT=$(unzip -l "$ZIP_FILE" | tail -1 | awk '{print $2}')
FILE_SIZE_BYTES=$(stat -f%z "$ZIP_FILE" 2>/dev/null || stat -c%s "$ZIP_FILE" 2>/dev/null)
FILE_SIZE_MB=$((FILE_SIZE_BYTES / 1048576))

# Warn if package is unusually large
if [ "$FILE_SIZE_MB" -gt 5 ]; then
    print_warning "Package size is ${FILE_SIZE_MB}MB - this seems large for a WordPress plugin"
    print_warning "Please verify no large development files were included"
fi

# Clean up build directory
print_info "Cleaning up build directory..."
rm -rf "$BUILD_DIR"
print_success "Build directory removed"

# Final summary
echo ""
echo "=============================================="
print_success "WordPress Plugin Package Ready!"
echo "=============================================="
echo "📄 File: $ZIP_FILE"
echo "📏 Size: $FILE_SIZE"
echo "📊 Files: $FILE_COUNT"
echo ""
echo "📋 Package contents (first 30 entries):"
unzip -l "$ZIP_FILE" | head -33
echo ""
if [ "$FILE_COUNT" -gt 30 ]; then
    echo "... and $((FILE_COUNT - 30)) more files"
    echo ""
fi
print_success "Ready for WordPress.org repository submission via SVN!"
echo "=============================================="
