<?php
/**
 * Google Pay Express Payment Method — WooCommerce Blocks Support
 *
 * Registers the Google Pay express payment method for the WooCommerce Blocks
 * checkout. Processes via the existing gaincommerce_nmi CC gateway.
 *
 * @package APNMIPaymentGateway
 */

namespace APNMIPaymentGateway\WC\Blocks;

use Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType;
use APNMIPaymentGateway\Settings\Digital_Wallet_Settings;

class NMI_Google_Pay_Blocks extends AbstractPaymentMethodType
{
    /**
     * Name used by registerExpressPaymentMethod() in JS.
     */
    protected $name = 'gaincommerce_nmi_google_pay_express';

    public function initialize(): void
    {
        // No separate settings store — reads from the CC gateway settings.
    }

    public function is_active(): bool
    {
        return Digital_Wallet_Settings::is_google_pay_enabled();
    }

    public function get_payment_method_script_handles(): array
    {
        $plugin_dir  = AP_NMI_PAYMENT_GATEWAY_PLUGIN_DIR;
        $plugin_url  = AP_NMI_PAYMENT_GATEWAY_PLUGIN_URL;
        $build_file  = $plugin_dir . 'assets/js/build/google-pay-blocks.js';
        $asset_file  = $plugin_dir . 'assets/js/build/google-pay-blocks.asset.php';

        if ( ! file_exists( $build_file ) ) {
            return [];
        }

        $asset = file_exists( $asset_file ) ? require $asset_file : [ 'dependencies' => [], 'version' => AP_NMI_PAYMENT_GATEWAY_VERSION ];
        $deps  = array_merge( $asset['dependencies'], [ 'wc-blocks-registry', 'wc-settings', 'nmi-collectjs' ] );

        wp_register_script(
            'nmi-google-pay-blocks',
            $plugin_url . 'assets/js/build/google-pay-blocks.js',
            $deps,
            $asset['version'],
            true
        );

        // Ensure CollectJS is enqueued with the tokenization key
        wp_enqueue_script( 'nmi-collectjs' );

        return [ 'nmi-google-pay-blocks' ];
    }

    public function get_payment_method_data(): array
    {
        return [
            'is_available'       => Digital_Wallet_Settings::is_google_pay_enabled() ? 'yes' : 'no',
            'google_merchant_id' => Digital_Wallet_Settings::get_google_merchant_id(),
            'public_key'         => Digital_Wallet_Settings::get_public_key(),
            'locale'             => get_locale(),
            'supports'           => [ 'products' ],
        ];
    }
}
