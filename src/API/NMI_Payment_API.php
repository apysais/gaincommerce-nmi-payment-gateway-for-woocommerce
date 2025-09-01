<?php
/**
 * Summary of namespace APNMIPaymentGateway\API
 * 
 * This namespace contains classes and interfaces for the NMI Payment Gateway API.
 * 
 */
namespace APNMIPaymentGateway\API;

use APNMIPaymentGateway\Single_Instance_Trait;
use APNMIPaymentGateway\API\NMI_Base;
use APNMIPaymentGateway\Logger;
use WP_Error;

/**
 * Summary of NMI_Payment_API
 *
 * This class handles payment processing through the NMI API.
 * 
 */
class NMI_Payment_API extends NMI_Base
{
    use Single_Instance_Trait;

    /**
     * Process a credit card sale transaction
     *
     * @param array $payment_data Payment data
     * @return array|WP_Error
     */
    public function process_sale(array $payment_data)
    {
        $this->logger->info('NMI Payment API: Processing sale transaction');

        $data = $this->prepare_sale_data($payment_data);
        
        if (is_wp_error($data)) {
            return $data;
        }

        return $this->make_post_request($data);
    }

    /**
     * Process an authorization transaction
     *
     * @param array $payment_data Payment data
     * @return array|WP_Error
     */
    public function process_auth(array $payment_data)
    {
        $this->logger->info('NMI Payment API: Processing auth transaction');

        $data = $this->prepare_sale_data($payment_data);
        
        if (is_wp_error($data)) {
            return $data;
        }

        $data['type'] = 'auth';

        return $this->make_post_request($data);
    }

    /**
     * Capture a previously authorized transaction
     *
     * @param string $transaction_id Transaction ID to capture
     * @param float|null $amount Amount to capture (optional)
     * @return array|WP_Error
     */
    public function capture_transaction(string $transaction_id, ?float $amount = null)
    {
        $this->logger->info('NMI Payment API: Capturing transaction', [
            'transaction_id' => $transaction_id,
            'amount' => $amount,
        ]);

        $data = [
            'type' => 'capture',
            'transactionid' => $transaction_id,
        ];

        if ($amount !== null) {
            $data['amount'] = number_format($amount, 2, '.', '');
        }

        return $this->make_post_request($data);
    }

    /**
     * Void a transaction
     *
     * @param string $transaction_id Transaction ID to void
     * @return array|WP_Error
     */
    public function void_transaction(string $transaction_id)
    {
        $this->logger->info('NMI Payment API: Voiding transaction', [
            'transaction_id' => $transaction_id,
        ]);

        
        $data = [
            'type' => 'void',
            'transactionid' => $transaction_id,
        ];

        // for ACH payment is required
        // check or creditcard

        return $this->make_post_request($data);
    }

    /**
     * Refund a transaction
     *
     * @param string $transaction_id Transaction ID to refund
     * @param float|null $amount Amount to refund (optional)
     * @return array|WP_Error
     */
    public function refund_transaction(string $transaction_id, ?float $amount = null)
    {
        $this->logger->info('NMI Payment API: Refunding transaction', [
            'transaction_id' => $transaction_id,
            'amount' => $amount,
        ]);

        $data = [
            'type' => 'refund',
            'transactionid' => $transaction_id,
        ];

        if ($amount !== null) {
            $data['amount'] = number_format($amount, 2, '.', '');
        }

        return $this->make_post_request($data);
    }

    /**
     * Validate credit card information
     *
     * @param array $card_data Credit card data
     * @return array|WP_Error
     */
    public function validate_card(array $card_data)
    {
        $this->logger->info('NMI Payment API: Validating credit card');

        $data = $this->prepare_card_data($card_data);
        
        if (is_wp_error($data)) {
            return $data;
        }

        $data['type'] = 'validate';
        $data['amount'] = '0.00';

        return $this->make_post_request($data);
    }

    /**
     * Prepare sale transaction data
     *
     * @param array $payment_data Payment data
     * @return array|WP_Error
     */
    protected function prepare_sale_data(array $payment_data)
    {
        $data = [
            'type' => 'sale',
            'amount' => number_format((float) $payment_data['amount'], 2, '.', ''),
        ];

        // Check if using payment token (Collect.JS) or traditional card data
        if (!empty($payment_data['payment_token'])) {
            // Using Collect.JS payment token
            $data['payment_token'] = $payment_data['payment_token'];
        } else {
            // Using traditional card data - validate required fields
            $required_fields = ['ccnumber', 'ccexp', 'cvv'];
            foreach ($required_fields as $field) {
                if (empty($payment_data[$field])) {
                    return new WP_Error('nmi_validation_error', "Missing required field: {$field}");
                }
            }

            // Add credit card data
            $card_data = $this->prepare_card_data($payment_data);
            if (is_wp_error($card_data)) {
                return $card_data;
            }
            $data = array_merge($data, $card_data);
        }

        // Add billing information
        $billing_data = $this->prepare_billing_data($payment_data);
        $data = array_merge($data, $billing_data);

        // Add shipping information if provided
        if (!empty($payment_data['shipping'])) {
            $shipping_data = $this->prepare_shipping_data($payment_data['shipping']);
            $data = array_merge($data, $shipping_data);
        }

        // Add order information
        if (!empty($payment_data['orderid'])) {
            $data['orderid'] = sanitize_text_field($payment_data['orderid']);
        }

        if (!empty($payment_data['orderdescription'])) {
            $data['orderdescription'] = sanitize_text_field($payment_data['orderdescription']);
        }

        // Add email receipt option if enabled
        if (!empty($payment_data['send_receipt']) && $payment_data['send_receipt'] === 'yes') {
            $data['send_email_receipt'] = 'yes';
        }

        return $data;
    }

