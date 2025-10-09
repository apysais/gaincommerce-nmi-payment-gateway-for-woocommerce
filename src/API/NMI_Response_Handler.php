<?php
/**
 * NMI API Response Handler Class
 *
 * @package APNMIPaymentGateway
 * @subpackage API
 * @author Gain Commerce
 * @license GPL-2.0-or-later
 * @link https://www.gaincommerce.com/
 * @since 1.0.0
 */

namespace APNMIPaymentGateway\API;

use APNMIPaymentGateway\Logger;
use APNMIPaymentGateway\Single_Instance_Trait;
use WP_Error;

/**
 * NMI API Response Handler Class
 *
 * Handles and standardizes NMI API responses
 */
class NMI_Response_Handler
{
    use Single_Instance_Trait;

    /**
     * Logger instance
     *
     * @var Logger
     */
    protected Logger $logger;

    /**
     * Constructor
     */
    public function __construct()
    {
        $this->logger = Logger::get_instance();
    }

    /**
     * Process and standardize an NMI API response
     *
     * @param array|WP_Error $response Raw API response
     * @return array Standardized response
     */
    public function process_response($response): array
    {
        if (is_wp_error($response)) {
            return $this->format_error_response($response);
        }

        return $this->format_success_response($response);
    }

    /**
     * Check if response indicates success
     *
     * @param array $response API response
     * @return bool
     */
    public function is_successful(array $response): bool
    {
        return isset($response['response']) && $response['response'] === '1';
    }

    /**
     * Check if response indicates approval
     *
     * @param array $response API response
     * @return bool
     */
    public function is_approved(array $response): bool
    {
        return $this->is_successful($response) && 
               isset($response['response_code']) && 
               $response['response_code'] === '100';
    }

    /**
     * Check if response indicates decline
     *
     * @param array $response API response
     * @return bool
     */
    public function is_declined(array $response): bool
    {
        return isset($response['response']) && 
               $response['response'] === '2';
    }

    /**
     * Check if response indicates error
     *
     * @param array $response API response
     * @return bool
     */
    public function is_error(array $response): bool
    {
        return isset($response['response']) && 
               $response['response'] === '3';
    }

    /**
     * Get transaction ID from response
     *
     * @param array $response API response
     * @return string|null
     */
    public function get_transaction_id(array $response): ?string
    {
        return $response['transactionid'] ?? null;
    }

    /**
     * Get authorization code from response
     *
     * @param array $response API response
     * @return string|null
     */
    public function get_auth_code(array $response): ?string
    {
        return $response['authcode'] ?? null;
    }

    /**
     * Get response message
     *
     * @param array $response API response
     * @return string
     */
    public function get_response_message(array $response): string
    {
        return $response['responsetext'] ?? 'Unknown response';
    }

    /**
     * Get response code
     *
     * @param array $response API response
     * @return string|null
     */
    public function get_response_code(array $response): ?string
    {
        return $response['response_code'] ?? null;
    }

    /**
     * Get CVV response
     *
     * @param array $response API response
     * @return string|null
     */
    public function get_cvv_response(array $response): ?string
    {
        return $response['cvvresponse'] ?? null;
    }

    /**
     * Get AVS response
     *
     * @param array $response API response
     * @return string|null
     */
    public function get_avs_response(array $response): ?string
    {
        return $response['avsresponse'] ?? null;
    }

    /**
     * Get customer vault ID from response
     *
     * @param array $response API response
     * @return string|null
     */
    public function get_customer_vault_id(array $response): ?string
    {
        return $response['customer_vault_id'] ?? null;
    }

    /**
     * Format a successful response
     *
     * @param array $response Raw API response
     * @return array Formatted response
     */
    protected function format_success_response(array $response): array
    {
        $this->logger->debug('NMI Response Handler: Formatting success response', [
            'response_code' => $response['response'] ?? 'unknown',
            'transaction_id' => $response['transactionid'] ?? 'N/A',
        ]);

        return [
            'success' => $this->is_successful($response),
            'approved' => $this->is_approved($response),
            'declined' => $this->is_declined($response),
            'error' => $this->is_error($response),
            'transaction_id' => $this->get_transaction_id($response),
            'auth_code' => $this->get_auth_code($response),
            'response_code' => $this->get_response_code($response),
            'response_message' => $this->get_response_message($response),
            'cvv_response' => $this->get_cvv_response($response),
            'avs_response' => $this->get_avs_response($response),
            'customer_vault_id' => $this->get_customer_vault_id($response),
            'reponse' => $response['response'],
            'raw_response' => $response,
        ];
    }

    /**
     * Format an error response
     *
     * @param WP_Error $error WP_Error object
     * @return array Formatted error response
     */
    protected function format_error_response(WP_Error $error): array
    {
        $this->logger->error('NMI Response Handler: Formatting error response', [
            'error_code' => $error->get_error_code(),
            'error_message' => $error->get_error_message(),
        ]);

        return [
            'success' => false,
            'approved' => false,
            'declined' => false,
            'error' => true,
            'transaction_id' => null,
            'auth_code' => null,
            'response_code' => $error->get_error_code(),
            'response_message' => $error->get_error_message(),
            'cvv_response' => null,
            'avs_response' => null,
            'customer_vault_id' => null,
            'raw_response' => $error->get_error_data(),
        ];
    }

    /**
     * Get human-readable status from response
     *
     * @param array $response API response
     * @return string
     */
    public function get_status_text(array $response): string
    {
        if ($this->is_approved($response)) {
            return 'Approved';
        }

        if ($this->is_declined($response)) {
            return 'Declined';
        }

        if ($this->is_error($response)) {
            return 'Error';
        }

        return 'Unknown';
    }

    /**
     * Get detailed response information for logging
     *
     * @param array $response API response
     * @return array
     */
    public function get_response_details(array $response): array
    {
        return [
            'status' => $this->get_status_text($response),
            'transaction_id' => $this->get_transaction_id($response),
            'auth_code' => $this->get_auth_code($response),
            'response_code' => $this->get_response_code($response),
            'response_message' => $this->get_response_message($response),
            'cvv_result' => $this->interpret_cvv_response($this->get_cvv_response($response)),
            'avs_result' => $this->interpret_avs_response($this->get_avs_response($response)),
        ];
    }

    /**
     * Interpret CVV response code
     *
     * @param string|null $cvv_response CVV response code
     * @return string
     */
    protected function interpret_cvv_response(?string $cvv_response): string
    {
        if (empty($cvv_response)) {
            return 'Not processed';
        }

        $cvv_codes = [
            'M' => 'Match',
            'N' => 'No match',
            'P' => 'Not processed',
            'S' => 'Should have been present',
            'U' => 'Issuer unable to process request',
        ];

        return $cvv_codes[$cvv_response] ?? "Unknown ({$cvv_response})";
    }

    /**
     * Interpret AVS response code
     *
     * @param string|null $avs_response AVS response code
     * @return string
     */
    protected function interpret_avs_response(?string $avs_response): string
    {
        if (empty($avs_response)) {
            return 'Not processed';
        }

        $avs_codes = [
            'X' => 'Exact match (9-digit ZIP and address)',
            'Y' => 'Exact match (5-digit ZIP and address)',
            'A' => 'Address match only',
            'W' => '9-digit ZIP match only',
            'Z' => '5-digit ZIP match only',
            'N' => 'No match',
            'U' => 'Address unavailable',
            'G' => 'Non-U.S. issuer',
            'R' => 'Retry',
            'E' => 'Error',
            'S' => 'Service not supported',
        ];

        return $avs_codes[$avs_response] ?? "Unknown ({$avs_response})";
    }
}
