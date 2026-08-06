# 3-D Secure Implementation - Technical Report

**Project**: Gain Commerce NMI Payment Gateway for WooCommerce  
**Date**: February 10, 2026  
**Author**: Development Team  
**Version**: 1.10.0+

---

## Executive Summary

This document provides a comprehensive technical overview of the 3-D Secure (3DS) authentication implementation for the NMI Payment Gateway plugin. The implementation supports both 3DS v1.0 and v2.0 protocols, integrates seamlessly with WooCommerce Blocks and Legacy checkout, and includes full support for saved payment methods.

---

## Table of Contents

1. [Implementation Overview](#implementation-overview)
2. [Architecture Components](#architecture-components)
3. [Feature Matrix](#feature-matrix)
4. [Code Changes](#code-changes)
5. [Payment Flow Diagrams](#payment-flow-diagrams)
6. [API Integration](#api-integration)
7. [Testing & Debugging](#testing--debugging)
8. [Known Limitations](#known-limitations)
9. [Future Enhancements](#future-enhancements)

---

## Implementation Overview

### What is 3-D Secure?

3-D Secure (3DS) is a security protocol that adds an additional authentication layer for online credit and debit card transactions. It helps reduce fraud and shifts liability from merchants to card issuers for authenticated transactions.

**Supported Versions:**
- 3DS v1.0 (legacy)
- 3DS v2.0 (modern, frictionless authentication)

### Integration Approach

**Technology Stack:**
- **CollectJS**: NMI's tokenization library (PCI-compliant card data collection)
- **Gateway.js**: NMI's 3DS authentication library
- **React Components**: WooCommerce Blocks integration
- **Legacy jQuery**: Classic WooCommerce checkout integration

**Environment Support:**
- ✅ Production Gateway (secure.nmi.com)
- ✅ Test Mode on Production Gateway
- ❌ Pathfinder Sandbox (3DS not supported by NMI in Pathfinder)

---

## Architecture Components

### Free Plugin Components

**Location**: `gaincommerce-nmi-payment-gateway-for-woocommerce/`

#### 1. Gateway Settings Integration
**File**: `src/Gateway.php`

```php
// Lines 586-650: 3DS Data Extraction
- Extracts 3DS authentication data from both Blocks and Legacy checkout
- Validates data types (string validation to prevent REST API errors)
- Supports 7 3DS parameters: cavv, xid, eci, cardholder_auth, 
  three_ds_version, directory_server_id, cardholder_info
```

**Key Methods:**
- `process_payment()`: Main payment processing with 3DS data extraction
- 3DS data validation with type checking for REST API compatibility

#### 2. JavaScript - Blocks Checkout
**File**: `src/blocks/checkout-blocks.js` (791 lines)

**Key Functions:**

```javascript
// Line 358-480: nmiBlocksHandle3DSForNewCard()
- Initializes Gateway.js for new card 3DS authentication
- Creates modal container for 3DS challenge UI
- Collects device fingerprint data
- Handles authentication callbacks (success/failure)

// Line 266-340: nmiBlocksHandle3DSForVault()
- Handles 3DS for saved payment methods
- Uses customerVaultId instead of payment token
- Supports same authentication flow as new cards

// Line 314-356: nmiBlocksCollectDeviceData()
- Collects browser fingerprint for 3DS v2.0
- Fields: Java enabled, JavaScript, language, color depth,
  screen dimensions, timezone, device channel
```

**React Integration:**
- Lines 45-230: CollectJS initialization and token generation
- Lines 100-125: 3DS triggering after successful tokenization
- Lines 240-270: Safe 3DS data sanitization helper

#### 3. JavaScript - Legacy Checkout
**File**: `assets/js/ap-nmi-unified-integration.js` (644 lines)

**Key Functions:**

```javascript
// Lines 115-190: nmiHandle3DSAuthenticationForNewCard()
- Similar to Blocks implementation but for legacy checkout
- Uses jQuery-based callbacks
- Posts hidden form fields with 3DS data

// Lines 561-616: nmiHandle3DSAuthenticationForVault()
- Saved card 3DS for legacy checkout
- Customer vault ID-based authentication
```

#### 4. Script Enqueuing
**File**: `enqueue-scripts.php`

```php
// Lines 23-90: Conditional script loading
- Enqueues Gateway.js only when 3DS is enabled
- Passes public key and configuration to frontend
- Separate handling for Blocks vs Legacy checkout
```

---

### Premium Plugin Components

**Location**: `gaincommerce-nmi-enterprise/`

#### 1. 3DS Settings Manager
**File**: `src/Settings/ThreeDS_Settings.php`

```php
class ThreeDS_Settings {
    // Adds settings to free plugin's gateway settings page
    
    public static function add_3ds_settings($fields)
    // Adds enable_3ds checkbox and 3ds_failure_action dropdown
    
    public static function is_3ds_enabled(): bool
    // Checks if 3DS is turned on
    
    public static function get_public_key(): string
    // Returns public key for Gateway.js initialization
    
    public static function get_failure_action(): string
    // Returns configured failure behavior
}
```

**Settings Added:**
- `enable_3ds`: Master toggle for 3DS
- `3ds_failure_action`: 
  - `decline`: Block payment if 3DS fails
  - `continue_without_3ds`: Allow payment to proceed
  - `continue_with_warning`: Proceed with order note

#### 2. 3DS Payload Handler
**File**: `src/WC/ThreeDS_PayloadData.php`

```php
class ThreeDS_PayloadData {
    public static function add_3ds_to_payment_data($payment_data, $order, $config)
    // Hook: gaincommerce_nmi_process_payment_data
    // Injects 3DS authentication data into NMI API request
}
```

**Process Flow:**
1. Checks if 3DS is enabled
2. Validates 3DS data exists in config
3. Adds 7 3DS fields to payment data array
4. Type validation (string-only) for each field
5. Logs injection for debugging
6. Handles failure actions per settings

**NMI API Parameters Sent:**
```php
[
    'cavv' => 'AAABCZIhcQAAAABZlyFxAAAAAAA=',
    'xid' => 'MDAwMDAwMDAwMDAwMDAwMzIyNzY=',
    'eci' => '05',
    'cardholder_auth' => 'Y',
    'three_ds_version' => '2.0',
    'directory_server_id' => '00000000-0000-0000-0000-000000000000',
    'cardholder_info' => 'authenticated'
]
```

#### 3. 3DS Script Enqueuing
**File**: `src/Enqueue/ThreeDS_Scripts.php`

```php
class ThreeDS_Scripts {
    public static function enqueue_gateway_js()
    // Loads Gateway.js library from NMI CDN
    // Provides 3DS config to frontend JavaScript
    
    public static function add_3ds_config()
    // Localizes wp_localize_script with:
    // - enable_3ds flag
    // - public_key
    // - 3ds_failure_action
    // - device_data fields list
}
```

**Gateway.js URL:**
```
https://secure.networkmerchants.com/js/v1/Gateway.js
```

**Note**: Always uses production URL. Gateway.js intelligently routes to correct infrastructure (production vs sandbox) based on the public key provided.

#### 4. Integration Hooks
**File**: `gaincommerce-nmi-enterprise.php`

```php
// Hook registrations
ThreeDS_Settings::init();      // Add settings UI
ThreeDS_PayloadData::init();   // Hook payment data filter
ThreeDS_Scripts::init();       // Enqueue scripts
```

---

## Feature Matrix

### Supported Features

| Feature | WooCommerce Blocks | Legacy Checkout | Notes |
|---------|-------------------|-----------------|-------|
| **New Card - 3DS v1.0** | ✅ | ✅ | Full support |
| **New Card - 3DS v2.0** | ✅ | ✅ | Full support with device data |
| **Saved Card - 3DS** | ✅ | ✅ | Via customer vault ID |
| **3DS + Save Payment** | ✅ | ✅ | Saves card after 3DS auth |
| **Frictionless Auth** | ✅ | ✅ | 3DS v2.0 feature |
| **Challenge Flow** | ✅ | ✅ | 3DS v2.0 modal UI |
| **Device Fingerprinting** | ✅ | ✅ | Browser data collection |
| **Failure Handling** | ✅ | ✅ | 3 configurable actions |
| **Error Logging** | ✅ | ✅ | Comprehensive debug logs |
| **Multi-currency** | ✅ | ✅ | Any currency supported |

### NOT Supported

| Feature | Status | Reason |
|---------|--------|--------|
| **Pathfinder Sandbox 3DS** | ❌ | NMI limitation - Pathfinder doesn't support 3DS |
| **Pathfinder Customer Vault** | ❌ | NMI limitation - Pathfinder doesn't support vault |
| **Multiple Cards per Vault** | ⚠️ | Current design: 1 card per customer vault |

---

## Code Changes

### Summary of Modified Files

**Free Plugin** (5 files):
1. `src/Gateway.php` - 3DS data extraction
2. `src/blocks/checkout-blocks.js` - React components
3. `assets/js/ap-nmi-unified-integration.js` - Legacy checkout
4. `enqueue-scripts.php` - Script loading
5. `src/API/NMI_Base.php` - Pathfinder key handling (reverted)

**Premium Plugin** (4 new files):
1. `src/Settings/ThreeDS_Settings.php` - Settings UI
2. `src/WC/ThreeDS_PayloadData.php` - API payload injection
3. `src/Enqueue/ThreeDS_Scripts.php` - Script management
4. `gaincommerce-nmi-enterprise.php` - Hook initialization

### Key Code Blocks

#### 3DS Data Extraction (Gateway.php)

```php
// Extract 3DS data from blocks checkout
if (isset($_POST['payment_method_data'])) {
    $payment_data = $_POST['payment_method_data'];
    
    if (isset($payment_data['cavv']) && is_string($payment_data['cavv']) && !empty($payment_data['cavv'])) {
        $threeds_data['cavv'] = sanitize_text_field(wp_unslash($payment_data['cavv']));
    }
    // ... similar for xid, eci, cardholder_auth, three_ds_version, 
    // directory_server_id, cardholder_info
}
```

#### Gateway.js Authentication (checkout-blocks.js)

```javascript
Gateway.init(publicKey);
Gateway.authenticate(
    {
        ...billingData,
        ...deviceData,
        amount: amount,
        currency: currency,
        paymentToken: token, // OR customerVaultId: vaultId
        threeDSContainer: 'nmi-threeds-container'
    },
    (authResponse) => {
        // Success callback
        resolve({
            authenticated: true,
            cavv: authResponse.cavv,
            xid: authResponse.xid,
            eci: authResponse.eci,
            cardHolderAuth: authResponse.cardHolderAuth,
            threeDsVersion: authResponse.threeDsVersion
        });
    },
    (error) => {
        // Error callback
        handleFailureBasedOnSettings(error);
    }
);
```

#### Payment Data Injection (ThreeDS_PayloadData.php)

```php
add_filter('gaincommerce_nmi_process_payment_data', function($payment_data, $order, $config) {
    if (!ThreeDS_Settings::is_3ds_enabled()) {
        return $payment_data;
    }
    
    if (empty($config['threeds_data'])) {
        // Handle based on failure action setting
        return $payment_data;
    }
    
    // Add validated 3DS fields
    foreach (['cavv', 'xid', 'eci', 'cardholder_auth', 'three_ds_version'] as $field) {
        if (!empty($threeds_data[$field]) && is_string($threeds_data[$field])) {
            $payment_data[$field] = $threeds_data[$field];
        }
    }
    
    return $payment_data;
}, 10, 3);
```

---

## Payment Flow Diagrams

### New Card with 3DS + Save Payment

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. CUSTOMER CHECKOUT                                            │
│    - Enters card details                                        │
│    - Checks "Save payment method"                               │
│    - Clicks "Place Order"                                       │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. COLLECTJS TOKENIZATION                                       │
│    - Collects card data securely                                │
│    - Sends to: secure.nmi.com/token/api/save_multipart_token    │
│    - Returns: payment_token (e.g., HR67RvdJ-nuYgW8-x2DRDD...)   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. GATEWAY.JS 3DS AUTHENTICATION                                │
│    - Collects device fingerprint data                           │
│    - Sends payment_token + billing data + device data           │
│    - Gateway.js determines if challenge needed                  │
│    - If challenged: Modal UI displayed                          │
│    - Customer completes authentication                          │
│    - Returns: cavv, xid, eci, cardholder_auth, version          │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. BACKEND API REQUEST                                          │
│    - Receives: payment_token + 3DS data + save_payment_method   │
│    - Adds: customer_vault='add_customer' (from Save_Card hook)  │
│    - Sends to: secure.nmi.com/api/transact.php                  │
│    POST data:                                                   │
│      security_key=private_key                                   │
│      type=sale                                                  │
│      payment_token=HR67RvdJ...                                  │
│      customer_vault=add_customer                                │
│      cavv=AAABCZIhcQAAAABZlyFxAAAAAAA=                          │
│      xid=MDAwMDAwMDAwMDAwMDAwMzIyNzY=                            │
│      eci=05                                                     │
│      cardholder_auth=Y                                          │
│      three_ds_version=2.0                                       │
│      amount=72.00                                               │
│      ... (billing, shipping, etc.)                              │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. NMI PROCESSING                                               │
│    - Validates 3DS authentication                               │
│    - Processes payment                                          │
│    - Saves card to customer vault                               │
│    - Returns: transaction_id, customer_vault_id, response=1     │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. ORDER COMPLETION                                             │
│    - Order marked as "Processing"                               │
│    - Transaction ID stored in order meta                        │
│    - Customer vault ID stored in user meta                      │
│    - Order note: "3DS authenticated, card saved"                │
│    - Customer redirected to confirmation page                   │
└─────────────────────────────────────────────────────────────────┘
```

### Saved Card with 3DS

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. CUSTOMER CHECKOUT                                            │
│    - Selects "Use saved card ending in ****1234"                │
│    - Clicks "Place Order"                                       │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. GATEWAY.JS 3DS AUTHENTICATION                                │
│    - Retrieves customer_vault_id from user meta                 │
│    - Collects device fingerprint data                           │
│    - Sends customerVaultId + billing data + device data         │
│    - No payment_token (card already in vault)                   │
│    - Gateway.js performs authentication                         │
│    - Returns: cavv, xid, eci, cardholder_auth, version          │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. BACKEND API REQUEST                                          │
│    - Receives: customer_vault_id + 3DS data                     │
│    - Sends to: secure.nmi.com/api/transact.php                  │
│    POST data:                                                   │
│      security_key=private_key                                   │
│      type=sale                                                  │
│      customer_vault_id=123456789                                │
│      cavv=AAABCZIhcQAAAABZlyFxAAAAAAA=                          │
│      xid=MDAwMDAwMDAwMDAwMDAwMzIyNzY=                            │
│      eci=05                                                     │
│      ... (3DS data and transaction details)                     │
│    NOTE: No payment_token - vault ID references saved card      │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. NMI PROCESSING                                               │
│    - Validates 3DS authentication                               │
│    - Retrieves card from vault                                  │
│    - Processes payment                                          │
│    - Returns: transaction_id, response=1                        │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. ORDER COMPLETION                                             │
│    - Order marked as "Processing"                               │
│    - Transaction ID stored                                      │
│    - Order note: "3DS authenticated with saved card"            │
│    - Customer redirected to confirmation                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Integration

### NMI Gateway.js Methods

**Initialization:**
```javascript
const gateway = Gateway.create(publicKey);
const threeDS = gateway.get3DSecure();
```

**Creating 3DS UI:**
```javascript
const threeDSecureInterface = threeDS.createUI({
    paymentToken: 'token_value',  // OR customerVaultId: 'vault_id'
    currency: 'USD',
    amount: '10.00',
    // Device data fields...
    browserJavaEnabled: 'true',
    browserJavascriptEnabled: 'true',
    browserLanguage: 'en-US',
    browserColorDepth: '24',
    browserScreenHeight: '1080',
    browserScreenWidth: '1920',
    browserTimeZone: '300',
    deviceChannel: 'browser'
});
```

**Event Handlers:**
```javascript
threeDSecureInterface.on('complete', function(authData) {
    // authData contains:
    // - cavv, xid, eci, cardHolderAuth, threeDsVersion,
    // - directoryServerId, cardHolderInfo
});

threeDSecureInterface.on('failure', function(error) {
    // Handle authentication failure
});

threeDSecureInterface.on('challenge', function(e) {
    // User is being challenged (modal displayed)
});
```

### NMI Payment API Parameters

**Request to `/api/transact.php`:**

```
POST https://secure.nmi.com/api/transact.php
Content-Type: application/x-www-form-urlencoded

security_key=6457Thfj624V5r7WUwc5v6a68Zsd6YEm
type=sale
amount=100.00
payment_token=HR67RvdJ-nuYgW8-x2DRDD-67X5cAUkyvGx
cavv=AAABCZIhcQAAAABZlyFxAAAAAAA=
xid=MDAwMDAwMDAwMDAwMDAwMzIyNzY=
eci=05
cardholder_auth=Y
three_ds_version=2.0
directory_server_id=00000000-0000-0000-0000-000000000000
cardholder_info=authenticated
customer_vault=add_customer
first_name=John
last_name=Doe
email=john@example.com
...
```

**Response:**
```
response=1
responsetext=SUCCESS
transactionid=9876543210
customer_vault_id=123456789
authcode=123456
avsresponse=M
cvvresponse=M
cavv_result=M
liability_shift=yes
enrolled=Y
authentication_status=Y
eci=05
```

---

## Testing & Debugging

### Test Environment Setup

**Production Gateway Test Mode:**
```php
// Settings configuration
'testmode' => 'yes'  // Use test merchant credentials
'pathfinder_sandbox' => 'no'  // Do NOT enable for 3DS testing
'enable_3ds' => 'yes'  // Enable 3DS
'3ds_failure_action' => 'decline'  // Block on failure
```

**Test Cards:**
- **3DS v2.0 Frictionless**: `4000000000001091`
- **3DS v2.0 Challenge**: `4000000000001000`
- **3DS v1.0**: `4111111111111111`

### Debug Logging

**Enable Logging:**
```php
// In wp-config.php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);

// In Gateway settings
'logging' => 'yes'
```

**Log Locations:**
- Main log: `/wp-content/debug.log`
- Plugin log: `/nmi/3ds/gaincommerce-nmi-gateway-YYYY-MM-DD.log`

**Key Log Entries:**

```
[2026-02-10 15:30:45] DEBUG - 3DS enabled - checking for authentication data
    order_id: 12345

[2026-02-10 15:30:45] INFO - Adding 3DS data to payment request
    order_id: 12345
    has_cavv: true
    has_xid: true
    has_eci: true
    three_ds_version: 2.0

[2026-02-10 15:30:46] INFO - NMI API: Request completed
    response_code: 200
    transaction_id: 9876543210
    response_status: 1
```

### Browser Console Debugging

**Key Console Logs:**
```javascript
// CollectJS token generation
"AP NMI Blocks: Token generated successfully: HR67RvdJ..."

// 3DS key verification
"AP NMI Blocks: 3DS Key Verification"
{
    collectjs_key: "7242yd-juHM2S-T4ZNh2...",
    gatewayjs_key: "7242yd-juHM2S-T4ZNh2...",
    keys_match: "YES",
    token: "HR67RvdJ..."
}

// 3DS authentication started
"AP NMI Blocks: Starting 3DS authentication..."

// 3DS complete
"AP NMI Blocks: 3DS authentication complete"
{
    authenticated: true,
    cavv: "AAABCZIhcQAAAABZlyFxAAAAAAA=",
    xid: "MDAwMDAwMDAwMDAwMDAwMzIyNzY=",
    eci: "05"
}
```

### Common Issues & Solutions

**Issue**: "Payment Token does not exist"
**Cause**: Key mismatch between CollectJS and Gateway.js
**Solution**: Verify both use same public key (check console log "keys_match")

**Issue**: "3DSecure is inactive"
**Cause**: 3DS not enabled on NMI merchant account
**Solution**: Contact NMI to activate 3DS on account

**Issue**: 3DS modal doesn't appear
**Cause**: Gateway.js not loaded or initialization failed
**Solution**: Check browser console for Gateway.js errors, verify public key

**Issue**: "Missing required field: ccnumber"
**Cause**: Sending customer_vault_id without removing payment_token
**Solution**: Ensure Save_Card_PayloadData removes payment_token when using vault

---

## Known Limitations

### Platform Limitations

1. **Pathfinder Sandbox**
   - ❌ 3DS not supported (NMI platform limitation)
   - ❌ Customer Vault not supported (NMI platform limitation)
   - **Workaround**: Use production gateway test mode for full testing

2. **WooCommerce Subscriptions**
   - ⚠️ Initial payment: 3DS supported
   - ⚠️ Recurring payments: 3DS may not apply (vault charges)
   - **Note**: Follow NMI's credential-on-file guidelines

3. **Multiple Cards per Customer**
   - Current implementation: 1 card per customer vault
   - No billing_id parameter used
   - **Enhancement**: Could support multiple cards with billing_id

### Technical Constraints

1. **Browser Requirements**
   - JavaScript must be enabled
   - Cookies must be enabled
   - Pop-ups must be allowed (for 3DS modal)

2. **Mobile Browsers**
   - iOS Safari: Fully tested ✅
   - Android Chrome: Fully tested ✅
   - Mobile app webviews: May have limitations

3. **Network**
   - Requires stable internet connection
   - 3DS authentication timeout: ~60 seconds
   - CollectJS timeout: ~30 seconds

---

## Future Enhancements

### Recommended Improvements

1. **Advanced 3DS Settings**
   - Challenge preference configuration
   - Merchant risk indicator parameters
   - Transaction type indicators
   - Delivery timeframe options

2. **Analytics Dashboard**
   - 3DS success/failure rates
   - Authentication method breakdown (frictionless vs challenge)
   - Liability shift statistics
   - Average authentication time

3. **Multiple Cards Support**
   - Extend vault to support multiple cards per customer
   - Add billing_id parameter to vault operations
   - UI for card management (add/remove/set default)

4. **Enhanced Error Handling**
   - Retry mechanism for network failures
   - Better error messages for customers
   - Admin notifications for repeated failures

5. **Performance Optimization**
   - Lazy load Gateway.js (only when 3DS enabled)
   - Cache device fingerprint data
   - Preload 3DS iframe for faster challenges

6. **Subscription Support**
   - MIT (Merchant Initiated Transaction) framework
   - Stored credential indicators
   - Exemption handling

---

## Deployment Checklist

### Pre-Production

- [ ] Enable logging in test environment
- [ ] Test with all supported card types
- [ ] Test frictionless flow (card 1091)
- [ ] Test challenge flow (card 1000)
- [ ] Test saved card with 3DS
- [ ] Test save payment + 3DS
- [ ] Verify error handling (wrong CVV, expired card)
- [ ] Test on mobile devices
- [ ] Test on multiple browsers
- [ ] Review debug logs for errors

### Production

- [ ] Verify NMI merchant account has 3DS enabled
- [ ] Update public/private keys to production
- [ ] Set testmode = 'no'
- [ ] Set pathfinder_sandbox = 'no'
- [ ] Configure 3ds_failure_action (recommend 'decline')
- [ ] Disable debug logging OR rotate logs regularly
- [ ] Monitor first 10 live transactions closely
- [ ] Set up error monitoring/alerts
- [ ] Document support procedures
- [ ] Train support team on 3DS errors

---

## Support & Maintenance

### Support Contacts

**NMI Support:**
- Email: support@nmi.com
- Phone: 1-866-937-0624
- Portal: https://secure.nmi.com/merchants/

**Plugin Issues:**
- GitHub: [repository URL]
- Email: support@gaincommerce.com

### Maintenance Tasks

**Weekly:**
- Review error logs for patterns
- Monitor 3DS success rate

**Monthly:**
- Update test card list (NMI may change)
- Review NMI for updated Gateway.js versions
- Check for WordPress/WooCommerce updates

**Quarterly:**
- Full regression testing
- Review PCI compliance
- Update documentation

---

## Appendix

### File Reference Map

```
gaincommerce-nmi-payment-gateway-for-woocommerce/
├── src/
│   ├── Gateway.php                          [3DS data extraction]
│   ├── blocks/
│   │   └── checkout-blocks.js               [React 3DS integration]
│   └── API/
│       └── NMI_Base.php                     [API endpoint handling]
├── assets/
│   └── js/
│       └── ap-nmi-unified-integration.js    [Legacy 3DS integration]
└── enqueue-scripts.php                      [Script loading]

gaincommerce-nmi-enterprise/
├── src/
│   ├── Settings/
│   │   └── ThreeDS_Settings.php             [3DS settings UI]
│   ├── WC/
│   │   └── ThreeDS_PayloadData.php          [Payment data injection]
│   └── Enqueue/
│       └── ThreeDS_Scripts.php              [Gateway.js loading]
└── gaincommerce-nmi-enterprise.php          [Hook initialization]
```

### Glossary

- **3DS**: 3-D Secure - card authentication protocol
- **CAVV**: Cardholder Authentication Verification Value
- **XID**: Transaction identifier
- **ECI**: Electronic Commerce Indicator
- **Frictionless**: 3DS v2.0 authentication without challenge
- **Challenge**: Additional verification step (password, OTP, etc.)
- **Liability Shift**: Transfer of fraud liability from merchant to issuer
- **CollectJS**: NMI's PCI-compliant tokenization library
- **Gateway.js**: NMI's 3DS authentication library
- **Customer Vault**: NMI's saved payment method storage

---

**Document Version**: 1.0  
**Last Updated**: February 10, 2026  
**Next Review**: May 10, 2026
