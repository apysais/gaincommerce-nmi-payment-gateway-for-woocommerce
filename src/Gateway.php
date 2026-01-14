<?php
/**
 * Custom WooCommerce Payment Gateway
 *
 * @package WC_Custom_Gateway
 */

namespace APNMIPaymentGateway;

use APNMIPaymentGateway\API\NMI_API_Factory;
use APNMIPaymentGateway\Single_Instance_Trait;
use APNMIPaymentGateway\WC\NMI_Process_Payment;
use APNMIPaymentGateway\Parse_Response_Codes;
use WC_Payment_Gateway;
use WC_Order;
class Gateway extends WC_Payment_Gateway
{
    use Single_Instance_Trait;

    /**
     * Gateway ID
     */
    public const GATEWAY_ID = AP_NMI_WC_GATEWAY_ID;

    public const USE_COLLECT_JS = AP_NMI_PAYMENT_GATEWAY_USE_COLLECT_JS;
 
    /**
     * Test mode flag
     *
     * @var bool
     */
    public $testmode;

    /**
     * Private API key (secondary authentication)
     *
     * @var string
     */
    public $private_key;

    /**
     * Public API key (secondary authentication)
     *
     * @var string
     */
    public $public_key;

    /**
     * Transaction mode (sale or auth)
     *
     * @var string
     */
    public $transaction_mode;

    /**
     * Send email receipts from NMI
     *
     * @var bool
     */
    public $send_receipts;

    public $logging;

    public $use_collect_js;

    /**
     * Restricted card types
     *
     * @var array
     */
    public $restricted_card_types;

    public $enable_descriptor;
    public $descriptor;
    public $descriptor_phone;

    public function __construct()
    {
        $this->id                 = self::GATEWAY_ID;
        $this->icon               = apply_filters('woocommerce_custom_gateway_icon', '');
        $this->has_fields         = true;
        $this->method_title       = __('Gain Commerce NMI Payment Gateway for WooCommerce', 'gaincommerce-nmi-payment-gateway-for-woocommerce');
        $this->method_description = __('Accept payments via Gain Commerce NMI Payment Gateway for WooCommerce.', 'gaincommerce-nmi-payment-gateway-for-woocommerce');
        $this->supports           = array(
            'products',
            'refunds',
            'blocks'
        );

        // Load the settings
        $this->init_form_fields();
        $this->init_settings();

        // Define user set variables
        $this->title = $this->get_option('title');
        $this->description = $this->get_option('description');
        $this->enabled = $this->get_option('enabled');
        $this->testmode = 'yes' === $this->get_option('testmode');
        $this->transaction_mode = $this->get_option('transaction_mode', 'sale');
        $this->send_receipts = 'yes' === $this->get_option('send_receipts');
        $this->restricted_card_types = $this->get_option('restricted_card_types', array());
        $this->logging = 'yes' === $this->get_option('logging');
        $this->enable_descriptor = 'yes' === $this->get_option('enable_descriptor');
        $this->descriptor = $this->get_option('descriptor');
        $this->descriptor_phone = $this->get_option('descriptor_phone');

        // Set private key (secondary authentication)
        $this->private_key = $this->get_option('private_key');
            
        // Set public key (secondary authentication)
        $this->public_key =  $this->get_option('public_key');

        $this->use_collect_js = self::USE_COLLECT_JS ? 1:0;

        // Actions
        add_action(
            'woocommerce_update_options_payment_gateways_' . $this->id,
            [$this, 'process_admin_options']
        );

        add_action('wp_enqueue_scripts', [$this, 'payment_scripts']);
        
        // // Also enqueue on AJAX calls for checkout updates
        add_action('wp_ajax_woocommerce_checkout', [$this, 'payment_scripts'], 5);
        add_action('wp_ajax_nopriv_woocommerce_checkout', [$this, 'payment_scripts'], 5);
        
        // Hook to ensure emails are sent when order status changes
        //add_action('woocommerce_order_status_changed', [$this, 'on_order_status_changed'], 10, 3);
        
        // You can also register a webhook here
	    add_action( 'woocommerce_api_{webhook name}',  [$this, 'webhook'] );
        
    }

