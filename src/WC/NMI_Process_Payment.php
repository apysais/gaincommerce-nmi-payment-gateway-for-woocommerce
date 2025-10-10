<?php

namespace APNMIPaymentGateway\WC;
use APNMIPaymentGateway\Single_Instance_Trait;
use APNMIPaymentGateway\API\NMI_API_Factory;
use WC_Order;
use APNMIPaymentGateway\Logger;
class NMI_Process_Payment
{
    use Single_Instance_Trait;

    private $order;
    private $config;

    public function __construct(WC_Order $order, array $config = [])
    {
        $this->order = $order;
        $this->config = $config;
    }

    public function check_payment_token()
    {
        $config = $this->config;
        if ($config['use_collect_js'] && empty($config['payment_token'])) {
            // get payment token from the form
            return [
                'success' => false,
                'message' => __('Payment token is missing. Please try again.', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
            ];
        }
    }
   
    public function process_sale()
    {
        // Configure API with current gateway settings
        $config = $this->config;
        $order  = $this->order;

        $this->check_payment_token();

        $payment_token = $config['payment_token'];

        $payment_data = [
            'amount'            => $order->get_total(),
            'payment_token'     => $payment_token,
            'first_name'        => $order->get_billing_first_name(),
            'last_name'         => $order->get_billing_last_name(),
            'address1'          => $order->get_billing_address_1(),
            'address2'          => $order->get_billing_address_2(),
            'city'              => $order->get_billing_city(),
            'state'             => $order->get_billing_state(),
            'zip'               => $order->get_billing_postcode(),
            'country'           => $order->get_billing_country(),
            'phone'             => $order->get_billing_phone(),
            'email'             => $order->get_billing_email(),
            'shipping'          => [
                'shipping_firstname' => $order->get_shipping_first_name(),
                'shipping_lastname'  => $order->get_shipping_last_name(),
                'shipping_address1'   => $order->get_shipping_address_1(),
                'shipping_address2'   => $order->get_shipping_address_2(),
                'shipping_city'       => $order->get_shipping_city(),
                'shipping_state'      => $order->get_shipping_state(),
                'shipping_postcode'   => $order->get_shipping_postcode(),
                'shipping_country'    => $order->get_shipping_country(),
                'shipping_phone'      => $order->get_billing_phone(),
                'shipping_email'      => $order->get_billing_email(),
            ],
            'orderid'               => $order->get_order_number(),
            'orderdescription'      => sprintf('Order #%s', $order->get_order_number()),
            'ccnumber'              => isset($config['card_data']['ccnumber']) ? $config['card_data']['ccnumber'] : '',
            'ccexp'                 => isset($config['card_data']['ccexp']) ? $config['card_data']['ccexp'] : '',
            'cvv'                   => isset($config['card_data']['cvv']) ? $config['card_data']['cvv'] : '',
        ];

        // Process payment based on transaction mode

        // Use the new API factory
        $factory = NMI_API_Factory::get_instance();
        
        $payment_api = $factory->create_payment_api($config);

        $response_handler = $factory->create_response_handler();
        if ($config['transaction_mode'] === 'auth') {
            $api_response = $payment_api->process_auth($payment_data);
        } else {
            $api_response = $payment_api->process_sale($payment_data);
        }

        // Process and standardize response
        $processed_response = $response_handler->process_response($api_response);

        // Return standardized response format
        if ($processed_response['success']) {
            return [
                'success' => true,
                'transaction_id' => $processed_response['transaction_id'],
                'auth_code' => $processed_response['auth_code'],
                'response_message' => $processed_response['response_message'],
                'cvv_response' => $processed_response['cvv_response'],
                'avs_response' => $processed_response['avs_response'],
                'response_code' => $processed_response['response_code'],
            ];
        } else {
            return [
                'success' => false,
                'message' => $processed_response['response_message'] ?: __('Payment failed.', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
            ];
        }
    }
}