# WordPress Unit Testing Scripts

This directory contains scripts for setting up and running WordPress unit tests using the standard WordPress testing framework.

## Scripts

### 1. `install-wp-tests.sh`
The standard WordPress test installation script that downloads and sets up the WordPress testing framework.

**Usage:**
```bash
bin/install-wp-tests.sh <db-name> <db-user> <db-pass> [db-host] [wp-version] [skip-database-creation]
```

**Example:**
```bash
bin/install-wp-tests.sh wordpress_test root '' localhost latest
```

### 2. `setup-wp-tests.sh`
An interactive helper script that makes it easier to set up the WordPress test environment.

**Usage:**
```bash
bin/setup-wp-tests.sh [OPTIONS]
```

**Options:**
- `--db-name NAME` - Database name (default: wordpress_test)
- `--db-user USER` - Database user (default: root)
- `--db-pass PASS` - Database password (default: empty)
- `--db-host HOST` - Database host (default: localhost)
- `--wp-version VER` - WordPress version (default: latest)

**Examples:**
```bash
bin/setup-wp-tests.sh                           # Use default settings
bin/setup-wp-tests.sh --db-pass mypass          # Set database password
bin/setup-wp-tests.sh --db-name wp_test --wp-version 5.8  # Custom settings
```

### 3. `run-wp-tests.sh`
A test runner script that executes PHPUnit tests with various options.

**Usage:**
```bash
bin/run-wp-tests.sh [OPTIONS]
```

**Options:**
- `-c, --config FILE` - Specify PHPUnit configuration file (default: phpunit.xml)
- `-f, --filter PATTERN` - Run only tests matching the given pattern
- `--coverage` - Generate code coverage report
- `-h, --help` - Display help message

**Examples:**
```bash
bin/run-wp-tests.sh                        # Run all tests
bin/run-wp-tests.sh --filter TestGateway   # Run tests matching 'TestGateway'
bin/run-wp-tests.sh --coverage            # Run tests with coverage report
```

## Composer Scripts

You can also use the convenient Composer scripts defined in `composer.json`:

```bash
composer test                    # Run all tests
composer test:coverage           # Run tests with coverage
composer install-wp-tests       # Set up test environment
```

## Quick Start

1. **First-time setup:**
   ```bash
   # Interactive setup (recommended)
   bin/setup-wp-tests.sh
   
   # Or manual setup
   bin/install-wp-tests.sh wordpress_test root '' localhost latest
   ```

2. **Run tests:**
   ```bash
   # Using Composer
   composer test
   
   # Or directly
   bin/run-wp-tests.sh
   ```

3. **Run specific tests:**
   ```bash
   bin/run-wp-tests.sh --filter TestGateway
   ```

4. **Generate coverage report:**
   ```bash
   bin/run-wp-tests.sh --coverage
   ```

## Prerequisites

- PHP 7.4 or higher
- MySQL/MariaDB
- Composer dependencies installed (`composer install`)
- Subversion (for downloading WordPress test files)

## Environment Variables

The scripts respect the following environment variables:

- `WP_TESTS_DIR` - WordPress tests directory (default: /tmp/wordpress-tests-lib)
- `WP_CORE_DIR` - WordPress core directory (default: /tmp/wordpress/)

## Troubleshooting

### Common Issues

1. **MySQL connection errors**: Make sure your database credentials are correct and the MySQL service is running.

2. **Permission errors**: Ensure the scripts are executable:
   ```bash
   chmod +x bin/*.sh
   ```

3. **Missing dependencies**: Run `composer install` to install PHPUnit and other dependencies.

4. **WordPress tests not found**: The scripts will automatically download the WordPress testing framework, but you need an internet connection and subversion installed.

### Database Setup

Make sure you have the necessary permissions to create databases. If you're using a restrictive MySQL setup, you might need to create the test database manually:

```sql
CREATE DATABASE wordpress_test;
GRANT ALL PRIVILEGES ON wordpress_test.* TO 'your_user'@'localhost';
```

## Integration with CI/CD

These scripts are designed to work well with continuous integration systems. Example GitHub Actions workflow:

```yaml
- name: Setup WordPress tests
  run: bin/install-wp-tests.sh wordpress_test root root localhost latest

- name: Run tests
  run: bin/run-wp-tests.sh
```
