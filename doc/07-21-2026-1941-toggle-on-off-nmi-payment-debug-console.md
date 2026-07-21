# Toggle On/Off — NMI Payment Debug Console — 07-21-2026 19:41

## Context

The "NMI Payment Debug Console" (an on-page panel showing captured console logs and
system info, built for diagnosing Apple Pay/Google Pay on iPhone Safari where dev tools
aren't accessible — see `doc/07-20-2026-2149-v2-fix-apple-pay.md` and
`doc/07-21-2026-1845-v3-apple-pay-root-cause.md`) was always loading and rendering for
every real checkout visitor, gated only on `is_checkout()`. Now that the Apple Pay root
cause is fixed and confirmed working on the live site, this diagnostic panel needed to be
hidden from real customers by default, with an admin switch to turn it back on only when
actively debugging.

Two other things were reported and investigated in the same session, for completeness:
- **Apple Pay/Google Pay allegedly not showing on legacy checkout** — turned out to be
  the same `window.isSecureContext` requirement already known from the Blocks checkout
  fix: the local dev site (`http://gaincommerce.local`) is plain HTTP, so both wallet APIs
  are unavailable there by browser design. Confirmed working correctly on the live HTTPS
  site in both checkout types. **No code was changed for this — explicitly out of scope
  per instruction not to touch working wallet code.**

## What Was Added

A new checkbox setting, **Debug Console** ("Enable NMI Payment Debug Console"), under
**WooCommerce → Settings → Payments → Gain Commerce NMI Payment Gateway for WooCommerce**.
Default: **off** (`'no'`). Added to `src/Gateway.php::init_form_fields()` immediately
after the existing `logging` field, following the exact same checkbox field pattern
already used for `enable_apple_pay`/`enable_google_pay`/`logging`.

## Where It's Gated

The debug console previously loaded/rendered unconditionally in three places. All three
are now gated behind `enable_debug_console === 'yes'`:

1. **Script/style enqueue** — `enqueue-scripts.php` (~line 12). The `nmi-payment-monitor`
   script (console-override + error/rejection/resource-error capture) and its stylesheet
   are no longer registered/enqueued at all when the setting is off — not just hidden,
   genuinely not loaded, so there's no console-patching overhead on real checkout traffic.
   ```php
   if ( function_exists('is_checkout') && is_checkout()
       && ($gateway_settings['enable_debug_console'] ?? 'no') === 'yes' ) {
       // existing nmi-payment-monitor script/style registration, unchanged
   }
   ```

2. **Classic checkout panel markup** — `template/public/wc-payment-fields.php`. The whole
   `<!-- NMI Debug Panel --> ... <!-- End NMI Debug Panel -->` block is wrapped in
   `<?php if ($debug_console_enabled) : ?> ... <?php endif; ?>`. The flag is read via
   `$this->get_option('enable_debug_console') === 'yes'` and passed into the template's
   `$args` from `Gateway::payment_fields()`.

3. **Blocks checkout panel markup** — `src/blocks/checkout-blocks.js`. The debug panel JSX
   is wrapped in `{settings.debug_console_enabled && ( ... )}`. The flag is added to
   `NMI_Blocks_Payment_Method::get_payment_method_data()`'s returned array via
   `$gateway->get_option('enable_debug_console') === 'yes'`, which WooCommerce Blocks
   exposes to the script as `gaincommerce_nmi_data.debug_console_enabled`.

## Files Changed

- `src/Gateway.php` — new `enable_debug_console` field in `init_form_fields()`; new
  `debug_console_enabled` key passed via `$args` in `payment_fields()`.
- `enqueue-scripts.php` — added the setting check to the existing `is_checkout()` gate.
- `template/public/wc-payment-fields.php` — read the new arg; wrapped the panel markup
  in a conditional.
- `src/WC/NMI_Blocks_Payment_Method.php` — added `debug_console_enabled` to
  `get_payment_method_data()`.
- `src/blocks/checkout-blocks.js` — wrapped the debug panel JSX in a conditional.
- `assets/js/build/checkout-blocks.js` + `.asset.php` — rebuilt via `npm run build`.
- `gaincommerce-nmi-payment-gateway-for-woocommerce.php` — version bump 1.14.7 → 1.14.8.

## Deploy

Committed (`8da79d1`, "Add admin toggle for NMI Payment Debug Console, off by default")
on branch `feature/digital-wallet-apple-google-pay`, pushed, pulled on the live
`www.webigloo.net` server, rebuilt (`npm run build`), and both LiteSpeed Cache and
SpeedyCache were purged on the live server afterward.

## Test Plan

1. Default state (setting unchecked): view source on a live checkout page (classic and
   Blocks) — confirm no `<script>`/`<link>` tag for `nmi-payment-monitor`, and no
   `.nmi-debug-panel` markup anywhere in the rendered HTML.
2. Go to WooCommerce → Settings → Payments → Gain Commerce NMI Payment Gateway for
   WooCommerce, check **Enable NMI Payment Debug Console**, save.
3. Reload checkout (both types) — confirm the panel now appears, System Information
   populates, console logs stream in, and the **Clear Logs** / **Copy All** buttons work.
4. Uncheck the setting, save, reload — confirm the panel disappears again on both
   checkout types.
