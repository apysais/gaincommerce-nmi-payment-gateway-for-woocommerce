<?php
// If this file is called directly, abort.
if ( ! defined( 'WPINC' ) ) {
	die;
}

add_action('wp_enqueue_scripts', function(){
	$gateway_settings = get_option(AP_NMI_WC_GATEWAY_SETTINGS_ID);

	// Register and enqueue payment monitor first (must load before all other NMI scripts)
	// This intercepts console methods to capture logs for mobile debugging
	if ( function_exists('is_checkout') && is_checkout() ) {
		wp_register_script(
			'nmi-payment-monitor',
			apnmi_get_plugin_dir_url() . 'assets/js/nmi-payment-monitor.js',
			[],
			AP_NMI_PAYMENT_GATEWAY_VERSION,
			false // Load in head to intercept console before other scripts
		);
		wp_enqueue_script('nmi-payment-monitor');

		wp_register_style(
			'nmi-payment-monitor',
			apnmi_get_plugin_dir_url() . 'assets/css/nmi-payment-monitor.css',
			[],
			AP_NMI_PAYMENT_GATEWAY_VERSION
		);
		wp_enqueue_style('nmi-payment-monitor');
	}

	// Always use production CollectJS URL (tokenization library)
	// The API key determines which environment tokens are valid in
	wp_register_script(
		'nmi-collectjs',
		'https://secure.nmi.com/token/Collect.js',
		[],
		AP_NMI_PAYMENT_GATEWAY_VERSION,
		false
	);
	
	wp_register_script(
		'ap-nmi-unified-integration', 
		apnmi_get_plugin_dir_url() . 'assets/js/ap-nmi-unified-integration.js', 
		['jquery', 'nmi-collectjs'], 
		AP_NMI_PAYMENT_GATEWAY_VERSION, 
		true
	);

	wp_localize_script(
		'ap-nmi-unified-integration',
		'ap_nmi_params',
		[
			'public_key'          => isset($gateway_settings['public_key']) ? $gateway_settings['public_key'] : '',
			'ajax_url'            => admin_url('admin-ajax.php'),
			'nonce'               => wp_create_nonce('ap_nmi_nonce'),
			'is_blocks_checkout'  => has_block('woocommerce/checkout') ? 'yes' : 'no',
			'ap_nmi_gateway_id'   => AP_NMI_WC_GATEWAY_ID,
			'gateway_config'      => $gateway_settings,
			'is_checkout_page'    => is_checkout() ? 1 : 0,
			// Digital wallet params — used by the unified CollectJS configure call
			'apple_pay_enabled'   => class_exists('APNMIPaymentGateway\Settings\Digital_Wallet_Settings')
				&& \APNMIPaymentGateway\Settings\Digital_Wallet_Settings::is_apple_pay_enabled() ? 'yes' : 'no',
			'google_pay_enabled'  => class_exists('APNMIPaymentGateway\Settings\Digital_Wallet_Settings')
				&& \APNMIPaymentGateway\Settings\Digital_Wallet_Settings::is_google_pay_enabled() ? 'yes' : 'no',
			'apple_merchant_id'   => class_exists('APNMIPaymentGateway\Settings\Digital_Wallet_Settings')
				? \APNMIPaymentGateway\Settings\Digital_Wallet_Settings::get_apple_merchant_id() : '',
			'google_merchant_id'  => class_exists('APNMIPaymentGateway\Settings\Digital_Wallet_Settings')
				? \APNMIPaymentGateway\Settings\Digital_Wallet_Settings::get_google_merchant_id() : '',
			// Google Pay requires country, currency, and price at the top level of CollectJS.configure()
			'country'             => strtoupper( substr( get_option( 'woocommerce_default_country', 'US' ), 0, 2 ) ),
			'currency'            => get_woocommerce_currency(),
			'cart_total'          => WC()->cart ? number_format( (float) WC()->cart->get_total( 'edit' ), 2, '.', '' ) : '0.00',
		]
	);

	wp_register_style('ap-nmi-unified-styles', apnmi_get_plugin_dir_url() . 'assets/css/ap-nmi-unified-styles.css', [], AP_NMI_PAYMENT_GATEWAY_VERSION);

	// Wallet scripts are included via the unified CollectJS configure in ap-nmi-unified-integration.js
});

