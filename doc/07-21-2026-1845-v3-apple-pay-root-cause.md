# Apple Pay Root Cause Found — 07-21-2026 18:45

## Root Cause

Confirmed against NMI's own documentation (`docs.nmi.com/docs/digital-wallet-setup`):
**Apple Pay is configured entirely through `data-field-apple-pay-*` attributes on the
`<script>` tag that loads `Collect.js` — there is no `CollectJS.configure({fields:
{applepay: {...}}})` for it.** NMI's docs show a full example script tag with
`data-field-apple-pay-selector`, `data-field-apple-pay-style-*`, etc., and explicitly:
"The page contains no separate JavaScript `CollectJS.configure({...})` block for Apple
Pay setup."

Our code did the opposite:
- `src/blocks/checkout-blocks.js` passes `fields: { applepay: { selector:
  '#nmi-apple-pay-button-blocks' } }` into `CollectJS.configure()` — a channel Apple Pay
  doesn't read.
- `enqueue-scripts.php`'s `script_loader_tag` filter added `data-price`, `data-currency`,
  `data-country`, `data-tokenization-key` to the Collect.js script tag, but **never**
  `data-field-apple-pay-selector`.

Without that attribute, CollectJS never learns where to render the Apple Pay button.
It doesn't error and doesn't time out — it just never attempts to create the button,
which is exactly what the debug log showed: `fieldsAvailableCallback` fires (because
`ccnumber`/`ccexp`/`cvv`/`googlepay` — all genuinely `configure()`-driven fields — loaded
fine), but `#nmi-apple-pay-button-blocks` stays at `childCount: 0`. Google Pay works
because, per the same docs, Google Pay *is* a `configure()`-supported field — the
asymmetry between the two wallets on the exact same `configure()` call was the key clue.

This also explains why NMI support's confirmation ("no merchant ID needed, no backend
activation, domain already whitelisted") was accurate and yet the button still didn't
render: those are genuinely the only account-level prerequisites. The bug was entirely a
client-side integration mistake — using the wrong configuration channel — not an account
or domain-verification issue.

## Ruled Out Along the Way

- **Double `CollectJS.configure()` race** (v1 fix plan) — real bug, correctly fixed, but
  turned out to be moot: `apple-pay-blocks.js` is dead code on Blocks checkout (never
  registered in `Plugin.php`), so the race it guarded against never actually happens.
- **Permissions-Policy iframe restriction** — the `payment=(self "https://collectcheckout.com")`
  header was unverified/likely wrong and was widened to `(self *)`, but Google Pay working
  through the same iframe already proved this wasn't blocking anything.
- **Missing/mismatched Apple domain-verification file** — initially looked suspicious
  (the file's `pspId`-JSON-wrapper format looked like a different PSP's format), but
  confirmed directly with the user: it's genuinely NMI's own file, downloaded from the
  NMI Merchant Portal and uploaded per NMI's instructions. Verified served correctly
  (`HTTP 200`, matching size) at `https://www.webigloo.net/.well-known/apple-developer-merchantid-domain-association`.
- **Stale deploy** — a test log initially looked stale (byte-identical to a pre-fix
  capture); turned out the v1/v2 code actually was live on the server already (git log
  confirmed), so that specific capture was just a re-paste of old text, not a new bug.

## Fix (v3)

File: `enqueue-scripts.php`, `script_loader_tag` filter (~line 106-140).

Added `data-field-apple-pay-selector` to the Collect.js script tag whenever Apple Pay is
enabled, pointing at the correct container for whichever checkout is active:
- `#nmi-apple-pay-button-blocks` for WooCommerce Blocks checkout (`has_block('woocommerce/checkout')`)
- `#nmi-apple-pay-express` for the legacy/classic checkout (`ap-nmi-unified-integration.js`)

```php
if ( $apple_pay_enabled ) {
    $apple_pay_selector = has_block('woocommerce/checkout')
        ? '#nmi-apple-pay-button-blocks'
        : '#nmi-apple-pay-express';
    $extra_attrs .= ' data-field-apple-pay-selector="' . esc_attr($apple_pay_selector) . '"';
}
```

The existing `fields.applepay` block in `checkout-blocks.js`'s `CollectJS.configure()`
call was left in place (harmless/likely ignored per NMI's docs, not worth touching on a
live payment page for a config key that isn't the actual fix).

Plugin version bumped 1.14.6 → 1.14.7 for cache-busting.

## Test Plan

1. Deploy (`git pull` + purge LiteSpeed Cache / SpeedyCache on the live server).
2. On the iPhone, use a fresh private Safari tab, load `/checkout`, reproduce.
3. Inspect the actual rendered script tag (View Source / Web Inspector) to confirm
   `data-field-apple-pay-selector="#nmi-apple-pay-button-blocks"` is present on the
   `Collect.js` script tag.
4. Copy Logs from the NMI debug panel — expect `Apple Pay Button Rendered: YES` and a
   populated `#nmi-apple-pay-button-blocks` (`childCount > 0`, `hasIframe: true`).
5. If it still doesn't render, check the new "Apple Pay Network Requests" diagnostic
   (added in the v2 fix) for any Apple/merchant-validation network call and its result —
   that would be the next concrete artifact for NMI support.

## Files Changed
- `enqueue-scripts.php` — add `data-field-apple-pay-selector` to the Collect.js script tag
- `gaincommerce-nmi-payment-gateway-for-woocommerce.php` — version bump 1.14.6 → 1.14.7
- `doc/07-21-2026-1845-v3-apple-pay-root-cause.md` — this file
