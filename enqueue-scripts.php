<?php
// If this file is called directly, abort.
if ( ! defined( 'WPINC' ) ) {
	die;
}

add_action('wp_enqueue_scripts', function(){
	$gateway_settings = get_option(AP_NMI_WC_GATEWAY_SETTINGS_ID);

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
			'public_key' => isset($gateway_settings['public_key']) ? $gateway_settings['public_key'] : '',
			'ajax_url' => admin_url('admin-ajax.php'),
			'nonce' => wp_create_nonce('ap_nmi_nonce'),
			'is_blocks_checkout' => has_block('woocommerce/checkout') ? 'yes' : 'no',
			'ap_nmi_gateway_id' => AP_NMI_WC_GATEWAY_ID,
			'gateway_config' => $gateway_settings,
			'is_checkout_page' => is_checkout() ? 1 : 0,
		]
	);

	wp_register_style('ap-nmi-unified-styles', apnmi_get_plugin_dir_url() . 'assets/css/ap-nmi-unified-styles.css', [], AP_NMI_PAYMENT_GATEWAY_VERSION);

	// ── Digital Wallet Scripts (checkout page only, legacy checkout only) ──────
	if ( is_checkout() && ! is_order_received_page() ) {

		$apple_pay_enabled  = class_exists('APNMIPaymentGateway\Settings\Digital_Wallet_Settings')
			&& \APNMIPaymentGateway\Settings\Digital_Wallet_Settings::is_apple_pay_enabled();
		$google_pay_enabled = class_exists('APNMIPaymentGateway\Settings\Digital_Wallet_Settings')
			&& \APNMIPaymentGateway\Settings\Digital_Wallet_Settings::is_google_pay_enabled();

		if ( $apple_pay_enabled ) {
			wp_register_script(
				'nmi-apple-pay',
				apnmi_get_plugin_dir_url() . 'assets/js/nmi-apple-pay.js',
				[ 'jquery', 'nmi-collectjs' ],
				AP_NMI_PAYMENT_GATEWAY_VERSION,
				true
			);
			wp_localize_script(
				'nmi-apple-pay',
				'ap_nmi_apple_pay_params',
				[
					'apple_merchant_id' => \APNMIPaymentGateway\Settings\Digital_Wallet_Settings::get_apple_merchant_id(),
					'public_key'        => \APNMIPaymentGateway\Settings\Digital_Wallet_Settings::get_public_key(),
					'error_message'     => __( 'Apple Pay failed. Please try again or use a different payment method.', 'gaincommerce-nmi-payment-gateway-for-woocommerce' ),
				]
			);
			wp_enqueue_script( 'nmi-apple-pay' );
		}

		if ( $google_pay_enabled ) {
			wp_register_script(
				'nmi-google-pay',
				apnmi_get_plugin_dir_url() . 'assets/js/nmi-google-pay.js',
				[ 'jquery', 'nmi-collectjs' ],
				AP_NMI_PAYMENT_GATEWAY_VERSION,
				true
			);
			wp_localize_script(
				'nmi-google-pay',
				'ap_nmi_google_pay_params',
				[
					'google_merchant_id' => \APNMIPaymentGateway\Settings\Digital_Wallet_Settings::get_google_merchant_id(),
					'public_key'         => \APNMIPaymentGateway\Settings\Digital_Wallet_Settings::get_public_key(),
					'locale'             => get_locale(),
					'error_message'      => __( 'Google Pay failed. Please try again or use a different payment method.', 'gaincommerce-nmi-payment-gateway-for-woocommerce' ),
				]
			);
			wp_enqueue_script( 'nmi-google-pay' );
		}
	}
});

// Add the data-tokenization-key attribute
add_filter('script_loader_tag', function($tag, $handle) {
	$gateway_settings = get_option(AP_NMI_WC_GATEWAY_SETTINGS_ID);

	if ('nmi-collectjs' === $handle) {
		$tag = str_replace(
			'src="https://secure.nmi.com/token/Collect.js?ver=' . AP_NMI_PAYMENT_GATEWAY_VERSION,
			'src="https://secure.nmi.com/token/Collect.js" data-tokenization-key="' . esc_attr($gateway_settings['public_key']) . '"',
			$tag
		);
	}
	return $tag;
}, 100, 2);