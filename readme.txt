=== Gain Commerce NMI Payment Gateway for WooCommerce ===
Contributors: allan.casilum, gaincommerce
Tags: woocommerce, payment gateway, nmi, credit card
Requires at least: 6.8
Tested up to: 6.8
Stable tag: 1.7.7
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html
Requires Plugins: woocommerce

Integrates the NMI payment gateway with your WooCommerce store.

== Description ==

**Important Requirements:**
- This plugin only works with WooCommerce version 8.0 or higher
- Only supports WooCommerce HPOS (High-Performance Order Storage)
- Only tested and supported on WordPress 6.8.*

**Compatibility:**
- WooCommerce 8.0+ (HPOS only)
- WordPress 6.8.*

This plugin enables merchants to accept payments via NMI directly on their WooCommerce store. It provides a seamless and secure checkout experience for customers.

= Features =
* Easy integration with WooCommerce
* Secure payment processing via NMI
* Supports major credit and debit cards
* Customizable settings in WooCommerce admin

== Source Code ==
The source code for the minified JS/CSS is available at:
https://github.com/apysais/gaincommerce-nmi-payment-gateway-for-woocommerce

Build instructions:
1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Run `npm run build` to generate production assets.

== External Services ==
This plugin connects to the NMI payment gateway to process transactions.

- **Service:** NMI Payment Gateway
- **Purpose:** To process credit card payments securely.
- **Data Sent:** Card details (via tokenization), order details.
- **Terms of Service:** https://www.nmi.com/legal/terms
- **Privacy Policy:** https://www.nmi.com/legal/privacy

The plugin also loads the NMI Collect.js script for tokenization:
- **Script URL:** https://secure.nmi.com/token/Collect.js

== Installation ==
1. Upload the plugin files to the `/wp-content/plugins/gaincommerce-nmi-payment-gateway-for-woocommerce` directory, or install the plugin through the WordPress plugins screen directly.
2. Activate the plugin through the 'Plugins' screen in WordPress.
3. Configure the plugin settings in WooCommerce > Settings > Payments > Gain Commerce NMI Payment Gateway.

== Frequently Asked Questions ==
= Does this plugin require an NMI account? =
Yes, you need an active NMI merchant account to use this plugin.

= Does this plugin require WooCommerce? =
Yes, WooCommerce must be installed and active.

= Is SSL required? =
Yes, SSL is required to ensure secure payment processing.

== Screenshots ==
1. NMI settings page in WooCommerce
2. Checkout page with NMI payment option

== Changelog ==
= 1.7.6 =
* Integrate restrict card type in block checkout
* Integrate restrict card type in legacy checkout
* Integrate collectjs into wc nami blocks
* Integrate WC blocks
* Add CollectJS to legacy checkout
* WooCommerce Legacy checkout work on NMI
* Add Auth Feature and when changed to order processing or complete then capture
* Add Gateway Class
* Add Logger Class
* Add API class for NMI
* Add API Factory
* Add API Credit Card Sale
* Add API Refund
* Add API Void
* Add API Auth, Capture and Auth + Capture

= 1.0.0 =
* Initial release

== Upgrade Notice ==
= 1.0.0 =
Initial release of Gain Commerce NMI Payment Gateway for WooCommerce plugin.