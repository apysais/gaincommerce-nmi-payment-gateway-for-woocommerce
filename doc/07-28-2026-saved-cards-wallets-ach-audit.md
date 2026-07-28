# Audit — saved cards, digital wallets, ACH

**Date:** 2026-07-28
**Branch:** `fix/nmi-timeout-checkout` (both plugins)
**Plugin versions:** card `1.15.0` (uncommitted), enterprise `1.6.0` (uncommitted)
**Scope:** Does saved-card, digital-wallet and ACH functionality still work after the
tokenization-timeout fix?

---

## 1. Why this audit

The `fix/nmi-timeout-checkout` work fixed the CollectJS tokenization stall. The root
cause was that `if (response.wallet)` is **always** truthy — CollectJS's
`TokenResponse` assigns `wallet` unconditionally, and for a card tokenization it is
`createEmptyWalletData()`, an object whose leaves are all `null` but which is still an
object. So every *card* payment took the *wallet* branch, re-submitted the form
mid-callback, and left tokenization to time out.

The fix switched both checkouts to dispatch on `response.tokenType`, via the new shared
helper `assets/js/nmi-wallet-support.js`.

Card checkout has since been confirmed working on **blocks** and **legacy**. This audit
covers the three flows that branch off the same code and were not directly re-tested.

**Result:**

| Flow | Blocks | Legacy |
|---|---|---|
| New card | works | works |
| Saved card | works | **broken** |
| Apple Pay / Google Pay | **broken** | **broken** |
| ACH (enterprise plugin) | works | works |

None of the breakage is a regression from this branch. All of it predates the timeout
fix; the fix is simply what made it visible.

---

## 2. What was verified working

### Blocks saved card

`src/blocks/checkout-blocks.js:437-471` returns the saved-card payload **before**
`CollectJS.startPaymentRequest()` at `:514`, so Collect.js is correctly bypassed:

```js
if (useSavedCardRef.current && settings.has_saved_card) {
    return {
        type: emitResponse.responseTypes.SUCCESS,
        meta: { paymentMethodData: withTraceId({
            use_save_payment_method: '1',
            save_payment_method: '0',
        }) },
    };
}
```

### ACH

The ACH gateway is largely self-contained: its own `wp_remote_post`
(`src/Service/ACH_Payment_Service.php`), its own hooks
(`gaincommerce_nmi_ach_process_payment_data`, `gc_nmi_ach_after_payment_success`), its
own meta key `_gaincommerce_nmi_ach_transaction_id`. Routing and account numbers never
reach PHP — the template renders empty divs that Collect.js mounts iframes into, and
only a `payment_token` is posted.

The one uncommitted change in the enterprise plugin — deleting its duplicate
`script_loader_tag` filter on `nmi-collectjs` — is **correct**. Both plugins previously
registered a filter on the same handle at the same priority, each bailing if the other
had already run. Whichever won was down to hook-registration order, and when the
enterprise one won, the card plugin's wallet attributes (`data-price`,
`data-currency`, `data-country`, `data-field-apple-pay-selector`) were silently
dropped.

ACH still gets its tokenization key: the card plugin's surviving filter
(`enqueue-scripts.php:135-202`) has **no** `is_checkout()` gate, and ACH's blocks
support registers the *same* `nmi-collectjs` handle
(`src/Blocks/ACH_Gateway_Blocks_Support.php:77-85`), so the filter applies there too.

### Build artifacts

`assets/js/build/checkout-blocks.js` (mtime 18:37) is newer than
`src/blocks/checkout-blocks.js` (18:35), and every distinctive new string is present in
the bundle (`blocks:wallet:no_callback`, `blocks:tokenize:timeout_collectjs`,
`nmi_trace_id`, …). Identifier counts match 1:1 for all saved-card symbols. ACH's
bundle likewise matches its source. **No rebuild is outstanding.**

---

## 3. Defect 1 — legacy saved card is dead (P0)

### Evidence

`src/Gateway.php:584`:

```php
if (isset($_POST['save_payment_method']) && $_POST['use_save_payment_method'] == '1') {
    $gateway_config['use_save_payment_method'] = true;
} elseif (isset($_POST['payment_method_data']['use_save_payment_method']) && ...) {
    $gateway_config['use_save_payment_method'] = true;
} else {
    $gateway_config['use_save_payment_method'] = false;   // :591
}
```

