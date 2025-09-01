<?php
// If this file is called directly, abort.
if ( ! defined( 'WPINC' ) ) {
	die;
}

add_action('wp_enqueue_scripts', function(){
	$gateway_settings = get_option(AP_NMI_WC_GATEWAY_SETTINGS_ID);

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
			'gateway_config' => $gateway_settings
		]
	);

	wp_register_style('ap-nmi-unified-styles', apnmi_get_plugin_dir_url() . 'assets/css/ap-nmi-unified-styles.css', [], AP_NMI_PAYMENT_GATEWAY_VERSION);
});

// Add the data-tokenization-key attribute
add_filter('script_loader_tag', function($tag, $handle) {
	$gateway_settings = get_option(AP_NMI_WC_GATEWAY_SETTINGS_ID);

	if ('nmi-collectjs' === $handle) {
		// Add your tokenization key here
		$key = $gateway_settings['public_key'];
		$tag = str_replace(
			'src="https://secure.nmi.com/token/Collect.js?ver=' . AP_NMI_PAYMENT_GATEWAY_VERSION,
			'src="https://secure.nmi.com/token/Collect.js" data-tokenization-key="' . esc_attr($key) . '"',
			$tag
		);
	}
	return $tag;
}, 100, 2);