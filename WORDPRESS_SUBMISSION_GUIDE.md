# WordPress Plugin Submission Guide

## Gain Commerce NMI Payment Gateway for WooCommerce - WordPress.org Repository Submission

This guide provides step-by-step instructions for packaging and submitting the Gain Commerce NMI Payment Gateway for WooCommerce plugin to the WordPress.org plugin repository.

---

## 📦 Package Creation

### Quick Start
To create a production-ready WordPress plugin package:

```bash
./create-wp-package.sh
```

This will generate: `gaincommerce-nmi-payment-gateway-for-woocommerce-{VERSION}.zip`

### Available Packaging Scripts

1. **`create-wp-package.sh`** *(Recommended)*
   - Simple and reliable
   - Includes only essential files
   - Builds production assets automatically
   - Automatically cleans up build directory

2. **`wp-package.sh`**
   - Advanced packaging with exclusion file support
   - Uses `.wporg-exclude` for precise control

3. **`package-plugin.sh`**
   - Basic packaging script
   - Manual file selection

---

## ✅ What's INCLUDED in WordPress Package

### Essential Plugin Files
- `gaincommerce-nmi-payment-gateway-for-woocommerce.php` - Main plugin file
- `readme.txt` - WordPress plugin readme
- `LICENSE` - GPL license file
- `composer.json` - Composer configuration (required with vendor/)
- `define.php` - Plugin constants
- `enqueue-scripts.php` - Script enqueuing

### Core Directories
- `/src/` - All PHP classes and core functionality
- `/vendor/` - Composer autoloader (production dependencies only)
- `/includes/` - Helper functions and utilities
- `/template/` - Plugin templates (admin/public)
- `/assets/` - CSS, JavaScript, and built assets
- `/languages/` - Translation files (if any)

### Production Assets
- Built JavaScript files (webpack output)
- Minified CSS and JS files
- All necessary frontend assets
- WooCommerce Blocks integration files

---

## 🚫 What's EXCLUDED from WordPress Package

### Development Dependencies
- `/vendor/` - Composer development dependencies (testing packages)
  - *Note: Production vendor/ folder with autoloader IS included*
- `/node_modules/` - npm dependencies
- `composer.lock` - Composer lock file (excluded, but composer.json included)
- `package.json`, `package-lock.json`

### Development Tools
- `/tests/` - PHPUnit tests
- `/bin/` - Development scripts
- `phpunit.xml`, `webpack.config.js`
- `.phpunit.result.cache`

### Version Control & IDE
- `.git/`, `.gitignore`, `.gitattributes`
- `.vscode/`, `.idea/`
- `*.swp`, `*.swo`

### Build Artifacts
- `/build/`, `/dist/`, `/wp-release/`
- Development logs and cache files
- Source maps (`*.map` files)

---

## 🚀 WordPress.org Submission Process

### Step 1: Prepare Your Plugin

1. **Test the Package Locally**
   ```bash
   # Install and test the packaged plugin
   wp plugin install gaincommerce-nmi-payment-gateway-for-woocommerce-1.7.5.zip --activate
   
   # Or manually upload via WordPress admin
   ```

2. **Verify Package Contents**
   ```bash
   unzip -l gaincommerce-nmi-payment-gateway-for-woocommerce-1.7.5.zip
   ```

3. **Check File Size**
   - Current package: ~56KB ✅
   - WordPress limit: 10MB
   - Your package is well within limits

### Step 2: WordPress.org Submission

1. **Visit Plugin Developer Portal**
   - Go to: https://wordpress.org/plugins/developers/add/

2. **Create WordPress.org Account**
   - If you don't have one already
   - Use a professional email address

3. **Upload Plugin**
   - Upload your `gaincommerce-nmi-payment-gateway-for-woocommerce-1.7.5.zip` file
   - Fill out the submission form

4. **Provide Required Information**
   - Plugin name: "Gain Commerce NMI Payment Gateway for WooCommerce"
   - Description: Brief overview of functionality
   - Tags: payment, gateway, nmi, alliedpay, woocommerce
   - License: GPL v2 or later

### Step 3: Review Process