Three problems compound:

1. **Line 584 guards on the wrong key** — `isset($_POST['save_payment_method'])` but
   reads `$_POST['use_save_payment_method']`.
2. **The `else` at :591 overwrites the correct value** already computed at `:571`
   from the sound derivation at `:531-537`.
3. **`save_payment_method` is never posted on the legacy saved-card path.** The
   template checkbox has no `name` attribute —
   `template/public/wc-payment-fields.php:127`:

   ```php
   <input id="save_payment_method" type="checkbox" value="1" />
   ```

   The hidden input is appended only by `nmiSubmitFormWithToken`
   (`assets/js/ap-nmi-unified-integration.js:856-865`), which runs on the **new card**
   path. The saved-card submit at `:1004` and
   `nmiSubmitFormWithVaultAndThreeDS` at `:1157-1176` do not append it.

### Failure chain

`isset($_POST['save_payment_method'])` → false → `payment_method_data` absent → `else`
→ `use_save_payment_method = false` → `Save_Card_PayloadData::add_save_card_to_payment_data`
(enterprise, `:47`) never injects `customer_vault_id` → `payment_token` is empty →
`NMI_Payment_API` falls through to its raw-card branch → **"Missing required field:
ccnumber"**.

Blocks escapes this only because its payload always sends **both** keys, so the
`isset()` happens to be satisfied.

### Notes

- Introduced by commit `d88b8c7 "update block code"`. `git diff src/Gateway.php` on
  this branch touches only `Checkout_Trace::server()` calls — **not a regression from
  the timeout work.**
- It can look intermittently fixed: if ACH is also enabled and the shopper ticks ACH's
  save-account box, that posts a `save_payment_method` key which accidentally
  satisfies the `isset()`.

### Fix

Delete `src/Gateway.php:584-592`. Line `:571` already carries the correct value.

---

## 4. Defect 2 — wallets cannot complete a payment (P1)

### Reconciling with the successful live test

Apple Pay was confirmed working on a live HTTPS server around 2026-07-21. That is
consistent with this finding:

- Express payment methods were **unregistered on 2026-05-12**, commit `20b60b3`
  (`src/Plugin.php:167-177`).
- The 2026-07-21 commit `f56b882` is *"Fix Apple Pay button not rendering: configure
  via data-field-apple-pay-selector"*. It made the **button appear**. It did not touch
  what happens after a tap.

So "the button showed up on live" and "a tap cannot complete an order" are both true.

### Blocks

`src/blocks/checkout-blocks.js:249-276`:

```js
const cb = window.__nmiWalletCallbacks && window.__nmiWalletCallbacks[walletType];
if (typeof cb === 'function') { cb(response.token); return; }
NMITrace.error('blocks:wallet:no_callback', { walletType });
// → "This wallet is not available at checkout. Please pay by card."
```

The only writers of `window.__nmiWalletCallbacks` are
`src/blocks/apple-pay-blocks.js:43` and `src/blocks/google-pay-blocks.js:43`, which
belong to the express payment methods that `Plugin::init_blocks_support()` no longer
registers. Those bundles never load, so the object is `undefined` and **every wallet
tap hits the error branch.**

Meanwhile the containers still render whenever the settings are on
(`src/blocks/checkout-blocks.js:914-931`), so the buttons are clickable-but-broken.

The correct handler already exists at `:414-431` — it reads `walletTokenRef` /
`walletTypeRef` and returns a proper `paymentMethodData` payload — but is annotated
*"Currently unreachable: nothing sets these refs."*

Secondary issue: even if the express methods were re-registered,
`apple-pay-blocks.js` writes `__nmiWalletCallbacks.applepay` (**lowercase**) while the
lookup uses `response.tokenType`, which is `applePay` (**camelCase**). Google Pay's key
matches; Apple Pay's does not.

### Legacy

`assets/js/ap-nmi-unified-integration.js:447-457`:

```js
$('<input>').attr({ type:'hidden', name:'payment_token',   value: response.token }).appendTo($form);
$('<input>').attr({ type:'hidden', name:'nmi_wallet_type', value: walletType    }).appendTo($form);
$form.submit();
```