// Add the data-tokenization-key attribute to the CollectJS script tag.
// Guard against duplicates: the enterprise plugin (when active) runs its own
// script_loader_tag filter on the same handle. Whichever filter runs first
// adds the attribute; the second one skips.
add_filter('script_loader_tag', function($tag, $handle) {
	if ('nmi-collectjs' !== $handle) {
		return $tag;
	}
	// Already handled (e.g. by the enterprise plugin's filter).
	if (strpos($tag, 'data-tokenization-key') !== false) {
		return $tag;
	}
	$gateway_settings = get_option(AP_NMI_WC_GATEWAY_SETTINGS_ID);
	if (empty($gateway_settings['public_key'])) {
		return $tag;
	}
	// Replace the full src attribute (including any ?ver=... suffix) and inject
	// the tokenization key. Using preg_replace avoids the orphaned-quote bug
	// that str_replace on a partial string produces.
	$tag = preg_replace(
		'|src="https://secure\.nmi\.com/token/Collect\.js[^"]*"|',
		'src="https://secure.nmi.com/token/Collect.js" data-tokenization-key="' . esc_attr($gateway_settings['public_key']) . '"',
		$tag
	);

	// Apple Pay and Google Pay require data-price, data-country, data-currency on
	// the Collect.js script tag so CollectJS can build the PaymentRequest.
	$apple_pay_enabled = class_exists('APNMIPaymentGateway\Settings\Digital_Wallet_Settings')
		&& \APNMIPaymentGateway\Settings\Digital_Wallet_Settings::is_apple_pay_enabled();
	$wallets_enabled = $apple_pay_enabled
		|| ( class_exists('APNMIPaymentGateway\Settings\Digital_Wallet_Settings')
		  && \APNMIPaymentGateway\Settings\Digital_Wallet_Settings::is_google_pay_enabled() );

	if ( $wallets_enabled && function_exists('is_checkout') && is_checkout() ) {
		$price    = ( function_exists('WC') && WC()->cart )
			? number_format( (float) WC()->cart->get_total('edit'), 2, '.', '' )
			: '0.00';
		$currency = get_woocommerce_currency();
		$country  = function_exists('WC') && WC()->countries
			? WC()->countries->get_base_country()
			: 'US';

		$extra_attrs = 'data-price="' . esc_attr($price) . '" data-currency="' . esc_attr($currency) . '" data-country="' . esc_attr($country) . '"';

		// Per NMI's docs (docs.nmi.com/docs/digital-wallet-setup), Apple Pay is
		// configured entirely via data-field-apple-pay-* attributes on this script
		// tag — there is no CollectJS.configure({fields:{applepay:{...}}}) for it.
		// Without data-field-apple-pay-selector, CollectJS never learns where to
		// render the button, so it silently renders nothing (no error, no timeout).
		if ( $apple_pay_enabled ) {
			$apple_pay_selector = has_block('woocommerce/checkout')
				? '#nmi-apple-pay-button-blocks'
				: '#nmi-apple-pay-express';
			$extra_attrs .= ' data-field-apple-pay-selector="' . esc_attr($apple_pay_selector) . '"';
		}

		$tag = str_replace(
			'data-tokenization-key=',
			$extra_attrs . ' data-tokenization-key=',
			$tag
		);
	}

	return $tag;
}, 100, 2);

// On checkout pages, grant the Payment Request API (used by Apple Pay / Google Pay)
// to any CollectJS iframe, regardless of origin.
// Without this, Safari blocks the payment feature inside the iframe and Apple Pay
// silently fails with "Feature policy 'Payment' check failed".
// NOTE: previously scoped to "https://collectcheckout.com", a domain that doesn't
// appear anywhere else in the NMI integration and was never verified against the
// actual CollectJS iframe origin — widened to * until the real origin is confirmed
// (see doc/07-20-2026-2149-v2-fix-apple-pay.md).
add_action('send_headers', function() {
	if ( ! function_exists('is_checkout') || ! is_checkout() ) {
		return;
	}
	// Allow Payment Request API for self (the checkout page) and any CollectJS iframe.
	header('Permissions-Policy: payment=(self *)');
});