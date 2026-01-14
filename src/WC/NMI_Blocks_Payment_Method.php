<?php

namespace APNMIPaymentGateway\WC;
use APNMIPaymentGateway\Single_Instance_Trait;
use Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType;

class NMI_Blocks_Payment_Method extends AbstractPaymentMethodType {
    use Single_Instance_Trait;

    protected $name = AP_NMI_WC_GATEWAY_ID;
    protected $settings;

    public function initialize() {
        $this->settings = get_option(AP_NMI_WC_GATEWAY_SETTINGS_ID, []);
    }

    public function is_active() {
        return !empty($this->settings['enabled']) && 'yes' === $this->settings['enabled'];
    }

    public function get_payment_method_script_handles()
    {
        // Register the JavaScript for checkout blocks (built version)
        $script_path = 'assets/js/build/checkout-blocks.js';
        $script_url = AP_NMI_PAYMENT_GATEWAY_PLUGIN_URL . $script_path;
        $asset_file = AP_NMI_PAYMENT_GATEWAY_PLUGIN_DIR . 'assets/js/build/checkout-blocks.asset.php';

        $asset = include $asset_file;
        $dependencies = array_merge($asset['dependencies'], [
            'wc-blocks-registry',
            'wc-settings'
        ]);
        $version = $asset['version'];

        wp_register_script(
            'ap-nmi-blocks-integration',
            $script_url,
            $dependencies,
            $version,
            true
        );

        // Register CSS for checkout blocks
        $css_path = 'assets/css/checkout-blocks.css';
        $css_url = AP_NMI_PAYMENT_GATEWAY_PLUGIN_URL . $css_path;
        
        wp_register_style(
            'ap-nmi-blocks-styles',
            $css_url,
            [],
            AP_NMI_PAYMENT_GATEWAY_VERSION
        );
        
        wp_enqueue_style('ap-nmi-blocks-styles');

        if (function_exists('wp_set_script_translations')) {
            wp_set_script_translations('ap-nmi-blocks-integration');
        }
        
        wp_enqueue_script('nmi-collectjs');
        wp_enqueue_script('ap-nmi-unified-integration');

        return ['ap-nmi-blocks-integration'];
    }

    /**
     * Returns an array of key=>value pairs of data made available to the payment methods script.
     *
     * @return array
     */
    public function get_payment_method_data()
    {
        $gateway = WC()->payment_gateways()->payment_gateways()[AP_NMI_WC_GATEWAY_ID] ?? null;
        
        if (!$gateway) {
            return [
                'title' => 'Gain Commerce NMI Payment Gateway for WooCommerce',
                'description' => '',
                'supports' => [],
                'is_available' => false,
            ];
        }

        // Safely check if premium plugin's save card feature is enabled
        $save_payment_enabled = false;
        if (class_exists('GainCommerceNmiEnterprise\Save_Card_Settings')) {
            $save_payment_enabled = \GainCommerceNmiEnterprise\Save_Card_Settings::is_save_card_enabled();
        }

        // Check if user has saved payment method (only when premium is active)
        $has_saved_card = false;
        $saved_card_details = null;
        
        if (class_exists('GainCommerceNmiEnterprise\\User\\Meta_Save_Payment_Method_CC') && 
            class_exists('GainCommerceNmiEnterprise\\Service\\Get_Customer_Vault_Service')) {
            
            $user_id = get_current_user_id();
            if ($user_id) {
                $has_saved_card = \GainCommerceNmiEnterprise\User\Meta_Save_Payment_Method_CC::has_customer_vault_id_in_user_meta($user_id);
                
                if ($has_saved_card) {
                    $customer_vault_id = \GainCommerceNmiEnterprise\User\Meta_Save_Payment_Method_CC::get_customer_vault_id_from_user_meta($user_id);
                    $saved_card_details = \GainCommerceNmiEnterprise\Service\Get_Customer_Vault_Service::get_cc_details($customer_vault_id, $user_id);
                }
            }
        }

        return [
            'title' => $gateway->get_title(),
            'description' => $gateway->get_description(),
            'supports' => $gateway->supports,
            'public_key' => $gateway->public_key,
            'testmode' => $gateway->testmode ?? 'no',
            'collectjs_url' => 'https://secure.nmi.com/token/Collect.js',
            'restricted_card_types' => $gateway->restricted_card_types ?? [],
            'allowed_card_types' => method_exists($gateway, 'get_allowed_card_types') 
                ? $gateway->get_allowed_card_types() 
                : [],
            'is_available' => $gateway->enabled,
            'icons' => '',
            'wc_gateway_id' => AP_NMI_WC_GATEWAY_ID,
            'save_payment_enabled' => $save_payment_enabled,
            'has_saved_card' => $has_saved_card,
            'saved_card_details' => $saved_card_details
        ];
    }

    public function get_supported_features() {
        return array('products');
    }

}