`$form.submit()` triggers WooCommerce's own submit handler, which fires
`checkout_place_order`, which re-enters this file's handler at `:961`. That handler has
no wallet bypass at the top, so it runs card validation:

```js
if (window.nmiFieldValidation.ccnumber !== true) {
    validationErrors.push('<p>Please enter a valid card number.</p>');
}
```

`nmiFieldValidation` is reset to all-`false` in `fieldsAvailableCallback` and only set
by typing into the card iframes — which never happens for a wallet payment. **The
order aborts with "Please enter a valid card number."**

The card path avoids this by calling `.off('checkout_place_order')` before submitting
(`:869`, and again at `:1004`, `:1125`, `:1175`). The wallet path is the only submit
site that omits it.

### Fixes

- **Legacy** — `$form.off('checkout_place_order').submit()`, matching `:869`. Add a
  module-scope `nmiWalletSubmitting` flag checked at the top of the
  `checkout_place_order` handler, so the bypass survives another script re-binding the
  event.
- **Blocks** — replace the `__nmiWalletCallbacks` dispatch with the ref-based flow the
  file already anticipates: set `walletTokenRef.current` / `walletTypeRef.current`,
  then click `.wc-block-components-checkout-place-order-button` so `onPaymentSetup`
  picks the token up at `:414`. Keep the existing error branch as the fallback when the
  button can't be found. Then **`npm run build`** — the bundle is committed.

### Also noted

`nmi_wallet_type` is posted by both checkouts but **read by no PHP anywhere**. Wallet
transactions are therefore indistinguishable from card ones in logs and order meta.
Harmless, but worth wiring into order meta when wallets are made to work.

---

## 5. Defect 3 — ACH (P2)

### 5a. Empty vault ID written on every sale

`src/WC/ACH_Gateway.php:631`:

```php
if (isset($response['customer_vault_id']) || ! empty($response['customer_vault_id'])) {
```

`Service/ACH_Payment_Service::parse_response()` always sets the key on success
(`:352`, `'customer_vault_id' => $response['customer_vault_id'] ?? ''`), so `isset()`
is **always true** and the `||` short-circuits before `!empty()` is ever reached. Every
non-vault ACH sale writes an empty string to `gc_nmi_customer_vault_id_ach` user meta.

**Fix:** `if (! empty($response['customer_vault_id'])) {`

### 5b. Decline messages never shown

`src/WC/ACH_Gateway.php:689` reads `$response['message']`, but the failure branch of
`parse_response()` returns the text under `'error'` (`:361-364`). **Every ACH decline
shows the generic fallback string** instead of NMI's `responsetext`.

**Fix:** read `$response['error']`, falling back to `$response['message']`.

### 5c. Legacy field-name collision between CC and ACH

WooCommerce renders every gateway's `payment_box` into a single `<form>`. Both
templates use the same field names:

| Field | CC | ACH |
|---|---|---|
| `use_save_payment_method` | `template/public/wc-payment-fields.php:77,94,100` | `template/public/wc-ach-payment-fields.php:54,65,71` |
| `save_payment_method` | appended by JS at `ap-nmi-unified-integration.js:863` | `wc-ach-payment-fields.php:152` |
| `payment_token` | appended by JS at `:836` | `wc-ach-payment-fields.php:135` |

Consequences:

- The saved-card radios are **one radio group**. Selecting "Use saved card" in the CC
  box deselects the ACH saved-account radio and vice versa.
- `$_POST['use_save_payment_method']` is ambiguous; with duplicate `payment_token`
  inputs PHP keeps whichever appears last in the document.

The DOM toggling was already patched to be scoped
(`.ap-nmi-saved-card-selection` / `.ap-nmi-saved-ach-selection`), but the **reads never
were** — `ap-nmi-unified-integration.js:976` is unscoped, and the server side is
unscoped by construction.

**Fix:** namespace the ACH field names, updating the template, both ACH JS files, and
the `ACH_Gateway::process_payment` reads at `:472`, `:494`, `:501`, `:516`:

| old | new |
|---|---|
| `use_save_payment_method` | `use_save_payment_method_ach` |
| `save_payment_method` | `save_payment_method_ach` |
| `payment_token` | `ach_payment_token` |

