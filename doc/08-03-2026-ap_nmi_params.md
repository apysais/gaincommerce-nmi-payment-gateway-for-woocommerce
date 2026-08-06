# Audit: `ap_nmi_params.gateway_config` — 08-03-2026

## Background

`gateway_config` was wired as `'gateway_config' => $gateway_settings` in `enqueue-scripts.php`,
passing the **entire raw WP options array** to `wp_localize_script` and printing it inline in the
page HTML. This exposed `private_key`, `pathfinder_private_key`, `pathfinder_merchant_email`, and
every other gateway setting to any visitor who views page source.

---

## Full `gateway_config` object (fields confirmed from live page)

```json
{
  "enabled": "yes",
  "title": "Credit Card",
  "description": "Pay securely using your credit card.",
  "testmode": "no",
  "transaction_mode": "sale",
  "send_receipts": "yes",
  "restricted_card_types": "",
  "public_key": "<redacted>",
  "private_key": "<redacted>",
  "descriptor": "...",
  "descriptor_phone": "...",
  "enable_descriptor": "no",
  "logging": "yes",
  "save_card": "yes",
  "enable_3ds": "no",
  "3ds_failure_action": "decline",
  "use_sandbox": "yes",
  "pathfinder_sandbox": "no",
  "pathfinder_public_key": "<redacted>",
  "pathfinder_private_key": "<redacted>",
  "pathfinder_merchant_email": "<redacted>",
  "enable_subscriptions": "yes",
  "enable_apple_pay": "yes",
  "apple_merchant_id": "...",
  "enable_google_pay": "yes",
  "google_merchant_id": "",
  "enable_debug_console": "no"
}
```

---

## JS audit — which fields are actually read

Searched all JS files under `assets/js/` and `src/blocks/`.

### `assets/js/ap-nmi-unified-integration.js` (Legacy Checkout)

| Line | Access | Context |
|------|--------|---------|
| 484 | `ap_nmi_params.gateway_config.restricted_card_types` | CollectJS `callback` — checks returned card type against blocked list (had defensive `&&` guard) |
| 710 | `ap_nmi_params.gateway_config.restricted_card_types` | `window.checkValidCardType()` — **dead code**, function defined globally but never called anywhere |

**Only field ever read: `restricted_card_types`**

### `assets/js/build/checkout-blocks.js` + `src/blocks/checkout-blocks.js` (Blocks Checkout)

`gateway_config` is **not referenced at all**. Blocks gets `restricted_card_types` through its own
dedicated channel: `NMI_Blocks_Payment_Method.php` passes `$gateway->restricted_card_types` via
`getSetting('gaincommerce_nmi_data')`, read in JS as `settings.restricted_card_types`.

---

## Risk assessment

| Field exposed | Used in JS? | Risk |
|---|---|---|
| `private_key` | NO | **CRITICAL** — NMI security key, can process/void charges server-side |
| `pathfinder_private_key` | NO | **CRITICAL** — secondary API key |
| `pathfinder_merchant_email` | NO | Low — PII |
| `public_key` | NO (already in top-level `ap_nmi_params.public_key`) | None additional |
| `restricted_card_types` | **YES** | None |
| All other fields | NO | Low |

---

## Fix applied (08-03-2026)

Replaced `'gateway_config' => $gateway_settings` in `enqueue-scripts.php` with a single scoped key:

```php
// Only the fields JS actually reads — never pass the full settings array (exposes private_key).
'restricted_card_types' => array_values( array_filter( (array) ( $gateway_settings['restricted_card_types'] ?? [] ) ) ),
```

Updated both JS usages to read the flat key directly:

- **Line 484**: `ap_nmi_params.restricted_card_types || ''`
- **Line 710** (`window.checkValidCardType`): `ap_nmi_params.restricted_card_types || ''` + added `|| ''` null guard.
  This function was later deleted outright — see the verification pass below.

---

## Verification pass (08-03-2026, re-audit)

### Search scope actually cleared

`ap_nmi_params.gateway_config` has **zero references** across:

- every `.js` and `.php` in `gaincommerce-nmi-payment-gateway-for-woocommerce`
- every `.js` and `.php` in the `gaincommerce-nmi-enterprise` plugin (which never touches
  `ap_nmi_params` at all)
- the minified bundles under `assets/js/build/` — `grep -o gateway_config assets/js/` returns nothing,
  so no stale build output carries the old access

The remaining `gateway_config` hits in `src/Gateway.php`, the enterprise plugin, and `tests/` are
unrelated PHP local variables and an `apnmi_test_gateway_config()` helper — not the JS global.

### Value type

`restricted_card_types` is a `multiselect` (`Gateway.php:208`), so WooCommerce stores either an array
of lowercase slugs (`['visa','amex']`) or `''` when nothing is selected. `wp_localize_script` passes
non-scalars through untouched, so JS receives a real array rather than a string.

This matters for `.includes()`: on an array it is `Array.prototype.includes` (exact match), on a
string it is `String.prototype.includes` (substring match). The `array_values(array_filter((array) …))`
normalization above pins it to the array form so the two checkouts cannot diverge.

### Two independent channels — both scoped

| Checkout | Channel | Source |
|---|---|---|
| Legacy | `ap_nmi_params.restricted_card_types` | `enqueue-scripts.php:109` |
| Blocks | `settings.restricted_card_types` via `getSetting('gaincommerce_nmi_data')` | `NMI_Blocks_Payment_Method.php:160` |

Neither passes the settings array. Blocks reads through `$gateway->restricted_card_types`, which is
set from `get_option('restricted_card_types', array())` (`Gateway.php:101`) and is therefore already
an array.

### No admin JS exists

The plugin registers no `admin_enqueue_scripts` hook and ships no admin script — there was no admin
surface to fix. Admin-side card-restriction rendering is server-side PHP only
(`Gateway.php:1004` and `Gateway.php:1061`), reading via `get_option()`, unaffected by this change.

### Follow-ups applied in the same pass

1. **`enqueue-scripts.php:109`** — normalized to always emit a JSON array (snippet above). Behavior
   is identical today; this removes the legacy-vs-blocks type mismatch.
2. **`ap-nmi-unified-integration.js`** — deleted `window.checkValidCardType`. It was defined globally
   and never called from anywhere in either plugin or any bundle. The live restriction check is the
   one inside the CollectJS `callback` (~line 484), which is untouched.
