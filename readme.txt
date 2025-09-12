=== Gain Commerce NMI Payment Gateway for WooCommerce ===
Contributors: allan.casilum, gaincommerce
Tags: nmi, woocommerce, payment gateway, credit card, pci
Requires at least: 6.8
Tested up to: 6.8
Stable tag: 1.7.8
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html
Requires Plugins: woocommerce

Integrates the NMI payment gateway with your WooCommerce store.

== Description ==

**Important Requirements:**
– This plugin only works with WooCommerce version 8.0 or higher
– Only supports WooCommerce HPOS (High-Performance Order Storage)
– Only tested and supported on WordPress 6.8.*

**Compatibility:**
– WooCommerce 8.0+ (HPOS only)
– WordPress 6.8.*

The **Gain Commerce NMI Payment Gateway for WooCommerce** plugin is Free for merchants to accept payments via NMI directly in their WooCommerce store. Maintain control of the checkout process with a seamless and secure checkout experience for customers from your website. Developed with PCI-Compliance at the forefront, this plugin handles every transaction with the highest levels of security through NMI.

= Free Plugin Features Include =
* Easy Integration into WooCommerce: Simple setup after integration for a seamless customer checkout process. 
* Secure Payment Processing: Full PCI-DSS Compliance via the NMI payment gateway. 
* Credit Card Processing: Complete PCI-Compliant Tokenization of payment account data sent via Collect.js.
* Authorize Now, Capture Later: Authorize payments now and Capture payments later.
* Control Card Types: Supports major credit cards and restricts credit card brands as needed.
* Manage Transactions from the WooCommerce dashboard.
* Customizable Settings in WooCommerce Admin.
* Many More Features

== Source Code ==
The source code for the minified JS/CSS is available at:
https://github.com/apysais/gaincommerce-nmi-payment-gateway-for-woocommerce

Build instructions:
1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Run `npm run build` to generate production assets.

== External Services ==

This plugin connects to the NMI payment gateway to process transactions.

– **Service:** NMI Payment Gateway
– **Purpose:** To process credit card payments securely.
– **Data Sent:** Card details (via tokenization), order details.
– **Terms of Service:** https://www.nmi.com/legal/terms
– **Privacy Policy:** https://www.nmi.com/legal/privacy

**When Data Is Sent:**  
Data is transmitted only when a customer submits payment information during checkout.

**Where Data Is Sent:**  
All sensitive data is sent directly to NMI’s secure servers. Your website does not store or process raw payment data.

The plugin loads the NMI Collect.js script for tokenization:
– **Script URL:** https://docs.nmi.com/docs/collectjs
– Collect.js is a PCI-compliant JavaScript library provided by NMI to tokenize payment data in the browser before it reaches your server.

**Conditions:**  
Data is encrypted and tokenized using Collect.js. Only a single-use token is returned to your site for transaction processing.

== Installation ==
1. Upload the plugin files to the `/wp-content/plugins/gaincommerce-nmi-payment-gateway-for-woocommerce` directory, or install the plugin through the WordPress plugins screen directly.
2. Activate the plugin through the 'Plugins' screen in WordPress.
3. Configure the plugin settings in WooCommerce > Settings > Payments > Gain Commerce NMI Payment Gateway.

== Frequently Asked Questions ==
= Does this plugin require an NMI account? =
Yes, you need an active NMI merchant account to use this plugin.

= Does this plugin require WooCommerce? =
Yes, WooCommerce must be installed and active.

= Is this plugin PCI compliant? =
Yes. It uses NMI's Collect.js to tokenize payment data, ensuring that sensitive information never touches your server.

= Is SSL required? =
Yes, SSL is required to ensure secure payment processing.

== Screenshots ==
1. NMI settings page in WooCommerce
2. Checkout page with NMI payment option

== Changelog ==
= 1.7.6 =
* Integrate restrict card type in block checkout
* Integrate restrict card type in legacy checkout
* Integrate collectjs into WC checkout blocks
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