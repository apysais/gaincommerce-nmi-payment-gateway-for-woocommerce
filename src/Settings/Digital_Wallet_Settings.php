<?php
/**
 * Digital Wallet Settings for NMI Payment Gateway
 *
 * Adds Apple Pay and Google Pay configuration options to the CC gateway settings.
 * Follows the same pattern as ThreeDS_Settings in the enterprise plugin.
 *
 * @package APNMIPaymentGateway
 */

namespace APNMIPaymentGateway\Settings;

class Digital_Wallet_Settings
{
    /**
     * Initialize hooks
     */
    public static function init(): void
    {
        add_filter(
            'woocommerce_settings_api_form_fields_' . AP_NMI_WC_GATEWAY_ID,
            [ self::class, 'add_digital_wallet_settings' ],
            20,
            1
        );
    }

    /**
     * Inject Digital Wallet settings into the CC gateway settings page.
     *
     * @param array $fields Existing gateway form fields.
     * @return array
     */
    public static function add_digital_wallet_settings( array $fields ): array
    {
        $fields['digital_wallets_section'] = [
            'title'       => __( 'Digital Wallets', 'gaincommerce-nmi-payment-gateway-for-woocommerce' ),
            'type'        => 'title',
            'description' => __(
                'Enable Apple Pay and Google Pay on the checkout page. '
                . 'Both wallets use your existing NMI public/private keys above. '
                . 'Wallet tokens are already device-authenticated and bypass 3-D Secure.',
                'gaincommerce-nmi-payment-gateway-for-woocommerce'
            ),
        ];

        // ── Apple Pay ─────────────────────────────────────────────────────────

        $fields['enable_apple_pay'] = [
            'title'       => __( 'Apple Pay', 'gaincommerce-nmi-payment-gateway-for-woocommerce' ),
            'type'        => 'checkbox',
            'label'       => __( 'Enable Apple Pay', 'gaincommerce-nmi-payment-gateway-for-woocommerce' ),
            'default'     => 'no',
            'description' => __(
                'Show an Apple Pay button on the checkout page. '
                . 'Requires HTTPS, an Apple Merchant ID, and your NMI account enabled for Apple Pay. '
                . 'Only visible in Safari on Apple devices.',
                'gaincommerce-nmi-payment-gateway-for-woocommerce'
            ),
            'desc_tip'    => false,
        ];

        $fields['apple_merchant_id'] = [
            'title'       => __( 'Apple Merchant ID', 'gaincommerce-nmi-payment-gateway-for-woocommerce' ),
            'type'        => 'text',
            'description' => __(
                'Your Apple Merchant ID from the Apple Developer account (e.g. <code>merchant.com.yoursite</code>). '
                . 'You must also host the domain-association file at '
                . '<code>/.well-known/apple-developer-merchantid-domain-association</code>.',
                'gaincommerce-nmi-payment-gateway-for-woocommerce'
            ),
            'default'     => '',
            'desc_tip'    => false,
        ];

        // ── Google Pay ────────────────────────────────────────────────────────

        $fields['enable_google_pay'] = [
            'title'       => __( 'Google Pay', 'gaincommerce-nmi-payment-gateway-for-woocommerce' ),
            'type'        => 'checkbox',
            'label'       => __( 'Enable Google Pay', 'gaincommerce-nmi-payment-gateway-for-woocommerce' ),
            'default'     => 'no',
            'description' => __(
                'Show a Google Pay button on the checkout page. '
                . 'Requires a Google Merchant ID and your NMI account enabled for Google Pay.',
                'gaincommerce-nmi-payment-gateway-for-woocommerce'
            ),
            'desc_tip'    => false,
        ];

        $fields['google_merchant_id'] = [
            'title'       => __( 'Google Merchant ID', 'gaincommerce-nmi-payment-gateway-for-woocommerce' ),
            'type'        => 'text',
            'description' => __(
                'Your Google Merchant ID from the <a href="https://pay.google.com/business/console" target="_blank">Google Pay Business Console</a>.',
                'gaincommerce-nmi-payment-gateway-for-woocommerce'
            ),
            'default'     => '',
            'desc_tip'    => false,
        ];

        return $fields;
    }

    // ── Static helpers ────────────────────────────────────────────────────────

    public static function is_apple_pay_enabled(): bool
    {
        $settings = get_option( 'woocommerce_' . AP_NMI_WC_GATEWAY_ID . '_settings', [] );
        return isset( $settings['enable_apple_pay'] ) && 'yes' === $settings['enable_apple_pay'];
    }

    public static function is_google_pay_enabled(): bool
    {
        $settings = get_option( 'woocommerce_' . AP_NMI_WC_GATEWAY_ID . '_settings', [] );
        return isset( $settings['enable_google_pay'] ) && 'yes' === $settings['enable_google_pay'];
    }

    public static function get_apple_merchant_id(): string
    {
        $settings = get_option( 'woocommerce_' . AP_NMI_WC_GATEWAY_ID . '_settings', [] );
        return isset( $settings['apple_merchant_id'] ) ? sanitize_text_field( $settings['apple_merchant_id'] ) : '';
    }

    public static function get_google_merchant_id(): string
    {
        $settings = get_option( 'woocommerce_' . AP_NMI_WC_GATEWAY_ID . '_settings', [] );
        return isset( $settings['google_merchant_id'] ) ? sanitize_text_field( $settings['google_merchant_id'] ) : '';
    }

    public static function get_public_key(): string
    {
        $settings = get_option( 'woocommerce_' . AP_NMI_WC_GATEWAY_ID . '_settings', [] );
        return isset( $settings['public_key'] ) ? sanitize_text_field( $settings['public_key'] ) : '';
    }
}
