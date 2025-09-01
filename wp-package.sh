#!/bin/bash

# Advanced WordPress Plugin Packaging Script
# Uses .wporg-exclude file for precise control over what gets packaged

PLUGIN_NAME="gaincommerce-nmi-payment-gateway-for-woocommerce"
VERSION=$(grep "Version:" gaincommerce-nmi-payment-gateway-for-woocommerce.php | sed 's/.*Version: *\([0-9.]*\).*/\1/')
BUILD_DIR="wp-release"
ZIP_FILE="${PLUGIN_NAME}-${VERSION}.zip"

echo "=============================================="
echo "📦 Packaging WordPress Plugin"
echo "Plugin: $PLUGIN_NAME"
echo "Version: $VERSION"
echo "=============================================="

# Clean previous builds
if [ -d "$BUILD_DIR" ]; then
    echo "🧹 Cleaning previous build..."
    rm -rf "$BUILD_DIR"
fi

if [ -f "$ZIP_FILE" ]; then
    rm -f "$ZIP_FILE"
fi

# Build production assets
if [ -f "package.json" ]; then
    echo "🔧 Building production assets..."
    if command -v npm &> /dev/null; then
        npm run build
    else
        echo "⚠️  npm not found, skipping asset build"
    fi
fi

# Create build directory and copy files
mkdir -p "$BUILD_DIR"
echo "📂 Copying plugin files..."

# Copy all files first
cp -r . "$BUILD_DIR/"

# Remove excluded files/directories based on .wporg-exclude
if [ -f ".wporg-exclude" ]; then
    echo "🚫 Removing excluded files..."
    while IFS= read -r pattern; do
        # Skip comments and empty lines
        [[ "$pattern" =~ ^#.*$ ]] && continue
        [[ -z "$pattern" ]] && continue
        
        # Remove leading slash for find command
        pattern=${pattern#/}
        
        # Remove files/directories matching pattern
        find "$BUILD_DIR" -name "$pattern" -exec rm -rf {} + 2>/dev/null || true
    done < .wporg-exclude
else
    echo "⚠️  .wporg-exclude file not found, using default exclusions"
    # Default exclusions
    rm -rf "$BUILD_DIR/vendor"
    rm -rf "$BUILD_DIR/node_modules"
    rm -rf "$BUILD_DIR/tests"
    rm -rf "$BUILD_DIR/bin"
    rm -rf "$BUILD_DIR/.git"
    rm -f "$BUILD_DIR/composer.json"
    rm -f "$BUILD_DIR/composer.lock"
    rm -f "$BUILD_DIR/package.json"
    rm -f "$BUILD_DIR/.gitignore"
    rm -f "$BUILD_DIR/phpunit.xml"
    rm -f "$BUILD_DIR/webpack.config.js"
fi

# Additional cleanup
echo "🧽 Final cleanup..."
find "$BUILD_DIR" -name ".DS_Store" -delete 2>/dev/null || true
find "$BUILD_DIR" -name "Thumbs.db" -delete 2>/dev/null || true
find "$BUILD_DIR" -name "*.log" -delete 2>/dev/null || true
find "$BUILD_DIR" -name "*.map" -delete 2>/dev/null || true

# Validate required files
echo "✅ Validating package..."
required_files=("gaincommerce-nmi-payment-gateway-for-woocommerce.php" "readme.txt")
for file in "${required_files[@]}"; do
    if [ ! -f "$BUILD_DIR/$file" ]; then
        echo "❌ ERROR: Required file $file is missing!"
        exit 1
    fi
done

# Create zip package
echo "📦 Creating zip package..."
cd "$BUILD_DIR"
zip -r "../$ZIP_FILE" . -x "*.git*" "*.svn*"
cd ..

# Package information
echo "=============================================="
echo "✅ Package created successfully!"
echo "📄 File: $ZIP_FILE"
echo "📏 Size: $(du -h "$ZIP_FILE" | cut -f1)"
echo "📊 Files: $(unzip -l "$ZIP_FILE" | grep -c "^  ")"
echo ""
echo "🔍 Package contents preview:"
unzip -l "$ZIP_FILE" | head -15
echo "   ... (truncated)"
echo ""
echo "🚀 Next steps:"
echo "   1. Test install: wp plugin install $ZIP_FILE --activate"
echo "   2. Upload to WordPress.org plugin repository"
echo "   3. Follow WordPress plugin review guidelines"
echo "=============================================="

# Optional: Open file location
if command -v nautilus &> /dev/null; then
    echo "📂 Opening file location..."
    nautilus . &
fi
