# Apple Pay Fix Plan — 07-20-2026 21:26

## Problem Summary
Apple Pay button not rendering on iPhone Safari (iOS 18.7) despite device being fully capable.

## Confirmed Environment (from debug log)
- Device: iPhone, iOS 18.7, Safari ✓
- HTTPS / isSecureContext: true ✓
- ApplePaySession.canMakePayments(): true ✓
- CollectJS loaded ✓
- `#nmi-apple-pay-button-blocks` DOM element found (`selectorFound: true`) ✓
- `CollectJS.configure()` called with `applepay` field ✓
- No JavaScript errors thrown ✓

## NMI Support Confirmation (web Apple Pay)
- No Apple Merchant ID required for web
- No NMI merchant-side activation required
- Domain already whitelisted in NMI Apple Pay settings ✓
- Requirements: CollectJS with `price` + `country` + `currency`, plus a `<div>` target
- Google Pay is plug-and-play (no changes needed)

## Root Cause: Double `CollectJS.configure()` Bug

`checkout-blocks.js` never sets `window.nmiCollectJSBlocksConfigured`.  
`apple-pay-blocks.js` fallback checks this flag before its own configure call.

React mount order: express payment methods (`apple-pay-blocks.js`) mount **before** the
CC form (`checkout-blocks.js`). `useEffect` hooks fire in mount order:

1. `apple-pay-blocks.js` useEffect fires → flag not set → **configures CollectJS**
   (applepay-only field, WITH `fieldsAvailableCallback` + `timeoutCallback`)
2. `checkout-blocks.js` useEffect fires → flag still not set (never was set) →
   **configures CollectJS again** (CC + wallet fields, WITHOUT `fieldsAvailableCallback`)

Second configure call overrides the first. `fieldsAvailableCallback` is lost.
Apple Pay button rendering state becomes invisible to both scripts.
This is why the debug log goes silent after "Including Apple Pay field in CollectJS config".

## Changes

### Change 1 — `src/blocks/checkout-blocks.js` (~line 88)
Set the shared flag immediately at the start of the CollectJS `useEffect`,
right after `console.log('AP NMI Blocks: Initializing CollectJS...')`:

```js
// Mark as configured so apple-pay-blocks.js fallback skips its own configure call.
window.nmiCollectJSBlocksConfigured = true;
```

### Change 2 — `src/blocks/checkout-blocks.js` `baseConfig` (~line 172)
Add `fieldsAvailableCallback`, `timeoutDuration`, and `timeoutCallback` to `baseConfig`
after `focusCss`:

```js
fieldsAvailableCallback: () => {
    const apBtn = document.getElementById('nmi-apple-pay-button-blocks');
    const rendered = apBtn ? apBtn.children.length > 0 : false;
    console.log('AP NMI Blocks: fieldsAvailableCallback — Apple Pay button rendered:', rendered, {
        childCount: apBtn ? apBtn.children.length : 0,
        hasIframe: apBtn ? !!apBtn.querySelector('iframe') : false,
    });
    if (typeof window.NMI_Debug !== 'undefined') {
        window.NMI_Debug.addSystemInfo('Apple Pay Button Rendered', rendered ? 'YES' : 'NO — div empty after fieldsAvailableCallback');
    }
},
timeoutDuration: 10000,
timeoutCallback: () => {
    console.error('AP NMI Blocks: CollectJS timed out — Apple Pay button failed to load. Verify domain is registered in NMI Apple Pay settings.');
    if (typeof window.NMI_Debug !== 'undefined') {
        window.NMI_Debug.addSystemInfo('CollectJS Timeout', 'FAILED — check NMI domain registration');
    }
},
```

**Why these go through the logger:**
`nmi-payment-monitor.js` loads in `<head>` before all other scripts and overrides
`console.log/error` globally. Any message containing "NMI", "Apple Pay", or "CollectJS"
is auto-captured. `addSystemInfo()` adds a prominent entry in the System Info panel
at the top of the debug panel — immediately visible without scrolling.

### Change 3 — `src/blocks/apple-pay-blocks.js` (~line 65)
Wrap the fallback configure `if`-block in `setTimeout(..., 0)` to defer by one tick:

```js
setTimeout( () => {
    if ( isPrimary.current && appleSupported && typeof CollectJS !== 'undefined' && ! window.nmiCollectJSBlocksConfigured ) {
        console.log( 'NMI Apple Pay Blocks: CC form not active, configuring CollectJS for Apple Pay only.' );
        window.nmiCollectJSBlocksConfigured = true;
        // ... rest of existing configure call unchanged ...
    }
}, 0 );
```

**Why `setTimeout(0)`:** React runs all pending `useEffect` hooks before `setTimeout`
callbacks. When NMI is the active gateway, `checkout-blocks.js` useEffect sets the flag
synchronously during the same render cycle. By the time the `setTimeout` fires, the flag
is already `true` and the fallback is skipped. When NMI is **not** selected (CC form not
mounted), the flag is never set and the fallback correctly configures CollectJS.

### Change 4 — Build
```
npm run build
```
Regenerates:
- `assets/js/build/checkout-blocks.js`
- `assets/js/build/apple-pay-blocks.js`

## How to Read the New Debug Log

| Log / System Info entry | Meaning | Next action |
|---|---|---|
| `fieldsAvailableCallback — Apple Pay button rendered: true` + System Info `Apple Pay Button Rendered: YES` | Button injected correctly ✓ | Check CSS if not visible on screen |
| `fieldsAvailableCallback — Apple Pay button rendered: false` + System Info `NO` | CollectJS ran but rendered nothing | Device may have no active card in Wallet app |
| System Info `CollectJS Timeout: FAILED` | Domain verification file unreachable | Verify `/.well-known/apple-developer-merchantid-domain-association` is served |
| Neither callback fires | Double-configure still happening | Confirm `window.nmiCollectJSBlocksConfigured` is set in Change 1 |

## Files Changed
- `src/blocks/checkout-blocks.js` — Changes 1, 2
- `src/blocks/apple-pay-blocks.js` — Change 3
- `doc/07-20-2026-21-26-apple-pay-fix-plan.md` — this file