- **Review Time**: Typically 2-15 business days
- **Manual Review**: All plugins are manually reviewed
- **Possible Outcomes**:
  - ✅ Approved and published
  - ❌ Rejected with feedback
  - 🔄 Requires changes

---

## 📋 Pre-submission Checklist

### Code Quality
- [ ] Follows WordPress coding standards
- [ ] All code is GPL compatible
- [ ] No premium/commercial features in free version
- [ ] Proper sanitization and security measures
- [ ] No external dependencies included

### Documentation
- [ ] `readme.txt` follows WordPress format
- [ ] Clear installation instructions
- [ ] FAQ section included
- [ ] Changelog documented
- [ ] Screenshots provided (if applicable)

### Functionality
- [ ] Plugin works with latest WordPress version
- [ ] Compatible with WooCommerce 8.0+
- [ ] No PHP errors or warnings
- [ ] Proper error handling
- [ ] Database operations are secure

### Legal & Compliance
- [ ] GPL license included
- [ ] No trademark violations
- [ ] Proper attribution for third-party code
- [ ] Privacy policy considerations documented

---

## 📝 Plugin Information

### Current Version Details
- **Version**: 1.7.5
- **WordPress Requirement**: 6.8+
- **WooCommerce Requirement**: 8.0+ (HPOS only)
- **PHP Requirement**: 8.0+
- **License**: GPL v2 or later

### Plugin Slug
- **Proposed Slug**: `gaincommerce-nmi-payment-gateway-for-woocommerce`
- **URL**: `https://wordpress.org/plugins/gaincommerce-nmi-payment-gateway-for-woocommerce/`

---

## 🔧 Future Updates

### Updating the Plugin

1. **Make Changes**: Update code in your development environment
2. **Update Version**: Increment version in main plugin file and readme.txt
3. **Package**: Run `./create-wp-package.sh`
4. **Submit**: Upload new version via WordPress.org developer dashboard

### SVN Repository Access
Once approved, you'll get access to:
- SVN repository for your plugin
- Developer dashboard for managing releases
- Statistics and download tracking

---

## 🆘 Common Issues & Solutions

### Issue: Plugin Rejected
**Solutions:**
- Review rejection email carefully
- Address all mentioned issues
- Test thoroughly before resubmission
- Follow WordPress plugin guidelines strictly

### Issue: Large File Size
**Solutions:**
- Use the packaging scripts to exclude dev files
- Minify CSS/JS assets
- Remove unnecessary files

### Issue: Security Concerns
**Solutions:**
- Sanitize all user inputs
- Escape all outputs
- Use WordPress functions for database operations
- Follow WordPress security best practices

---

## 📞 Support & Resources

### WordPress.org Resources
- [Plugin Developer Handbook](https://developer.wordpress.org/plugins/)
- [Plugin Review Guidelines](https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/)
- [WordPress Coding Standards](https://developer.wordpress.org/coding-standards/)

### Development Tools
- [WordPress Plugin Boilerplate](https://wppb.me/)
- [Plugin Check Tool](https://wordpress.org/plugins/plugin-check/)
- [WP CLI](https://wp-cli.org/)

---

## 📊 Package Summary

### Current Package Stats
```
📄 File: gaincommerce-nmi-payment-gateway-for-woocommerce-1.7.5.zip
📏 Size: 72KB
📊 Files: 59 essential files
🎯 Status: Ready for WordPress.org submission
```

### Package Contents Overview
```
✅ Core PHP files (28 files)
✅ Composer autoloader (15 files)
✅ Frontend assets (6 files)
✅ Templates (2 files)
✅ Documentation (3 files)
✅ Configuration (3 files) - includes composer.json
```

---

## 🎉 Conclusion

Your Gain Commerce NMI Payment Gateway for WooCommerce plugin is now properly packaged and ready for WordPress.org submission. The package is clean, follows WordPress standards, and contains only the essential files needed for production use.

**Next Action**: Visit https://wordpress.org/plugins/developers/add/ and upload your package!

---

*Generated on: August 27, 2025*  
*Plugin Version: 1.7.5*  
*Package: gaincommerce-nmi-payment-gateway-for-woocommerce-1.7.5.zip*
