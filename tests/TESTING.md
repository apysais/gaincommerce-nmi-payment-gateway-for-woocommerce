# Gain Commerce NMI Payment Gateway for WooCommerce - Testing Guide

This guide explains how to set up and run tests for the Gain Commerce NMI Payment Gateway for WooCommerce plugin using WordPress standard testing practices.

## 🚀 Quick Start

### First Time Setup
```bash
# Interactive setup (recommended)
bin/setup-wp-tests.sh

# Or use Composer
composer install-wp-tests
```

### Run Tests
```bash
# Simple - run all tests
composer test

# Advanced - run with options
bin/run-wp-tests.sh
bin/run-wp-tests.sh --filter TestSample
bin/run-wp-tests.sh --coverage
```

## 📋 Testing Environments

### 1. WordPress Test Suite (Recommended)
- ✅ **Safe**: Uses isolated test database
- ✅ **Fast**: Optimized for unit testing
- ✅ **CI/CD Ready**: Perfect for automation
- ✅ **Standard**: Follows WordPress testing conventions

### 2. Real Database Testing (Advanced)
- ⚠️ **Caution**: Uses your actual WordPress database
- 🔧 **Integration**: Good for testing with real data
- 💾 **Backup Required**: Always backup before running

## 🛠 Available Commands

### Bin Scripts (New!)

| Command | Purpose |
|---------|---------|
| `bin/setup-wp-tests.sh` | Interactive test environment setup |
| `bin/install-wp-tests.sh` | Manual test environment setup |
| `bin/run-wp-tests.sh` | Advanced test runner with options |

### Composer Scripts

| Command | Purpose |
|---------|---------|
| `composer test` | Run all tests |
| `composer test:coverage` | Run tests with coverage report |
| `composer install-wp-tests` | Set up test environment |

### Direct PHPUnit Commands

| Command | Purpose | Database |
|---------|---------|----------|
| `./vendor/bin/phpunit -c phpunit.xml` | WordPress test suite | Isolated |
| `./vendor/bin/phpunit -c phpunit-real.xml` | Real database tests | Live data |

## 📁 Configuration Files

| File | Purpose | Database Used |
|------|---------|---------------|
| `phpunit.xml` | WordPress test suite config | Isolated test database |
| `phpunit-real.xml` | Real database config | Your actual WordPress database |
| `bin/README.md` | Detailed bin scripts documentation | N/A |

## 🧪 Test Files Structure

| File | Type | Extends | Purpose |
|------|------|---------|---------|
| `test-sample.php` | Unit Test | `WP_UnitTestCase` | WordPress standard tests |
| `TestSample.php` | Unit Test | `WP_UnitTestCase` | Legacy test format |
| `TestRealDatabase.php` | Integration | `PHPUnit\Framework\TestCase` | Real database tests |
| `test-function.php` | Helper | N/A | Test utility functions |

## 🔧 Setup Instructions

### Option 1: Interactive Setup (Recommended)
```bash
bin/setup-wp-tests.sh
```
Follow the prompts to configure your test environment.

### Option 2: Manual Setup
```bash
bin/install-wp-tests.sh <db-name> <db-user> <db-pass> [db-host] [wp-version]
```

**Example:**
```bash
bin/install-wp-tests.sh wordpress_test root '' localhost latest
```

### Option 3: Using Environment Variables
```bash
export WP_TESTS_DIR=/tmp/wordpress-tests-lib
export WP_CORE_DIR=/tmp/wordpress/
bin/install-wp-tests.sh wordpress_test root '' localhost latest
```

## 🎯 Common Testing Scenarios

### Development Testing (Daily Use)
```bash
# Run all tests
composer test

# Run specific test class
bin/run-wp-tests.sh --filter TestSample

# Run specific test method
bin/run-wp-tests.sh --filter test_sample_assertion
```

### Code Coverage Analysis
```bash
# Generate HTML coverage report
bin/run-wp-tests.sh --coverage

# View coverage report
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
```

### CI/CD Integration
```bash
# GitHub Actions example
bin/install-wp-tests.sh wordpress_test root root localhost latest
bin/run-wp-tests.sh
```