     /**
     * Initialize Gateway Settings Form Fields
     *
     * @return void
     */
    public function init_form_fields(): void
    {
        $this->form_fields = [
            'enabled' => [
                'title' => __('Enable/Disable', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                'type' => 'checkbox',
                'label' => __('Enable NMI Payment Gateway', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                'description' => __('Enable this payment gateway to accept credit card payments.', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                'default' => 'no',
                'desc_tip' => false,
            ],
            'title' => [
                'title' => __('Title', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                'type' => 'text',
                'description' => __(
                    'This controls the title customers see during checkout.',
                    'gaincommerce-nmi-payment-gateway-for-woocommerce'
                ),
                'default' => __('Credit Card', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                'desc_tip' => false,
            ],
            'description' => [
                'title' => __('Description', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                'type' => 'textarea',
                'description' => __(
                    'Payment method description that customers will see on your checkout.',
                    'gaincommerce-nmi-payment-gateway-for-woocommerce'
                ),
                'default' => __('Pay securely using your credit card.', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                'desc_tip' => false,
            ],
            'testmode' => [
                'title' => __('Test mode', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                'label' => __('Enable Test Mode', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                'type' => 'checkbox',
                'description' => __(
                    'Place the payment gateway in test mode using test API keys.',
                    'gaincommerce-nmi-payment-gateway-for-woocommerce'
                ),
                'default' => 'yes',
                'desc_tip' => false,
            ],
            'transaction_mode' => [
                'title' => __('Transaction Mode', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                'type' => 'select',
                'description' => __(
                    'Choose whether to capture payment immediately or authorize first and capture later. 
                    <br>When Choosen as Authorize only, the order will set into on hold and when change order to processing or completed then the system will capture the payment.',
                    'gaincommerce-nmi-payment-gateway-for-woocommerce'
                ),
                'default' => 'sale',
                'desc_tip' => false,
                'options' => [
                    'sale' => __('Sale (Authorize and Capture Immediately)', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                    'auth' => __('Authorize Only (Capture Later)', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                ],
            ],
            'send_receipts' => [
                'title' => __('Email Receipts', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                'label' => __('Send email receipts from NMI', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                'type' => 'checkbox',
                'description' => __(
                    'When enabled, NMI will automatically send email receipts to customers after successful payments.',
                    'gaincommerce-nmi-payment-gateway-for-woocommerce'
                ),
                'default' => 'no',
                'desc_tip' => false,
            ],
            'restricted_card_types' => [
                'title' => __('Restrict Card Types', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                'type' => 'multiselect',
                'description' => __(
                    'Select card types to restrict. Customers will see an error message if they try to use a restricted card type.',
                    'gaincommerce-nmi-payment-gateway-for-woocommerce'
                ),
                'default' => array(),
                'desc_tip' => false,
                'options' => [
                    'visa' => __('Visa', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                    'mastercard' => __('Mastercard', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                    'amex' => __('American Express', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                    'discover' => __('Discover', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                    'diners' => __('Diners Club', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                    'jcb' => __('JCB', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                    'unionpay' => __('UnionPay', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                ],
                'custom_attributes' => [
                    'multiple' => 'multiple',
                ],
            ],
            'public_key' => [
                'title' => __('Live Public Key', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                'type' => 'text',
                'description' => __(
                    'Your NMI live public key for authentication.',
                    'gaincommerce-nmi-payment-gateway-for-woocommerce'
                ),
                'default' => '',
                'desc_tip' => false,
            ],
            'private_key' => [
                'title' => __('Live Private Key', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                'type' => 'text',
                'description' => __(
                    'Your NMI live private key for authentication.',
                    'gaincommerce-nmi-payment-gateway-for-woocommerce'
                ),
                'default' => '',
                'desc_tip' => false,
            ],
            'descriptor' => [
                'title' => __('Billing Descriptor', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                'type' => 'text',
                'description' => __(
                    '<p>The billing descriptor that appears on customers\' credit card statements. 
                    Typically includes your business name and contact information. 
                    Maximum 60 characters.</p>
                    <p>The address, city, state, country fields are taken in WooCommerce General Settings.</p>
                    <p>The URL is taken from WordPress Site Address (URL) setting.</p>
                    ',
                    'gaincommerce-nmi-payment-gateway-for-woocommerce'
                ),
                'default' => substr(get_option('blogname'), 0, 60),
                'desc_tip' => false,
            ],
            'descriptor_phone' => [
                'title' => __('Billing Descriptor Phone', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                'type' => 'text',
                'description' => __(
                    'The phone number that appears on customers\' credit card statements. 
                    Typically includes your business phone number.
                    <br>Maximum 13 characters.',
                    'gaincommerce-nmi-payment-gateway-for-woocommerce'
                ),
                'default' => '',
                'desc_tip' => false,
            ],
            'enable_descriptor' => [
                'title' => __('Enable Billing Descriptor', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                'label' => __('Enable custom billing descriptor', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                'type' => 'checkbox',
                'description' => __(
                    'When enabled, the specified billing descriptor will be sent with transactions.',
                    'gaincommerce-nmi-payment-gateway-for-woocommerce'
                ),
            ],
            'logging' => [
                'title' => __('Logging', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                'label' => __('Enable Logging', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                'type' => 'checkbox',
                'description' => __(
                    'Enable logging for the payment gateway.',
                    'gaincommerce-nmi-payment-gateway-for-woocommerce'
                ),
                'default' => 'no',
                'desc_tip' => false,
            ],
        ];
    }

    public function payment_fields() 
    {
        $test_mode_notes = '';
        if ($this->description) {
            // you can instructions for test mode, I mean test card numbers etc.
            if ($this->testmode) {
                $test_mode_notes = ' TEST MODE ENABLED. In test mode, you can use the card numbers listed in <a href="#">documentation</a>.';
            }
        }

        // Safely check if premium plugin's save card feature is enabled
        $save_payment_enabled = false;
        if (class_exists('GainCommerceNmiEnterprise\Save_Card_Settings')) {
            $save_payment_enabled = \GainCommerceNmiEnterprise\Save_Card_Settings::is_save_card_enabled();
        }

        $args = [
            'gateway_id'        => $this->id,
            'description'       => $this->description,
            'test_mode_notes'   => $test_mode_notes,
            'is_on_test_mode'   => $this->testmode,
            'use_collect_js'    => $this->use_collect_js,
            'display_accepted_cards' => $this->display_card_type_icons(),
            'save_payment_enabled' => $save_payment_enabled
        ];

        wc_get_template(
            'public/wc-payment-fields.php',
            $args, // Pass data as needed
            '', // No override path
            apnmi_get_plugin_dir() . 'template/'
        );
    }

    public function payment_scripts() 
    {
        // we need JavaScript to process a token only on cart/checkout pages, right?
        if( ! is_cart() && ! is_checkout() ) {
            return;
        }

        // if our payment gateway is disabled, we do not have to enqueue JS too
        if( 'no' === $this->enabled ) {
            return;
        }

        // no reason to enqueue JavaScript if API keys are not set
        if( empty( $this->private_key ) || empty( $this->public_key ) ) {
            return;
        }

        // Check if we're in a blocks checkout context
        // Don't load legacy scripts for blocks checkout as they have their own integration
        if ($this->is_blocks_checkout()) {
            return;
        }
        
        //enqueue scripts here for legacy checkout only
        wp_enqueue_script('nmi-collectjs');
        wp_enqueue_script('ap-nmi-unified-integration');
        wp_enqueue_style('ap-nmi-unified-styles');
	}

    /**
     * Check if the current request is for blocks checkout
     * 
     * @return bool
     */
    private function is_blocks_checkout() {

        // Method 1: Check for AJAX requests from blocks checkout
        // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Intentionally checking for blocks checkout patterns
        if (wp_doing_ajax() && isset($_POST['wc-ajax']) && $_POST['wc-ajax'] === 'checkout') {
            // Check if request contains blocks-specific data
            // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Intentionally checking for blocks checkout patterns
            if (isset($_POST['payment_method_data']) || 
                // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Intentionally checking for blocks checkout patterns
                (isset($_POST['extensions']) && is_array($_POST['extensions']))) {
                return true;
            }
        }

        // Method 2: Check for Store API requests (REST API)
        if (defined('REST_REQUEST') && REST_REQUEST) {
            $rest_route = isset($GLOBALS['wp']->query_vars['rest_route']) ? $GLOBALS['wp']->query_vars['rest_route'] : '';
            if (strpos($rest_route, '/wc/store/') !== false && strpos($rest_route, 'checkout') !== false) {
                return true;
            }
        }

        // Method 3: Check if we have blocks-specific $_POST data patterns
        // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Intentionally checking for blocks checkout patterns
        if (isset($_POST['payment_method']) && isset($_POST['billing_address'])) {
            return true;
        }
        
        return false;
    }

    public function validate_fields() 
    {
        if (
            // Standard blocks detection
            $this->is_blocks_checkout() ||
            // Additional safety checks for blocks
            // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Checking for blocks checkout patterns
            isset($_POST['payment_method_data']) ||
            // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Checking for blocks checkout patterns
            isset($_POST['extensions']) ||
            // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Checking for blocks checkout patterns
            (isset($_POST['billing_address']) && is_array($_POST['billing_address'])) ||
            (defined('REST_REQUEST') && REST_REQUEST) ||
            // If we're in an AJAX context without the legacy nonce
            // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Checking for blocks checkout patterns
            (wp_doing_ajax() && !isset($_POST['woocommerce-process-checkout-nonce']))
        ) {
            return true;
        }
        // Legacy checkout nonce verification
        if (
            ! isset($_POST['woocommerce-process-checkout-nonce']) ||
            ! wp_verify_nonce(
                sanitize_text_field(wp_unslash($_POST['woocommerce-process-checkout-nonce'])),
                'woocommerce-process_checkout'
            )
        ) {
            wc_add_notice(__('Security check failed. Please refresh and try again.', 'gaincommerce-nmi-payment-gateway-for-woocommerce'), 'error');
            return false;
        }

        // phpcs:ignore WordPress.Security.NonceVerification.Missing -- This check is for validation purposes only
        if( isset($_POST['payment_token']) && empty($_POST['payment_token'])) {
            wc_add_notice(__('Payment information is required. Please fill in all credit card fields.', 'gaincommerce-nmi-payment-gateway-for-woocommerce'), 'error');
            return false;
        }
        
        return true;
    }

    public function process_payment( $order_id )
    {
        $order = wc_get_order($order_id);

        if (!$order) {
            wc_add_notice(__('Order not found.', 'gaincommerce-nmi-payment-gateway-for-woocommerce'), 'error');
            return ['result' => 'fail'];
        }

        // Skip nonce verification for blocks checkout as it's handled by Store API
        if (!$this->is_blocks_checkout()) {
            // Legacy checkout nonce verification
            if (
                ! isset($_POST['woocommerce-process-checkout-nonce']) ||
                ! wp_verify_nonce(
                    sanitize_text_field(wp_unslash($_POST['woocommerce-process-checkout-nonce'])),
                    'woocommerce-process_checkout'
                )
            ) {
                wc_add_notice(__('Security check failed. Please refresh and try again.', 'gaincommerce-nmi-payment-gateway-for-woocommerce'), 'error');
                return ['result' => 'fail'];
            }
        }

        $payment_token = '';
        // For blocks checkout, the token is in a different place
        // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verification handled earlier in the method
        if (isset($_POST['payment_method_data']['payment_token'])) {
            // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verification handled earlier in the method
            $payment_token = sanitize_text_field(wp_unslash($_POST['payment_method_data']['payment_token']));
        // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verification handled earlier in the method
        } elseif (isset($_POST['payment_token']) && !empty($_POST['payment_token'])) {
            // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verification handled earlier in the method
            $payment_token = sanitize_text_field(wp_unslash($_POST['payment_token']));
        }
        
        $card_data = [];
        if (empty($payment_token)) {
            // Fallback for non-CollectJS or if token is missing
            $card_data = [
                // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verification handled earlier in the method
                'ccnumber' => isset($_POST['ccnumber']) ? sanitize_text_field(wp_unslash($_POST['ccnumber'])) : '',
                // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verification handled earlier in the method
                'ccexp' => isset($_POST['ccexp']) ? sanitize_text_field(wp_unslash($_POST['ccexp'])) : '',
                // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce verification handled earlier in the method
                'cvv' => isset($_POST['cvv']) ? sanitize_text_field(wp_unslash($_POST['cvv'])) : '',
            ];
        }

        $gateway_config = [
            'test_mode' => $this->testmode,
            'public_key' => $this->public_key,
            'private_key' => $this->private_key,
            'use_collect_js' => $this->use_collect_js,
            'transaction_mode' => $this->transaction_mode,
            'payment_token' => $payment_token,
            'card_data' => $card_data
        ];

        if (isset($_POST['save_payment_method']) && $_POST['save_payment_method'] == '1') {
            $gateway_config['save_payment_method'] = true;
        } else {
            $gateway_config['save_payment_method'] = false;
        }

        if ($this->send_receipts) {
            $gateway_config['customer_receipt'] = true;
        }

        $process_payment = new NMI_Process_Payment($order, $gateway_config);
        $response = $process_payment->process_sale();

        Logger::get_instance()->debug(
            'WC Gateway process_sale return API', 
            $response
        );

        if ($response['success']) {

            // Store transaction ID for later capture
            $order->add_meta_data(AP_NMI_WC_META_DATA_TRANSACTION_ID, $response['transaction_id']);

            do_action('apnmi_after_payment_success_processed', $order, $response, $gateway_config);

            if ($this->transaction_mode === 'auth') {
                // this is for auth
                // the order status should be on-hold
                // Authorization only - don't complete the payment yet
                $order->update_status(
                    'on-hold',
                    sprintf(
                        // translators: %1$s: Transaction ID
                        __(
                            'Payment authorized. Transaction ID: %1$s. Capture payment when ready to complete the order.',
                            'gaincommerce-nmi-payment-gateway-for-woocommerce'
                        ),
                        $response['transaction_id']
                    )
                );
                
                // Store transaction ID for later capture
                $order->add_meta_data(
                    AP_NMI_WC_META_DATA_AUTH_AMOUNT,
                    $order->get_total()
                );

                $order->add_meta_data(
                    AP_NMI_WC_META_DATA_TRANSACTION_MODE,
                    'auth'
                );

                // Add order note
                
                $note = sprintf(
                    /* translators: 1: Transaction ID*/
                    __(
                        'NMI payment authorized (not captured). Transaction ID: 1%s',
                        'gaincommerce-nmi-payment-gateway-for-woocommerce'
                    ),
                    $response['transaction_id']
                );
                
                // Add receipt note if enabled
                if ($this->send_receipts) {
                    $note .= ' ' . __(
                        'Email receipt sent to customer.',
                        'gaincommerce-nmi-payment-gateway-for-woocommerce'
                    );
                }
                
                $order->add_order_note($note);
            }

            if ($this->transaction_mode === 'sale') {
                // this is for sale
                // the order status should be processing

                // Sale - payment completed immediately
                $order->payment_complete($response['transaction_id']);
                $order->reduce_order_stock();

                // Add order note
                
                $note = sprintf(
                    // translators: 1: Transaction ID
                    __(
                        'NMI payment completed. Transaction ID: %1$s',
                        'gaincommerce-nmi-payment-gateway-for-woocommerce'
                    ),
                    $response['transaction_id']
                );

                // Add receipt note if enabled
                if ($this->send_receipts) {
                    $note .= ' ' . __(
                        'Email receipt sent to customer.',
                        'gaincommerce-nmi-payment-gateway-for-woocommerce'
                    );
                }

                $order->add_order_note($note);
                
            }

            $avs_code = $response['avs_response'];
            $avs_response = Parse_Response_Codes::avs_response($avs_code);
            $cvv_code = $response['cvv_response'];
            $cvv_response = Parse_Response_Codes::cvv_response($cvv_code);
  
            $order->add_order_note(sprintf(
                __('AVS Response: %1$s, CVV Response: %2$s', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                $avs_response,
                $cvv_response
            ));

            if (isset($response['response_code']) ) {
                $interpret_response_code = Parse_Response_Codes::api_response_code($response['response_code']);
                $order->add_order_note(sprintf(
                    __('Response Code: %1$s', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                    $interpret_response_code
                ));
            }
            
            $order->save();

            // Empty cart
            WC()->cart->empty_cart();

            return [
                'result' => 'success',
                'redirect' => $this->get_return_url($order),
            ];
        } else {
            
            wc_add_notice($response['message'], 'error');
           
            $order->add_order_note(
                sprintf(
                     // translators: 1: Error message
                    __(
                        'NMI payment failed: %1$s',
                        'gaincommerce-nmi-payment-gateway-for-woocommerce'
                    ),
                    $response['message']
                )
            );
            return ['result' => 'fail'];
        }
    }

    /**
     * Process refund using new API classes
     *
    * @param int   $order_id Order ID.
    * @param float $amount   Refund amount.
    * @param string $reason  Refund reason.
    *
    * @return bool|WP_Error
     */
    public function process_refund($order_id, $amount = null, $reason = '')
    {
        $order = wc_get_order($order_id);

        if (!$order) {
            return false;
        }

        $transaction_id = $order->get_meta(AP_NMI_WC_META_DATA_TRANSACTION_ID);

        if (!$transaction_id) {
            return new \WP_Error(
                'nmi_refund_error',
                __(
                    'Transaction ID not found.',
                    'gaincommerce-nmi-payment-gateway-for-woocommerce'
                )
            );
        }

        // Use the new API factory
        $factory = NMI_API_Factory::get_instance();
        
        // Configure API with current gateway settings
        $config = [
            'test_mode' => $this->testmode,
            'public_key' => $this->public_key,
            'private_key' => $this->private_key,
        ];
        
        $payment_api = $factory->create_payment_api($config);
        $response_handler = $factory->create_response_handler();
        
        // Process refund
        $api_response = $payment_api->refund_transaction($transaction_id, $amount);
        $processed_response = $response_handler->process_response($api_response);

        if ($processed_response['success']) {
            
            $order->add_order_note(
                sprintf(
                    // translators: 1: Amount, 2: Refund ID, 3: Reason
                    __(
                        'Refunded %1$s - Refund ID: %2$s - Reason: %3$s',
                        'gaincommerce-nmi-payment-gateway-for-woocommerce'
                    ),
                    wc_price($amount),
                    $processed_response['transaction_id'],
                    $reason
                )
            );
            return true;
        } else {
            return new \WP_Error(
                'nmi_refund_error',
                $processed_response['response_message'] ?: __(
                    'Refund failed.',
                    'gaincommerce-nmi-payment-gateway-for-woocommerce'
                )
            );
        }
    }

    /**
     * Display card type icons with restriction indicators
     *
     * @return void
     */
    /**
     * Display card type icons with restriction indicators
     *
     * @return void
     */
    public function display_card_type_icons(): void
    {
        $all_card_types = [
            'visa' => 'Visa',
            'mastercard' => 'Mastercard', 
            'amex' => 'American Express',
            'discover' => 'Discover',
            'diners' => 'Diners Club',
            'jcb' => 'JCB',
            'unionpay' => 'UnionPay'
        ];

        $restricted_card_types = $this->get_option('restricted_card_types', []);
        echo '<div class="ap-nmi-card-icons">';
        
        foreach ($all_card_types as $card_type => $card_name) {
            $class = 'card-icon ' . $card_type;
            if (in_array($card_type, $restricted_card_types)) {
                $class .= ' restricted';
                
                $title = sprintf(
                    // translators: 1: Card name
                    __(
                        '%1$s cards are not accepted',
                        'gaincommerce-nmi-payment-gateway-for-woocommerce'
                    ),
                    $card_name
                );
            } else {
                $class .= ' allowed';
                
                $title = sprintf(
                    // translators: 1: Card name
                    __(
                        '%1$s cards are accepted',
                        'gaincommerce-nmi-payment-gateway-for-woocommerce'
                    ),
                    $card_name
                );
            }
            echo '<span class="' . esc_attr($class) . '" title="' . esc_attr($title) . '"></span>';
        }
        
        echo '</div>';
        
        if (!empty($restricted_card_types)) {
            echo '<div class="ap-nmi-card-restrictions-info">';
            echo esc_html__(
                'Cards marked with ✕ are not accepted for payment.',
                'gaincommerce-nmi-payment-gateway-for-woocommerce'
            );
            echo '</div>';
        }
    }

    public function get_allowed_card_types()
    {
        $allowed_card_types = [];

        $all_card_types = [
            'visa' => 'Visa',
            'mastercard' => 'Mastercard', 
            'amex' => 'American Express',
            'discover' => 'Discover',
            'diners' => 'Diners Club',
            'jcb' => 'JCB',
            'unionpay' => 'UnionPay'
        ];

        $restricted_card_types = $this->get_option('restricted_card_types', []);

        foreach ($all_card_types as $card_type => $card_name) {
            $status = '';
            $title = '';

            if (in_array($card_type, $restricted_card_types)) {
                $status = 'restricted';
                $title = sprintf(
                    // translators: 1: Card name
                    __('%1$s cards are not accepted', 'gaincommerce-nmi-payment-gateway-for-woocommerce'), 
                    $card_name
                );
            } else {
                $status = ' allowed';
                $title = sprintf(
                    // translators: 1: Card name
                    __('%1$s cards are accepted', 'gaincommerce-nmi-payment-gateway-for-woocommerce'), 
                    $card_name
                );
            }
            $allowed_card_types[$card_type] = [
                'name' => $card_name,
                'title' => esc_attr($title),
                'status' => $status
            ];
        }

        return $allowed_card_types;
    }

    public function webhook() 
    {

    }
}