     /**
     * Prepare credit card data
     *
     * @param array $card_data Credit card data
     * @return array|WP_Error
     */
    protected function prepare_card_data(array $card_data)
    {
        $data = [];

        // Credit card number
        if (empty($card_data['ccnumber'])) {
            return new WP_Error('nmi_validation_error', 'Credit card number is required');
        }
        $data['ccnumber'] = preg_replace('/\D/', '', $card_data['ccnumber']);

        // Expiration date
        if (empty($card_data['ccexp'])) {
            return new WP_Error('nmi_validation_error', 'Credit card expiration date is required');
        }
        $data['ccexp'] = $this->format_expiry_date($card_data['ccexp']);

        // CVV
        if (!empty($card_data['cvv'])) {
            $data['cvv'] = preg_replace('/\D/', '', $card_data['cvv']);
        }

        return $data;
    }

    /**
     * Prepare billing data
     *
     * @param array $payment_data Payment data
     * @return array
     */
    protected function prepare_billing_data(array $payment_data): array
    {
        $data = [];

        $billing_fields = [
            'first_name' => 'first_name',
            'last_name' => 'last_name',
            'company' => 'company',
            'address1' => 'address1',
            'address2' => 'address2',
            'city' => 'city',
            'state' => 'state',
            'zip' => 'zip',
            'country' => 'country',
            'phone' => 'phone',
            'email' => 'email',
        ];

        foreach ($billing_fields as $api_field => $data_field) {
            if (!empty($payment_data[$data_field])) {
                $data[$api_field] = sanitize_text_field($payment_data[$data_field]);
            }
        }

        return $data;
    }

    /**
     * Prepare shipping data
     *
     * @param array $shipping_data Shipping data
     * @return array
     */
    protected function prepare_shipping_data(array $shipping_data): array
    {
        $data = [];

        $shipping_fields = [
            'shipping_first_name' => 'first_name',
            'shipping_last_name' => 'last_name',
            'shipping_company' => 'company',
            'shipping_address1' => 'address1',
            'shipping_address2' => 'address2',
            'shipping_city' => 'city',
            'shipping_state' => 'state',
            'shipping_zip' => 'zip',
            'shipping_country' => 'country',
        ];

        foreach ($shipping_fields as $api_field => $data_field) {
            if (!empty($shipping_data[$data_field])) {
                $data[$api_field] = sanitize_text_field($shipping_data[$data_field]);
            }
        }

        return $data;
    }

    /**
     * Format expiry date for NMI API
     *
     * @param string $expiry Expiry date in various formats
     * @return string Formatted as MMYY
     */
    protected function format_expiry_date(string $expiry): string
    {
        // Remove any non-digit characters
        $expiry = preg_replace('/\D/', '', $expiry);

        // Handle different input formats
        if (strlen($expiry) === 4) {
            // MMYY format
            return $expiry;
        } elseif (strlen($expiry) === 6) {
            // MMYYYY format - convert to MMYY
            return substr($expiry, 0, 2) . substr($expiry, 4, 2);
        }

        // If we can't parse it, return as-is and let NMI handle the error
        return $expiry;
    }

    /**
     * Get payment method from card number
     *
     * @param string $card_number Credit card number
     * @return string Payment method
     */
    protected function get_card_type(string $card_number): string
    {
        $card_number = preg_replace('/\D/', '', $card_number);
        
        $patterns = [
            'visa' => '/^4/',
            'mastercard' => '/^5[1-5]/',
            'amex' => '/^3[47]/',
            'discover' => '/^6(?:011|5)/',
            'diners' => '/^3[0689]/',
            'jcb' => '/^35/',
        ];

        foreach ($patterns as $type => $pattern) {
            if (preg_match($pattern, $card_number)) {
                return $type;
            }
        }

        return 'unknown';
    }

    /**
     * Validate card number using Luhn algorithm
     *
     * @param string $card_number Credit card number
     * @return bool
     */
    protected function validate_card_number(string $card_number): bool
    {
        $card_number = preg_replace('/\D/', '', $card_number);
        
        if (strlen($card_number) < 13 || strlen($card_number) > 19) {
            return false;
        }

        $sum = 0;
        $alternate = false;

        for ($i = strlen($card_number) - 1; $i >= 0; $i--) {
            $digit = (int) $card_number[$i];

            if ($alternate) {
                $digit *= 2;
                if ($digit > 9) {
                    $digit = ($digit % 10) + 1;
                }
            }

            $sum += $digit;
            $alternate = !$alternate;
        }

        return ($sum % 10) === 0;
    }
}