<?php
// If this file is called directly, abort.
if ( ! defined( 'WPINC' ) ) {
	die;
}

add_action('wp_enqueue_scripts', function(){
	$gateway_settings = get_option(AP_NMI_WC_GATEWAY_SETTINGS_ID);

	// Register and enqueue payment monitor first (must load before all other NMI scripts)
	// This intercepts console methods to capture logs for mobile debugging.
	// Off by default — only load when explicitly enabled in gateway settings.
	if ( function_exists('is_checkout') && is_checkout()
		&& ($gateway_settings['enable_debug_console'] ?? 'no') === 'yes' ) {
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

	// TEMPORARY DIAGNOSTIC: CollectJS postMessage tap, for tracking down tokenization
	// stalls. Opt-in per request via ?nmi_trace=1 on the checkout URL. Must load in
	// <head> ahead of Collect.js so it sees the field-mount messages too.
	// Remove this block together with assets/js/nmi-collectjs-trace.js.
	if ( ! empty($_GET['nmi_trace']) && function_exists('is_checkout') && is_checkout() ) {
		wp_register_script(
			'nmi-collectjs-trace',
			apnmi_get_plugin_dir_url() . 'assets/js/nmi-collectjs-trace.js',
			['nmi-checkout-trace'],
			AP_NMI_PAYMENT_GATEWAY_VERSION,
			false // <head>, before Collect.js
		);
		wp_enqueue_script('nmi-collectjs-trace');
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
	
	// Correlated checkout tracing: console + WooCommerce log, shared by both checkouts.
	// Registered unconditionally so window.NMITrace always exists; it only mirrors to
	// the WC log when the gateway's "logging" setting is on. Loaded in <head> so it is
	// available to every later script.
	wp_register_script(
		'nmi-checkout-trace',
		apnmi_get_plugin_dir_url() . 'assets/js/nmi-checkout-trace.js',
		[],
		AP_NMI_PAYMENT_GATEWAY_VERSION,
		false
	);
	wp_localize_script(
		'nmi-checkout-trace',
		'apNmiTraceConfig',
		[
			'enabled'  => \APNMIPaymentGateway\Checkout_Trace::is_enabled(),
			'ajaxUrl'  => admin_url('admin-ajax.php'),
			'nonce'    => wp_create_nonce('ap_nmi_nonce'),
			'action'   => \APNMIPaymentGateway\Checkout_Trace::AJAX_ACTION,
			'field'    => \APNMIPaymentGateway\Checkout_Trace::FIELD,
		]
	);
	wp_enqueue_script('nmi-checkout-trace');

	// Digital wallet precondition checks, shared by the legacy and blocks checkouts.
	wp_register_script(
		'nmi-wallet-support',
		apnmi_get_plugin_dir_url() . 'assets/js/nmi-wallet-support.js',
		[],
		AP_NMI_PAYMENT_GATEWAY_VERSION,
		true
	);

	wp_register_script(
		'ap-nmi-unified-integration',
		apnmi_get_plugin_dir_url() . 'assets/js/ap-nmi-unified-integration.js',
		['jquery', 'nmi-collectjs', 'nmi-wallet-support', 'nmi-checkout-trace'],
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

	// Both wallets require a secure context. Emitting the wallet attributes over plain
	// HTTP makes CollectJS build wallet fields that can only fail: Google Pay's
	// isReadyToPay throws DEVELOPER_ERROR, and ApplePayFieldFactory logs a domain error
	// as soon as data-field-apple-pay-selector matches an element. Skipping the
	// attributes leaves CollectJS on its unmatched default selector (#applepaybutton),
	// where getApplePayErrors() returns early with no error at all.
	if ( $wallets_enabled && function_exists('is_checkout') && is_checkout() && apnmi_is_secure_request() ) {
		$price    = ( function_exists('WC') && WC()->cart )
			? number_format( (float) WC()->cart->get_total('edit'), 2, '.', '' )
			: '0.00';
		$currency = get_woocommerce_currency();
		$country  = function_exists('WC') && WC()->countries
			? WC()->countries->get_base_country()
			: 'US';

		$extra_attrs = 'data-price="' . esc_attr($price) . '" data-currency="' . esc_attr($currency) . '" data-country="' . esc_attr($country) . '"';

		// Apple Pay's selector can come from either this data attribute or
		// CollectJS.configure({fields:{applePay:{selector}}}) — Config.js reads the
		// data attribute as the default and configure() overrides it. Note the key is
		// camelCase `applePay`; the lowercase `applepay` this integration used to pass
		// was silently ignored, which is why this attribute was added as a workaround.
		// Both now point at the same selector, so they agree.
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
// to the CollectJS wallet iframe.
// Without this, Safari blocks the payment feature inside the iframe and Apple Pay
// silently fails with "Feature policy 'Payment' check failed".
//
// The origin IS https://collectcheckout.com — confirmed in the Collect.js bundle:
// URLParser.googlePayIFrameRootUrl and URLParser.applePayIFrameRootUrl both return
// that host for every environment except NMI's own internal dev hosts. An earlier
// note in this file claimed the domain was unverified and widened the allowlist to
// `*`; that was wrong, and `*` inside a parenthesised allowlist is not valid
// Permissions-Policy syntax anyway.
add_action('send_headers', function() {
	if ( ! function_exists('is_checkout') || ! is_checkout() ) {
		return;
	}
	// The Payment Request API is only available in a secure context, so there is
	// nothing to grant over plain HTTP.
	if ( ! apnmi_is_secure_request() ) {
		return;
	}
	header('Permissions-Policy: payment=(self "https://collectcheckout.com")');
});