=== Gain Commerce NMI Payment Gateway for WooCommerce ===
Contributors: allan.casilum, gaincommerce
Tags: nmi, woocommerce, payment gateway, credit card, checkout
Requires at least: 6.8
Tested up to: 7.0.1
Stable tag: 1.15.1
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html
Requires Plugins: woocommerce

PCI-compliant NMI payment gateway integration for WooCommerce. Accept credit cards, Apple Pay, and Google Pay with full HPOS support.

== Description ==

The <strong>Gain Commerce NMI Payment Gateway for WooCommerce</strong> is a secure, flexible payment processing plugin for your WooCommerce store. Built with full support for WooCommerce Checkout Blocks and High-Performance Order Storage (HPOS), this plugin provides a seamless checkout experience. 

Achieve top-tier security with full PCI-DSS Compliance through the NMI payment gateway, utilizing Collect.js for safe data tokenization that keeps sensitive card data off your server.

Merchants gain essential features like Authorize Now and Capture Later, easy refunds, and voids—all managed directly from your WooCommerce dashboard. Accept major credit cards, Apple Pay, Google Pay, and utilize Dynamic Descriptors and AVS/CVV response logging to protect your business.

### Free Plugin Features
* <strong>Easy WooCommerce Integration:</strong> Seamless customer checkout experience.
* <strong>PCI-DSS Compliant:</strong> Uses NMI <a href="https://docs.nmi.com/docs/collectjs/" target="_blank">Collect.js</a> for secure browser tokenization.
* <strong>Digital Wallets:</strong> Accept Apple Pay and Google Pay during checkout.
* <strong>Customer Vault:</strong> Secure remote storage for customer card data.
* <strong>Dashboard Management:</strong> Authorize, Capture, Refund, and Void transactions inside WooCommerce.
* <strong>Card Brand Control:</strong> Accept or restrict specific credit card brands.
* <strong>Fraud Prevention:</strong> Record AVS/CVV response codes directly in order notes.
* <strong>Dynamic Descriptors:</strong> Pass custom descriptors to customer credit card statements.
* <strong>Order Ledger Data:</strong> Automatically send WooCommerce shipping info to the NMI ledger.
* <strong>Developer Logging:</strong> Built-in debug logging to troubleshoot issues quickly.

### Premium Plugin Features
* <strong>ACH Payments:</strong> Accept electronic check transfers through the ACH network.
* <strong>Stored Payment Methods:</strong> Allow returning customers to select saved cards/ACH accounts from the Customer Vault.
* <strong>3D Secure 2 (3DS2):</strong> Advanced fraud prevention; fully PSD2 / SCA compliant.
* <strong>WooCommerce Subscriptions:</strong> Full compatibility for automatic recurring payments.

== System Requirements ==
* Active NMI payment gateway account
* WooCommerce version 8.0 or higher.
* WooCommerce HPOS (High-Performance Order Storage)
* Valid SSL Certificate

== Source Code ==
The source code for the minified JS/CSS is available at: 
<a href="https://github.com/apysais/gaincommerce-nmi-payment-gateway-for-woocommerce/" target="_blank">Gain Commerce NMI GitHub Repository</a>

Build instructions:
1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Run `npm run build` to generate production assets.

== External Services ==
This plugin connects to the NMI payment gateway to process transactions.

* <strong>Service:</strong> <a href="https://www.nmi.com/" target="_blank">NMI Payment Gateway</a>
* <strong>Purpose:</strong> Process credit card payments securely.
* <strong>Data Sent:</strong> Encrypted card tokens, order details, and shipping info.
* <a href="https://www.nmi.com/legal/terms/" target="_blank">Terms of Service</a> | <a href="https://www.nmi.com/legal/privacy/" target="_blank">Privacy Policy</a>

**Tokenization via Collect.js:**
The plugin loads NMI's browser script (`https://docs.nmi.com/docs/collectjs`) during checkout to tokenize payment details before data reaches your server.

== Installation ==
1. Upload the plugin files to the `/wp-content/plugins/gaincommerce-nmi-payment-gateway-for-woocommerce` directory, or install the plugin through the WordPress plugins screen directly.
2. Activate the plugin through the 'Plugins' screen in WordPress.
3. Configure the plugin settings in WooCommerce > Settings > Payments > Gain Commerce NMI Payment Gateway.

== Frequently Asked Questions ==

= Is this plugin PCI Compliant? =
Yes. Utilizing NMI's Collect.js to tokenize payment data, sensitive credit card information never touches your web server.

= Does this plugin require WooCommerce? =
Yes. WooCommerce 8.0 or higher must be installed and active.

= Does this plugin require an NMI account? = 
Yes. An active NMI payment gateway account is required. Contact <a href="https://www.alliedpayments.com" target="_blank">Allied Payments</a>, our preferred provider, to set up your account.

= Is an SSL Certificate required? = 
Yes. A valid SSL certificate is required to meet PCI-DSS compliance standards and secure user checkout.

= Does this plugin store customer credit card details? =
No. Credit card numbers are tokenized by NMI and stored remotely in the NMI Customer Vault.

= Where can I get support or integration help? =
Visit <a href="https://www.gaincommerce.com/support" target="_blank">gaincommerce.com/support</a>.

== Screenshots ==
1. WooCommerce Checkout Page layout
2. Gain Commerce/NMI settings page in WooCommerce
3. WooCommerce Order Notes displaying AVS, CVV, Confirmation, and Error codes from NMI.
4. Dynamic Descriptor settings in WooCommerce (when enabled in NMI)

== Changelog ==

= 1.15.1 =
* Fix issue in NMI timeout

= 1.14.8 =
* Support NMI Digital wallet payment, Google Pay and Apple Pay.

= 1.13.1 =
* Add WooCommerce Subscriptions support for automatic recurring payments. Requires WooCommerce Subscriptions plugin and Premium Add-on.
* Maintenance

= 1.12.0 =
* Fix checkout issue in loading NMI in legacy and block base.
* Fix UI fields in checkout page both in legacy and block base.
* Maintenance.

= 1.11.0 =
* Added support for 3D Secure (3DS) authentication when the Premium Add-on plugin is installed. The free plugin now enables 3DS for enhanced security, but requires the Premium plugin to activate this feature.

= 1.10.0 =
* Fix and replace deprecated reduced_stock_qty to wc_reduce_stock_levels
* Add ability for customers to store payment method for future transactions in card vault by choosing “Save Payment Method” during checkout. Available only in Premium Plugin
* Choose "Saved Payment Method" stores card account in secure PCI-Compliant environment. Customer can replace card in checkout process by choosing “Save Payment Method”.
* Test to latest WooCommerce version 10.4.3

= 1.8.1 =
* Test to latest WordPress 6.9 version.
* Test to latest WooCommerce 10.4.2
* Add Description for premium plugin in readme file.

= 1.8.0 =
* Add Shipping Fields from WooCommerce order to NMI merchants.
* Ability to enable Dynamic Descriptor and pass descriptor data.
* Add AVS/CVV notes in order.
* Add additional order notes as Response code and NMI payment status.

= 1.7.6 =
* Integrate restrict card type in block checkout
* Integrate restrict card type in legacy checkout
* Integrate CollectJS into WC checkout blocks
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