Keep the old keys as read-only fallbacks for one release so an in-flight checkout is
not broken by the deploy. Separately, scope
`ap-nmi-unified-integration.js:976` to `.ap-nmi-saved-card-selection`.

---

## 6. Hardening (P3)

### 6a. Missing fallback registration can drop the whole blocks bundle

`src/WC/NMI_Blocks_Payment_Method.php:45-51` adds **two** new dependencies to the
blocks bundle. Only one of them has the defensive re-registration described in the
comment at `:31-34`:

```php
if (!wp_script_is('nmi-wallet-support', 'registered')) { wp_register_script(...); }
$dependencies = array_merge($asset['dependencies'], [
    'wc-blocks-registry', 'wc-settings',
    'nmi-wallet-support',
    'nmi-checkout-trace'   // <-- no fallback registration
]);
```

`nmi-checkout-trace` is registered only in `enqueue-scripts.php` on
`wp_enqueue_scripts`. WordPress silently refuses to enqueue a script whose dependency
is unregistered, so in any context where that hook has not run (notably the block
editor, which resolves the same handles via
`get_payment_method_script_handles_for_admin()`) the **entire checkout bundle is
dropped** — payment fields, saved-card radios and all.

**Fix:** mirror the `nmi-wallet-support` fallback for `nmi-checkout-trace`, including
the `wp_localize_script` for `apNmiTraceConfig` — otherwise the fallback registers a
trace script with no config.

### 6b. `is_ssl()` behind a TLS-terminating proxy

The new gates at `enqueue-scripts.php:170` and `:221` are correct in principle — the
Payment Request API only exists in a secure context — but `is_ssl()` returns `false` on
hosts that terminate TLS at a load balancer and forward over plain HTTP. On those sites
wallets are now silently disabled.

**Fix:** route both checks through an `apnmi_is_secure_request()` helper filtered via
`apnmi_is_secure_request`, defaulting to `is_ssl()`. That lets such hosts opt in
without patching the plugin, and keeps the trust decision explicit rather than
blanket-trusting `HTTP_X_FORWARDED_PROTO`.

### 6c. Dead guard in `NMI_Process_Payment`

`src/WC/NMI_Process_Payment.php:39` calls `$this->check_payment_token()` and **discards
the return value**, so the "Payment token is missing" guard at `:21-31` is dead code. A
saved-card request that loses its vault ID falls through to the raw-card branch and
errors with "missing required field: ccnumber" instead.

---

## 7. Architectural notes (no action this branch)

### `$_POST['payment_method_data']` is dead on blocks checkout

`src/Gateway.php` reads the blocks shape as
`$_POST['payment_method_data']['payment_token']` (`:520`, `:531`, `:577`, `:587`,
`:614`). WooCommerce never creates that nesting —
`woocommerce/src/StoreApi/Legacy.php:41`:

```php
$_POST = $context->payment_data;   // FLAT key => value
```

So all `payment_method_data` branches are unreachable; blocks works via the flat
`elseif` fallbacks. Two consequences:

- The 3DS extraction block at `src/Gateway.php:614-640` is **dead on blocks
  checkout**, and the legacy fallback at `:644` looks for `threeds_*`-prefixed keys
  that blocks never sends. **3DS data is silently dropped on block checkout.**
- `Checkout_Trace::current_trace_id()` works correctly via its second (flat) branch.

### Saved cards do not use the WooCommerce Payment Tokens API

There is no `WC_Payment_Token_CC`, no `add_payment_method()`, no `tokenization` in
`supports[]`, and no `wc-<gateway_id>-payment-token` key anywhere in either plugin.
Instead there is a hand-rolled **one-saved-card-per-user** scheme on the NMI Customer
Vault, stored in user meta by the enterprise plugin
(`gc_nmi_customer_vault_id_credit_card`). Any future audit should test against the
`use_save_payment_method` / `save_payment_method` / `customer_vault_id` triple, not the
Tokens API.

### Blocks vault + 3DS path is unreachable by construction

