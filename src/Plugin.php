<?php
/**
 * Main Plugin Class
 *
 * @package APNMIPaymentGateway
 * @author Gain Commerce
 * @license GPL-2.0-or-later
 * @link https://www.gaincommerce.com/
 */

namespace APNMIPaymentGateway;
use APNMIPaymentGateway\Single_Instance_Trait;
use APNMIPaymentGateway\Gateway;
use APNMIPaymentGateway\WC\NMI_Blocks_Payment_Method;
use APNMIPaymentGateway\WC\Blocks\NMI_Apple_Pay_Blocks;
use APNMIPaymentGateway\WC\Blocks\NMI_Google_Pay_Blocks;
use APNMIPaymentGateway\Settings\Digital_Wallet_Settings;

/**
 * Main Plugin Class
 *
 * Handles the initialization and management of the AP NMI Payment Gateway plugin.
 */
class Plugin
{
    use Single_Instance_Trait;
    
    /**
     * Payment gateway instance
     *
     * @var Gateway|null
     */
    private $_gateway = null;

    /**
     * Private constructor to prevent direct instantiation
     */
    private function __construct()
    {
        $this->init();
    }

    /**
     * Initialize the plugin
     *
     * @return void
     */
    private function init(): void
    {
        // Add the gateway to WooCommerce
        add_filter('woocommerce_payment_gateways', [$this, 'add_gateway']);

        // Initialize gateway settings
        add_action('init', [$this, 'init_gateway']);

        // Initialize digital wallet settings (injects fields into CC gateway admin)
        Digital_Wallet_Settings::init();

        // Initialize WooCommerce Blocks integration
        add_action('woocommerce_blocks_loaded', [$this, 'init_blocks_support']);

        // Ensure gateway is marked as blocks compatible
        //add_filter('woocommerce_payment_gateway_supports', [$this, 'gateway_supports_blocks'], 10, 3);

        // Render Apple Pay + Google Pay express buttons above payment methods on classic checkout.
        // Two hooks cover different WooCommerce theme templates:
        //   woocommerce_review_order_before_payment — fires inside the order review table (default)
        //   woocommerce_before_checkout_form       — fires before the entire form (some themes)
        // A static flag prevents double output if both hooks fire on the same page.
        add_action('woocommerce_review_order_before_payment', [$this, 'render_wallet_express_buttons']);
        add_action('woocommerce_before_checkout_form', [$this, 'render_wallet_express_buttons'], 5);

        // Load plugin text domain
        add_action('init', [$this, 'load_textdomain']);

        // Add plugin action links
        add_filter(
            'plugin_action_links_' . AP_NMI_PAYMENT_GATEWAY_PLUGIN_BASENAME,
            [$this, 'add_action_links']
        );
    }

    /**
     * Add the gateway to WooCommerce
     *
     * @param array $gateways List of payment gateways.
     * @return array
     */
    public function add_gateway(array $gateways): array
    {
        $gateways[] = Gateway::class;
        return $gateways;
    }

    /**
     * Initialize the payment gateway
     *
     * @return void
     */
    public function init_gateway(): void
    {
        if (class_exists('WC_Payment_Gateway')) {
            $this->_gateway = new Gateway();
        }
    }

    /**
     * Initialize WooCommerce Blocks support
     *
     * @return void
     */
    /**
     * Render Apple Pay + Google Pay express button containers above the payment
     * methods list on classic checkout. CollectJS injects the actual buttons on
     * page load. Plug-and-play: accounts activate once merchant IDs are set in
     * gateway settings — zero code changes required.
     */
    public function render_wallet_express_buttons(): void
    {
        if ( ! is_checkout() ) {
            return;
        }

        // Only for classic checkout — blocks checkout uses registered express payment methods.
        if ( has_block('woocommerce/checkout') ) {
            return;
        }

        // Prevent double output when both hooks fire on the same page load.
        static $rendered = false;
        if ( $rendered ) {
            return;
        }
        $rendered = true;

        if ( ! class_exists('APNMIPaymentGateway\Settings\Digital_Wallet_Settings') ) {
            return;
        }

        $apple_pay_enabled  = Digital_Wallet_Settings::is_apple_pay_enabled();
        $google_pay_enabled = Digital_Wallet_Settings::is_google_pay_enabled();

        if ( ! $apple_pay_enabled && ! $google_pay_enabled ) {
            return;
        }

        // Wrapper starts hidden; JS shows it via .show() once CollectJS confirms
        // at least one wallet button has rendered (fieldsAvailableCallback).
        echo '<div class="nmi-wallet-express-wrap" style="display:none;">';

        if ( $apple_pay_enabled ) {
            // Only Safari on Apple devices supports Apple Pay — CollectJS handles hiding.
            echo '<div id="nmi-apple-pay-express" class="nmi-wallet-button"></div>';
        }

        if ( $google_pay_enabled ) {
            echo '<div id="nmi-google-pay-express" class="nmi-wallet-button"></div>';
        }

        echo '<p class="nmi-or-divider">' . esc_html__( '— or pay below —', 'gaincommerce-nmi-payment-gateway-for-woocommerce' ) . '</p>';
        echo '</div>';
    }

    public function init_blocks_support(): void
    {
        if (class_exists('Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType')) {
            add_action(
                'woocommerce_blocks_payment_method_type_registration',
                function ($payment_method_registry) {
                    $payment_method_registry->register(new NMI_Blocks_Payment_Method());
                    // Wallet buttons (Apple Pay / Google Pay) are rendered INSIDE the CC
                    // payment form by checkout-blocks.js, not as separate express methods.
                    // This avoids the CollectJS single-configure constraint: CollectJS can
                    // only be configured once per page load, so all fields (CC + wallets)
                    // must be declared in the single configure() call inside checkout-blocks.js
                    // when the user selects the Credit Card payment option.
                }
            );
        }
    }

    /**
     * Filter to ensure gateway supports blocks
     *
     * @param bool   $is_supported Whether the feature is supported.
     * @param string $feature      The feature being checked.
     * @param object $gateway      The payment gateway instance.
     * @return bool
     */
    public function gateway_supports_blocks($is_supported, $feature, $gateway)
    {
        if ($feature === 'blocks' && $gateway->id === AP_NMI_WC_GATEWAY_ID) {
            return true;
        }
        return $is_supported;
    }

    /**
     * Load plugin text domain for translations
     *
     * @return void
     */
    public function load_textdomain(): void
    {
        // load_plugin_textdomain(
        //     'gaincommerce-nmi-payment-gateway-for-woocommerce',
        //     false,
        //     dirname(AP_NMI_PAYMENT_GATEWAY_PLUGIN_BASENAME) . '/languages'
        // );
    }

    /**
     * Add plugin action links
     *
     * @param array $links Existing action links.
     * @return array
     */
    public function add_action_links(array $links): array
    {
        $settingsLink = sprintf(
            '<a href="%s">%s</a>',
            admin_url('admin.php?page=wc-settings&tab=checkout&section='.AP_NMI_WC_GATEWAY_ID),
            esc_html__('Settings', 'gaincommerce-nmi-payment-gateway-for-woocommerce')
        );

        array_unshift($links, $settingsLink);

        return $links;
    }

    /**
     * Get the gateway instance
     *
     * @return Gateway|null
     */
    public function get_gateway(): ?Gateway
    {
        return $this->_gateway;
    }
}
