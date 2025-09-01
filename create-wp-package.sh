#!/bin/bash

# Simple WordPress Plugin Packager
# Creates a clean WordPress plugin package for repository submission

PLUGIN_NAME="gaincommerce-nmi-payment-gateway-for-woocommerce"
VERSION=$(grep "Version:" gaincommerce-nmi-payment-gateway-for-woocommerce.php | sed 's/.*Version: *\([0-9.]*\).*/\1/')
BUILD_DIR="wp-dist"
ZIP_FILE="${PLUGIN_NAME}-${VERSION}.zip"

echo "=============================================="
echo "📦 Creating WordPress Plugin Package"
echo "Plugin: $PLUGIN_NAME"
echo "Version: $VERSION"
echo "=============================================="

# Clean previous builds
rm -rf "$BUILD_DIR" "$ZIP_FILE"

# Ensure production-only Composer dependencies
if [ -f "composer.json" ] && command -v composer &> /dev/null; then
    echo "🔧 Installing production dependencies..."
    composer install --no-dev --optimize-autoloader --quiet
fi

# Build production assets
if [ -f "package.json" ] && command -v npm &> /dev/null; then
    echo "🔧 Building production assets..."
    npm run build
fi

# Create package directory
mkdir -p "$BUILD_DIR"

echo "📂 Copying essential files..."

# Copy main plugin file
cp gaincommerce-nmi-payment-gateway-for-woocommerce.php "$BUILD_DIR/"

# Copy WordPress readme
cp readme.txt "$BUILD_DIR/"

# Copy license
cp LICENSE "$BUILD_DIR/"

# Copy core directories
echo "   → Core source files..."
cp -r src/ "$BUILD_DIR/"

echo "   → Includes directory..."
cp -r includes/ "$BUILD_DIR/"

echo "   → Templates..."
cp -r template/ "$BUILD_DIR/"

echo "   → Assets (CSS/JS)..."
cp -r assets/ "$BUILD_DIR/"

echo "   → Composer autoloader (production only)..."
cp -r vendor/ "$BUILD_DIR/"

echo "   → Language files..."
if [ -d "languages" ]; then
    cp -r languages/ "$BUILD_DIR/"
fi

# Copy other essential files
if [ -f "define.php" ]; then
    cp define.php "$BUILD_DIR/"
fi

if [ -f "enqueue-scripts.php" ]; then
    cp enqueue-scripts.php "$BUILD_DIR/"
fi

# Copy composer.json (required when vendor folder is present)
if [ -f "composer.json" ]; then
    cp composer.json "$BUILD_DIR/"
    echo "   → Composer configuration..."
fi

# Remove development files from assets
echo "🧹 Cleaning development files..."
find "$BUILD_DIR" -name "*.map" -delete
find "$BUILD_DIR" -name "*.scss" -delete
find "$BUILD_DIR" -name ".DS_Store" -delete
find "$BUILD_DIR" -name "Thumbs.db" -delete
find "$BUILD_DIR" -name "*.log" -delete

# Create zip
echo "📦 Creating zip package..."
cd "$BUILD_DIR"
zip -r "../$ZIP_FILE" . -q
cd ..

# Package info
FILE_SIZE=$(du -h "$ZIP_FILE" | cut -f1)
FILE_COUNT=$(unzip -l "$ZIP_FILE" | grep -c "^  ")

# Clean up build directory
echo "🧹 Cleaning up build directory..."
rm -rf "$BUILD_DIR"

echo "=============================================="
echo "✅ WordPress Plugin Package Ready!"
echo "📄 File: $ZIP_FILE"
echo "📏 Size: $FILE_SIZE"
echo "📊 Files: $FILE_COUNT"
echo ""
echo "📋 Package contents:"
unzip -l "$ZIP_FILE" | head -20
echo ""
echo "🚀 Ready for WordPress.org submission!"
echo "=============================================="