`src/blocks/checkout-blocks.js:445` reads `settings.customer_vault_id`, but
`NMI_Blocks_Payment_Method::get_payment_method_data()` computes the vault ID into a
local at `:121` and never returns it. With 3DS enabled and a saved card selected,
blocks always errors "Customer vault ID not found." Legacy has the mirror bug at
`ap-nmi-unified-integration.js:744` and `:989`, which read DOM elements
(`input[name="customer_vault_id"]`, `.ap-nmi-saved-card-info`) that no template
renders.

### Dead wallet code still shipping

Never loaded, but still built by webpack and still misleading to read:

- `assets/js/nmi-apple-pay.js`, `assets/js/nmi-google-pay.js` — zero references
- `src/blocks/apple-pay-blocks.js` + built bundle
- `src/blocks/google-pay-blocks.js` + built bundle
- `src/WC/Blocks/NMI_Apple_Pay_Blocks.php`, `NMI_Google_Pay_Blocks.php` — imported at
  `src/Plugin.php:15-16`, never instantiated

They use contradictory conventions (lowercase `applepay`, a `googlePayMerchantId` key
the live code deliberately omits). Worth deleting in a separate cleanup commit.

### Duplicate orphaned save-card checkbox

`gaincommerce-nmi-enterprise/src/Save_Card_CheckoutField.php:11-25` renders
`name="save_card_checkbox"` on `woocommerce_credit_card_form_end`. Nothing reads it. If
`save_card` is enabled, legacy checkout shows **two** "save card" checkboxes, one inert.

### Cross-plugin coupling

The enterprise plugin depends on the card plugin for: `Gateway::get_instance()` and its
public `public_key` / `private_key` props; `Logger`; `NMI_API_Factory`; `NMI_Base`;
the constants `AP_NMI_WC_GATEWAY_ID` and `AP_NMI_WC_GATEWAY_SETTINGS_ID`; the script
handles `nmi-collectjs`, `ap-nmi-unified-integration`, `ap-nmi-blocks-integration`; and
the hooks `gaincommerce_nmi_process_payment_data`, `gaincommerce_nmi_api_request_data`,
`apnmi_after_prepare_sale_data`, `apnmi_after_payment_success_processed`,
`apnmi_after_payment_complete`.

Two of these are worth flagging:

- `Service/ACH_Payment_Service.php:46` falls back to the option name
  `'woocommerce_apnmi_settings'`, which is **wrong** — the real option is
  `woocommerce_gaincommerce_nmi_settings`. If the constant ever disappears, ACH loads
  an empty settings array and throws "NMI API key not configured".
- `Enqueue/ThreeDS_Scripts.php:81-85` localizes onto `ap-nmi-unified-integration` with
  no `wp_script_is` guard. Renaming that handle would silently kill 3DS on legacy
  checkout.

The ACH plugin's three highest-risk integration points (`nmi-collectjs`,
`ap-nmi-unified-integration`, `ap-nmi-blocks-integration`) all live in
`enqueue-scripts.php` and `NMI_Blocks_Payment_Method.php` — the two files with
uncommitted changes on this branch.

### Housekeeping

- The enterprise repo's `.git/config` contains a GitHub personal access token in
  plaintext. **Rotate it** and move to a credential helper.
- `ach-debug.log` and `test-dev.php` ship in the enterprise plugin root; `test-dev.php`
  auto-includes whenever `GC_NMI_ENTERPRISE_ENV === 'dev'`.
- `ACH_Gateway.php:422` logs the entire `$_POST` at debug level on every ACH payment.

---

## 8. Remediation — all applied 2026-07-28

