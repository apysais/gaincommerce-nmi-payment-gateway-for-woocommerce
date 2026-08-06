<?php
/**
 * Bootstrap file for testing with real WordPress database
 * This loads your actual WordPress site instead of the test environment
 */

// Load your real WordPress site
require_once '/var/www/html/wordpress-apps/public_html/main/wp-load.php';

// Load Composer autoloader if available
$autoloader = dirname(dirname(__FILE__)) . '/vendor/autoload.php';
if (file_exists($autoloader)) {
    include_once $autoloader;
}

// Make sure our plugin is loaded
if (!function_exists('is_plugin_active')) {
    include_once ABSPATH . 'wp-admin/includes/plugin.php';
}

// Activate our plugin if it's not already active
$plugin_file = basename(dirname(dirname(__FILE__))) . '/gaincommerce-nmi-payment-gateway-for-woocommerce.php';
if (!is_plugin_active($plugin_file)) {
    // Plugin is not active, but we can still test if the file exists
    $plugin_path = dirname(dirname(__FILE__)) . '/gaincommerce-nmi-payment-gateway-for-woocommerce.php';
    if (file_exists($plugin_path)) {
        include_once $plugin_path;
    }
}
