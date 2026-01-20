<?php
/**
 * Plugin Name: Gain Commerce NMI Payment Gateway for WooCommerce
 * Description: WooCommerce payment gateway using NMI. Compatible with WooCommerce 8+ (HPOS only) and WordPress 6.8.*
 * Version: 1.10.0
 * Requires at least: 6.8
 * Tested up to: 6.9
 * Requires PHP: 7.4
 * Requires Plugins: woocommerce
 * Author: gaincommerce
 * Author URI: https://www.gaincommerce.com
 * Text Domain: gaincommerce-nmi-payment-gateway-for-woocommerce
 * Domain Path: /languages
 * WC requires at least: 8.0
 * WC tested up to: 10.4.2
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('AP_NMI_PAYMENT_GATEWAY_VERSION', '1.10.0');
define('AP_NMI_PAYMENT_GATEWAY_PLUGIN_FILE', __FILE__);
define('AP_NMI_PAYMENT_GATEWAY_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('AP_NMI_PAYMENT_GATEWAY_PLUGIN_URL', plugin_dir_url(__FILE__));
define('AP_NMI_PAYMENT_GATEWAY_PLUGIN_BASENAME', plugin_basename(__FILE__));

define('AP_NMI_PAYMENT_GATEWAY_USE_COLLECT_JS', true);
define('AP_NMI_WC_META_DATA_TRANSACTION_ID', '_gaincommerce_nmi_transaction_id');
define('AP_NMI_WC_META_DATA_AUTH_AMOUNT', '_gaincommerce_nmi_auth_amount');
define('AP_NMI_WC_META_DATA_TRANSACTION_MODE', '_gaincommerce_nmi_transaction_mode');
define('AP_NMI_WC_GATEWAY_ID', 'gaincommerce_nmi');
define('AP_NMI_WC_GATEWAY_SETTINGS_ID', 'woocommerce_' . AP_NMI_WC_GATEWAY_ID . '_settings');
/**
 * The code that runs during plugin activation.
 * This action is documented in includes/class-ac-web-app-activator.php
 */
function apnmi_activate() {

}

/**
 * The code that runs during plugin deactivation.
 * This action is documented in includes/class-ac-web-app-deactivator.php
 */
function apnmi_deactivate() {
	
}

register_activation_hook( __FILE__, 'apnmi_activate' );
register_deactivation_hook( __FILE__, 'apnmi_deactivate' );

// Require Composer autoloader
if (file_exists(AP_NMI_PAYMENT_GATEWAY_PLUGIN_DIR . 'vendor/autoload.php')) {
    require_once AP_NMI_PAYMENT_GATEWAY_PLUGIN_DIR . 'vendor/autoload.php';
}

require_once plugin_dir_path( __FILE__ ) . 'includes/functions/helper.php'; // Load helper functions
require_once plugin_dir_path( __FILE__ ) . 'define.php';
require_once plugin_dir_path( __FILE__ ) . 'enqueue-scripts.php'; // Load the script enqueue file

function apnmi_get_plugin_details(){
	// Check if get_plugins() function exists. This is required on the front end of the
	// site, since it is in a file that is normally only loaded in the admin.
	if ( ! function_exists( 'get_plugins' ) ) {
		require_once ABSPATH . 'wp-admin/includes/plugin.php';
	}
	$ret = get_plugin_data( __FILE__ );
	return $ret;
}

/**
 * Get the plugin name.
 *
 * @return string
 */
function apnmi_get_text_domain(): string{
	$ret = apnmi_get_plugin_details();
	return $ret['TextDomain'];
}

function apnmi_get_plugin_version(): string {
	$ret = apnmi_get_plugin_details();
	return $ret['Version'];
}

/**
 * Get the plugin base directory
 */
function apnmi_get_plugin_dir(): string{
	return plugin_dir_path( __FILE__ );
}

/**
* get the plugin url path.
**/
function apnmi_get_plugin_dir_url(): string {
	return plugin_dir_url( __FILE__ );
}

function run_apnmi()
{
	// Check if WooCommerce is active
    if (!class_exists('WooCommerce')) {
        add_action('admin_notices', function () {
            echo '<div class="notice notice-error"><p>';
            echo esc_html__(
                'AP NMI Payment Gateway requires WooCommerce to be installed and activated.',
                'gaincommerce-nmi-payment-gateway-for-woocommerce'
            );
            echo '</p></div>';
        });
        return;
    }

	//Initialize the plugin
	\APNMIPaymentGateway\Plugin::get_instance();
	\APNMIPaymentGateway\WC\NMI_Capture_Payment::get_instance()->init_hook();

	// Add HPOS compatibility
	add_action('before_woocommerce_init', function() {
		if (class_exists(\Automattic\WooCommerce\Utilities\FeaturesUtil::class)) {
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('custom_order_tables', __FILE__, true);
		}
	});
}

add_action('plugins_loaded', 'run_apnmi');
