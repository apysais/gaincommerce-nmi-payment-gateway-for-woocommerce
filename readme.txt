=== Gain Commerce NMI Payment Gateway for WooCommerce ===
Contributors: allan.casilum, gaincommerce
Tags: nmi, woocommerce, payment gateway, credit card, pci
Requires at least: 6.8
Tested up to: 6.8
Stable tag: 1.7.8
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html
Requires Plugins: woocommerce

PCI-compliant payment gateway integration between NMI and WooCommerce. Seamlessly accept e-commerce credit card payments through WooCommerce stores.

== Description ==

The <strong>Gain Commerce NMI Payment Gateway for WooCommerce</strong> is the premier free NMI plugin for secure, flexible credit card processing on your WooCommerce store. This plugin offers easy integration into WooCommerce</strong> to create a seamless customer checkout experience. Achieve top-tier security with full PCI-DSS Compliance through the NMI payment gateway, utilizing Collect.js for safe data tokenization that keeps sensitive card data off your server. 

Merchants gain essential features like the Authorize Now and Capture Later flexibility, easy refunds managed from the WooCommerce dashboard, and the ability to control accepted card types. The plugin also supports advanced features such as Dynamic Descriptors and records AVS/CVV response codes. Streamline your transaction management with a reliable, feature-rich gateway plugin from Gain Commerce.

<strong>Free Plugin Version Includes</strong>
=
* <strong>Easy Integration</strong> into WooCommerce for a seamless customer checkout process. 
* <strong>Secure Payment Processing</strong> with full PCI-DSS Compliance via the NMI payment gateway.
* <strong>Credit Card Processing</strong> managed entirely by NMI with data tokenization through <a href="https://docs.nmi.com/docs/collectjs/" target="_blank">Collect.js</a>  
* <strong>Manage Transactions</strong> from the WooCommerce dashboard.
* <strong>Customizable Settings</strong> in the WooCommerce admin.
* <strong>Control Card Types</strong> to accept or restrict all major credit card brands, as needed.
* <strong>Receipts</strong> from the WooCommerce dashboard through NMI.
* <strong>Refunds</strong> from the WooCommerce dashboard.
* <strong>AVS/CVV Response Codes</strong> recorded in order notes.
* <strong>Dynamic Descriptors</strong> available for merchants requiring variable descriptors on customer statements.
* <strong>Authorize Now and Capture Later</strong> flexibility for transactions occurring at a later date.
* <strong>Shipping Info</strong> sent to NMI transaction ledger.
* <strong>AVS/CVV Response Codes</strong> recorded in order notes.
* <strong>Logging</strong> to detect and fix errors or issues.


<strong>Important Requirements:</strong>
=
* Active NMI account
* WooCommerce version 8.0 or higher.
* WooCommerce HPOS (High-Performance Order Storage)
* WordPress 6.8.*

<strong>Compatibility:</strong>
=
* WooCommerce 8.0+ (HPOS only)
* WordPress 6.8.*

== Source Code ==
The source code for the minified JS/CSS is available at: 
<a href="https://github.com/apysais/gaincommerce-nmi-payment-gateway-for-woocommerce/" target="_blank">Gain Commerce NMI Payment Gateway for WooCommerce</a>


Build instructions:
1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Run `npm run build` to generate production assets.

== External Services ==
This plugin connects to the NMI payment gateway to process transactions.

* Service: <a href="https://www.nmi.com/" target="_blank">NMI Payment Gateway</a>
* Purpose: To process credit card payments securely.
* Data Sent: Card details (via tokenization), order details.
* <a href="https://www.nmi.com/legal/terms/" target="_blank">Terms of Service</a>
* <a href="https://www.nmi.com/legal/privacy/" target="_blank">Privacy Policy</a>

**When Data Is Sent:**  
Data is transmitted only when a customer submits payment information during checkout.

**Where Data Is Sent:**  
All sensitive data is sent directly to NMI’s secure servers. Your website does not store or process raw payment data.

The plugin loads the NMI Collect.js script for tokenization: 
=
* Script URL:</strong> <a href="https://docs.nmi.com/docs/collectjs" target="_blank">https://docs.nmi.com/docs/collectjs</a>
* Collect.js is a PCI-compliant JavaScript library provided by NMI to tokenize payment data in the browser before it reaches your server.

**Conditions:**  
Data is encrypted and tokenized using Collect.js. Only a single-use token is returned to your site for transaction processing.

== Installation ==
1. Upload the plugin files to the `/wp-content/plugins/gaincommerce-nmi-payment-gateway-for-woocommerce` directory, or install the plugin through the WordPress plugins screen directly.
2. Activate the plugin through the 'Plugins' screen in WordPress.
3. Configure the plugin settings in WooCommerce > Settings > Payments > Gain Commerce NMI Payment Gateway.

== Frequently Asked Questions ==
= Is this plugin PCI Compliant? =
Yes. Utilizing NMI's Collect.js to tokenize payment data, sensitive information never touches merchant servers.

= Does this plugin require WooCommerce? =
Yes. WooCommerce 6.8 or higher must be installed and active.

= Does this plugin require a Network Merchants account? = 
Yes. An active payment gateway account at NMI is required.  <a href="https://www.alliedpay.com" target="_blank">Allied Payments</a>, our preferred provider, can help set up accounts.

= Is an SSL required? = 
Yes. A valid SSL certificate is required to protect customer credit card account information and is a requirement for PCI-DSS compliance. 

 = What information is passed to NMI? =
Payment account information is only transferred through tokenization to maintain absolute PCI Compliance. No sensitive payment information is sent unsecured.

 = Does this plugin store customer information? =
No. This plugin does not store any customer credit card numbers or personal customer information.

 = For additional integration information and support =
Visit <a href="https://www.gaincommerce.com/support" target="_blank">gaincommerce.com/support</a>.

== Screenshots ==
1. WooCommerce Checkout Page layout
2. Gain Commerce/NMI settings page in WooCommerce
3. WooCommerce Order Notes displaying AVS, CVV, Confirmation, and Error codes from NMI.
4. Dynamic Descriptor settings in WooCommerce (when enabled in NMI)


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

= Additional Information Required =
Visit our support page at <a href="https://www.gaincommerce.com/support" target="_blank">Gain Commerce</a>