| # | Defect | Change | Priority |
|---|---|---|---|
| 1 | Legacy saved card dead | `src/Gateway.php` — removed the block that recomputed and overwrote `use_save_payment_method`; the value derived earlier in the method is now authoritative | **P0** |
| 2 | Legacy wallet re-entrancy | `assets/js/ap-nmi-unified-integration.js` — wallet submit now `.off('checkout_place_order')` like the card path, plus an `nmiWalletSubmitting` pass-through guard at the top of the handler | P1 |
| 3 | Blocks wallet no callback | `src/blocks/checkout-blocks.js` — replaced the `__nmiWalletCallbacks` dispatch with the ref-based flow: stash token → click Place Order → `onPaymentSetup` resolves it. Settles an already-pending order directly if one exists. Bundle rebuilt | P1 |
| 4 | ACH empty vault ID | `enterprise/src/WC/ACH_Gateway.php` — `!empty()` only | P2 |
| 5 | ACH decline message | `enterprise/src/WC/ACH_Gateway.php` — reads `error`, falls back to `message` | P2 |
| 6 | CC/ACH field-name collision | ACH fields renamed `use_save_payment_method_ach` / `save_payment_method_ach` / `ach_payment_token` across template, both JS files and the `ACH_Gateway` reads, via a new `read_ach_field()` helper that still accepts the old names for one release. ACH bundle rebuilt | P2 |
| 7 | `nmi-checkout-trace` no fallback | `src/WC/NMI_Blocks_Payment_Method.php` — fallback registration + `apNmiTraceConfig` localize, mirroring `nmi-wallet-support` | P3 |
| 8 | `is_ssl()` behind proxy | New `apnmi_is_secure_request()` helper, filterable via `apnmi_is_secure_request`, used at both call sites | P3 |
| 9 | Dead token guard | `src/WC/NMI_Process_Payment.php` — return value is now used, with an explicit early return for the vault path (a saved card has no token by design) | P3 |

Two extras found while fixing:

- `ap-nmi-ach-integration.js` called `$form.off('checkout_place_order')` before
  submitting. The ACH gateway binds `checkout_place_order_gaincommerce_nmi_ach`, so
  that removed only the **card** plugin's handler, breaking card checkout for the rest
  of the page if the shopper switched back. Its own re-entrancy is already covered by
  an `existingToken` early return, so the call was removed.
- The legacy saved-card read in `ap-nmi-unified-integration.js` was scoped to
  `.ap-nmi-saved-card-selection`, matching the toggling code around it.

Verified: `php -l` clean on all seven modified PHP files, `node --check` clean on both
modified JS files, both webpack builds succeed, and the new strings are present in the
emitted bundles.

**Not yet verified: runtime behaviour.** Everything in §9 still needs to be run.

---

## 9. Verification plan

Enable **WooCommerce → NMI → logging**, load checkout with `?nmi_trace=1`, and read
**WooCommerce → Status → Logs**. Browser and server entries interleave under one trace
id, so a whole attempt can be read as a single timeline.

### Testable locally (HTTP)

| # | Flow | Checkout | Expect |
|---|---|---|---|
| 1 | New card | legacy + blocks | Order paid. `process_payment:token` → `has_token: true`, `use_saved: false`. Regression guard for the timeout fix. |
| 2 | New card + "save my card" | legacy + blocks | Order paid; `gc_nmi_customer_vault_id_credit_card` user meta populated. |
| 3 | **Saved card** | **legacy** | Order paid with no card entry. Log shows `use_saved: true`; NMI request carries `customer_vault_id` and no `payment_token`. **This is the P0 fix.** |
| 4 | Saved card | blocks | Unchanged — still works. |
| 5 | ACH new account | legacy + blocks | Order paid. |
| 6 | ACH saved account, **CC gateway also enabled** | legacy | ACH radio selection no longer flips the CC radio; correct gateway charged. |
| 7 | ACH decline | either | Shopper sees NMI's real `responsetext`. |
| 8 | ACH sale, no vault | either | `gc_nmi_customer_vault_id_ach` **not** written with an empty value. |

### Requires HTTPS + wallet-enabled NMI account (live/staging)

| # | Flow | Expect |
|---|---|---|
| 9 | Apple Pay, Safari, blocks | Sheet opens, tap completes → order paid. Log: `blocks:token:received` with `tokenType: applePay`, then `process_payment:token has_token: true`. **No** `blocks:wallet:no_callback`. |
| 10 | Apple Pay, Safari, legacy | Order paid. **No** "Please enter a valid card number." |
| 11 | Google Pay, Chrome, both checkouts | As above with `tokenType: googlePay`. |
| 12 | Chrome (no Apple Pay), both | Apple Pay button absent, card checkout unaffected, a single `console.info` line only. |

Also confirm on the live server that the Collect.js `<script>` tag carries
`data-tokenization-key`, `data-price`, `data-currency`, `data-country` and
`data-field-apple-pay-selector` — that is the attribute set the deleted enterprise
filter used to race with.