### Real Database Testing (Advanced)
```bash
# ⚠️ BACKUP YOUR DATABASE FIRST!
./vendor/bin/phpunit -c phpunit-real.xml
```

## 🧩 Writing Tests

### WordPress Standard Test (Recommended)
```php
<?php
class Test_My_Feature extends WP_UnitTestCase {
    public function test_my_functionality() {
        $this->assertTrue(true);
    }
}
```

### Legacy Test Format (Supported)
```php
<?php
class TestMyFeature extends WP_UnitTestCase {
    public function test_my_functionality() {
        $this->assertTrue(true);
    }
}
```

## 🔍 Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `WP_TESTS_DIR` | `/tmp/wordpress-tests-lib` | WordPress test library location |
| `WP_CORE_DIR` | `/tmp/wordpress/` | WordPress core installation |

### Permanent Setup
Add to your `~/.bashrc` or `~/.zshrc`:
```bash
export WP_TESTS_DIR=/tmp/wordpress-tests-lib
export WP_CORE_DIR=/tmp/wordpress/
```

## 📊 Test Output Examples

### Successful Test Run
```
Running WordPress Unit Tests...
PHPUnit 9.6.25 by Sebastian Bergmann and contributors.

....                                4 / 4 (100%)

Time: 00:00.015, Memory: 38.50 MB
OK (4 tests, 7 assertions)
✓ All tests passed!
```

### Filtered Test Run
```bash
bin/run-wp-tests.sh --filter test_wordpress_is_loaded
# Runs only tests matching 'test_wordpress_is_loaded'
```

## � Troubleshooting

### WordPress Test Suite Issues

**Error: "Could not find wordpress-tests-lib"**
```bash
# Solution: Set up test environment
bin/setup-wp-tests.sh
```

**Error: "MySQL connection failed"**
```bash
# Solution: Check database credentials
bin/install-wp-tests.sh wordpress_test your_user your_password localhost latest
```

**Error: "No tests executed"**
```bash
# Solution: Check test file naming
# Files should start with 'test-' or contain test classes
ls tests/test-*.php
```

### Real Database Issues

**Error: "Cannot load wp-load.php"**
```bash
# Solution: Check WordPress path in bootstrap-real.php
# Ensure path points to your WordPress installation
```

**Error: "Database connection failed"**
```bash
# Solution: Verify WordPress database configuration
# Check wp-config.php settings
```

### PHPUnit Issues

**Error: "PHPUnit not found"**
```bash
# Solution: Install dependencies
composer install
```

**Warning: "XML configuration deprecated"**
```bash
# Solution: Migrate configuration (optional)
./vendor/bin/phpunit --migrate-configuration
```

## 💡 Best Practices

### ✅ Do's
- ✅ Use `composer test` for everyday development
- ✅ Use bin scripts for advanced testing scenarios
- ✅ Write tests for all new features
- ✅ Test both success and failure scenarios
- ✅ Use descriptive test method names
- ✅ Run tests before committing code

### ❌ Don'ts
- ❌ Don't run real database tests without backups
- ❌ Don't commit test database files
- ❌ Don't skip tests in CI/CD pipelines
- ❌ Don't test live payment processing in unit tests
- ❌ Don't hardcode sensitive data in tests

## 🔗 Additional Resources

- **WordPress Testing Handbook**: [make.wordpress.org/core/handbook/testing](https://make.wordpress.org/core/handbook/testing/)
- **PHPUnit Documentation**: [phpunit.de](https://phpunit.de)
- **WP_UnitTestCase Reference**: [core.trac.wordpress.org](https://core.trac.wordpress.org)
- **Bin Scripts Documentation**: `bin/README.md`

## 📝 Test Coverage

Current test coverage includes:
- ✅ WordPress environment loading
- ✅ Plugin class initialization
- ✅ Basic functionality assertions
- ✅ Sample payment gateway tests

### Adding New Tests

1. Create test file: `tests/test-your-feature.php`
2. Extend `WP_UnitTestCase`
3. Write test methods starting with `test_`
4. Run tests to verify: `composer test`

---

**Last Updated**: August 27, 2025  
**WordPress Version**: 6.8+  
**PHPUnit Version**: 9.6+  
**Plugin Version**: 1.7.5
