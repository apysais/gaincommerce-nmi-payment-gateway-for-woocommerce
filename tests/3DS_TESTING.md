# 3DS Unit Tests - How to Run

This document explains how to run the 3DS (3-D Secure) unit tests for the NMI payment gateway plugins.

## Test Files Created

### Free Plugin Tests
**Location:** `tests/TestThreeDSFlow.php`

Tests for:
- 3DS data extraction from both legacy and block checkouts
- Type validation (filtering out null, arrays, objects)
- Handling of invalid/missing 3DS fields
- Integration with Gateway class
- Support for both new cards and saved cards (customer vault)

### Premium Plugin Tests
**Location:** `../gaincommerce-nmi-enterprise/src/Test/Test_ThreeDS_Premium_Integration.php`

Tests for:
- ThreeDS_Settings (enable/disable, failure actions)
- ThreeDS_PayloadData (adding 3DS to NMI API requests)
- ThreeDS_Response_Handler (logging NMI 3DS responses)
- Type validation in premium plugin
- Order notes and meta data storage

## Prerequisites

1. **WordPress Test Library** must be installed:
   ```bash
   bash bin/install-wp-tests.sh wordpress_test root '' localhost latest
   ```

2. **PHPUnit** must be available (installed via Composer):
   ```bash
   composer require --dev phpunit/phpunit
   ```

3. **WooCommerce** must be installed in the test WordPress environment

## Running the Tests

### Run All Tests (Free Plugin)

```bash
cd /var/www/html/gaincommerce/public_html/nmi-enterprise/wp-content/plugins/gaincommerce-nmi-payment-gateway-for-woocommerce
vendor/bin/phpunit
```

### Run Only 3DS Tests (Free Plugin)

```bash
vendor/bin/phpunit tests/TestThreeDSFlow.php
```

### Run Specific Test Method

```bash
vendor/bin/phpunit tests/TestThreeDSFlow.php --filter test_successful_3ds_authentication_new_card
```

### Run With Verbose Output

```bash
vendor/bin/phpunit tests/TestThreeDSFlow.php --verbose
```

### Run Premium Plugin Tests

```bash
cd /var/www/html/gaincommerce/public_html/nmi-enterprise/wp-content/plugins/gaincommerce-nmi-enterprise
vendor/bin/phpunit src/Test/Test_ThreeDS_Premium_Integration.php
```

## Test Coverage

### Generate Coverage Report (HTML)

```bash
vendor/bin/phpunit --coverage-html coverage/
```

Then open `coverage/index.html` in your browser.

### Generate Coverage Report (Text)

```bash
vendor/bin/phpunit --coverage-text
```

## Expected Results

All tests should **PASS** if:
1. 3DS enabled/disabled logic works correctly
2. Type validation filters out null/invalid values
3. All 7 3DS fields are extracted when present:
   - `cavv` - Cardholder Authentication Verification Value
   - `xid` - Transaction ID
   - `eci` - Electronic Commerce Indicator
   - `cardholder_auth` - Cardholder Authentication Status
   - `three_ds_version` - 3DS Protocol Version
   - `directory_server_id` - Directory Server Transaction ID
   - `cardholder_info` - Additional Cardholder Information

## Test Scenarios Covered

### ✅ Successful Flows
- New card with 3DS authentication
- Saved card (vault) with 3DS authentication
- All 7 3DS fields present and valid
- Mixed legacy and blocks checkout

### ✅ Error Handling
- Null values in 3DS fields (filtered out)
- Invalid types (arrays, objects) in 3DS fields (filtered out)
- Empty strings (filtered out)
- Mixed valid/invalid fields (valid ones preserved)
- 3DS disabled (no extraction attempted)

### ✅ Premium Plugin Integration
- Settings: enable/disable 3DS
- Settings: failure action configuration
- Payload injection into NMI API request
- Response logging and order meta storage
- Type validation in payload handler

## Troubleshooting

### "WooCommerce is not installed"
Install WooCommerce in your test WordPress environment:
```bash
wp plugin install woocommerce --activate
```

### "Could not find wordpress-tests-lib"
Run the install script:
```bash
bash bin/install-wp-tests.sh wordpress_test root '' localhost latest
```

### "Class not found" errors
Make sure Composer dependencies are installed:
```bash
composer install
```

### Premium plugin tests fail
Make sure you're running from the correct directory and the premium plugin is installed alongside the free plugin.

## Integration Testing

For full integration testing (with actual NMI API calls):
1. Set up NMI sandbox credentials
2. Use the NMI test cards: https://docs.nmi.com/docs/testing
3. Enable 3DS in NMI sandbox account
4. Run manual checkout tests with:
   - Test card that triggers 3DS: `4012000033330026`
   - Card that supports 3DS 2.0: `4012001037141112`

## CI/CD Integration

Add to your GitHub Actions or CI pipeline:

```yaml
- name: Run PHPUnit Tests
  run: |
    cd wp-content/plugins/gaincommerce-nmi-payment-gateway-for-woocommerce
    vendor/bin/phpunit --coverage-clover coverage.xml
    
- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage.xml
```

## Notes

- These are **unit tests** that test logic and validation
- They do **not** make actual API calls to NMI
- For API integration testing, use the NMI sandbox
- Mock the Logger class for more advanced testing
- Use WordPress test framework's `WP_Mock` for isolated unit tests
