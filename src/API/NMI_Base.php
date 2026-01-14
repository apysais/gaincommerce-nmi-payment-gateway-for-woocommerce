<?php
/**
 * Summary of namespace APNMIPaymentGateway\API
 * 
 */
namespace APNMIPaymentGateway\API;

use APNMIPaymentGateway\Logger;
use APNMIPaymentGateway\Single_Instance_Trait;
use WP_Error;

/**
 * Summary of NMI_Base
 * This class serves as the base class for all NMI API-related classes.
 * 
 */
class NMI_Base
{
    use Single_Instance_Trait;

    public const API_URL = 'https://secure.nmi.com/api/transact.php';

    /**
     * Public key for API authentication
     *
     * @var string
     */
    protected string $public_key = '';

    /**
     * Private key for API authentication
     *
     * @var string
     */
    protected string $private_key = '';

    /**
     * Test mode flag
     *
     * @var bool
     */
    protected bool $test_mode = false;

    /**
     * Logger instance
     *
     * @var Logger
     */
    protected Logger $logger;

    /**
     * Last API response
     *
     * @var array|null
     */
    protected ?array $last_response = null;

    /**
     * Request timeout in seconds
     */
    public const REQUEST_TIMEOUT = 45;

    public function __construct(array $config = [])
    {
        $this->logger = Logger::get_instance();
        
        if (!empty($config)) {
            $this->configure($config);
        }
        
    }

    /**
     * Configure the API client
     *
     * @param array $config Configuration array
     * @return void
     */
    public function configure(array $config): void
    {
        $this->public_key = $config['public_key'] ?? '';
        $this->private_key = $config['private_key'] ?? '';
        $this->test_mode = $config['test_mode'] ?? false;

        // Log configuration details for debugging
        $this->logger->info('NMI API: Client configured', [
            'test_mode' => $this->test_mode,
            'has_public_key' => !empty($this->public_key),
            'has_private_key' => !empty($this->private_key),
            'mode_type' => $this->test_mode ? 'SANDBOX/TEST' : 'LIVE/PRODUCTION',
            'endpoint' => self::API_URL,
        ]);

        // Validate that we have the required keys for the current mode
        if (empty($this->private_key)) {
            $mode_label = $this->test_mode ? 'test' : 'live';
            $this->logger->error("NMI API: Missing {$mode_label} private key for {$mode_label} mode");
        }
    }

    /**
     * Get the appropriate API endpoint based on test mode
     *
     * @return string
     */
    protected function get_api_endpoint(): string
    {
        $base_url = self::API_URL;

        // Add private key as security_key query parameter as required by NMI
        if (!empty($this->private_key)) {
            //$base_url .= '?security_key=' . urlencode($this->private_key);
        }
        
        return $base_url;
    }

    /**
     * Make an API request to NMI
     *
     * @param array $data Request data
     * @param int   $retry_count Current retry attempt
     * @return array|WP_Error
     */
    public function make_post_request(array $data, int $retry_count = 0)
    {
        
        // Validate required fields
        $validation_error = $this->validate_request_data($data);
        if ($validation_error) {
            return $validation_error;
        }

        $data = apply_filters('gaincommerce_nmi_api_request_data', $data);

        $endpoint = $this->get_api_endpoint();
        
        $data['security_key'] = $this->private_key; // Add private key to request data

        $this->logger->info('NMI API: Making request', [
            'endpoint' => $endpoint,
            'type' => $data['type'] ?? 'unknown',
            'retry_count' => $retry_count,
            'test_mode' => $this->test_mode,
        ]);

        $args = [
            'method'      => 'POST',
            'timeout'     => self::REQUEST_TIMEOUT,
            'redirection' => 5,
            'httpversion' => '1.1',
            'blocking'    => true,
            'headers'     => [
                'Content-Type' => 'application/x-www-form-urlencoded',
                'User-Agent'   => $this->get_user_agent(),
            ],
            'body'        => http_build_query($data),
            'cookies'     => [],
            'sslverify'   => true,
        ];

        $response = wp_remote_post($endpoint, $args);

        if (is_wp_error($response)) {
            $this->logger->error('NMI API: Request failed', [
                'error' => $response->get_error_message(),
                'retry_count' => $retry_count,
            ]);

            // Retry logic
            // if ($retry_count < self::MAX_RETRIES) {
            //     $this->logger->info('NMI API: Retrying request', ['retry_count' => $retry_count + 1]);
            //     sleep(1); // Wait 1 second before retry
            //     return $this->make_request($data, $retry_count + 1);
            // }

            return $response;
        }

        $response_code = wp_remote_retrieve_response_code($response);
        $response_body = wp_remote_retrieve_body($response);

        if ($response_code !== 200) {
            $error_message = sprintf('HTTP %d: %s', $response_code, wp_remote_retrieve_response_message($response));
            
            $this->logger->error('NMI API: HTTP error', [
                'response_code' => $response_code,
                'response_body' => $response_body,
            ]);

            return new WP_Error('nmi_http_error', $error_message, [
                'response_code' => $response_code,
                'response_body' => $response_body,
            ]);
        }

        $parsed_response = $this->parse_response($response_body);
        $this->last_response = $parsed_response;

        $this->logger->info('NMI API: Request completed', [
            'response_code' => $response_code,
            'transaction_id' => $parsed_response['transactionid'] ?? 'N/A',
            'response_status' => $parsed_response['response'] ?? 'unknown',
        ]);

        return $parsed_response;
    }

    /**
     * Validate request data before sending
     *
     * @param array $data Request data
     * @return WP_Error|null
     */
    public function validate_request_data(array $data): ?WP_Error
    {
        // Check for required authentication - private key is in URL, check if we have it
        if (empty($this->private_key)) {
            $mode_label = $this->test_mode ? 'test' : 'live';
            return new WP_Error(
                'nmi_auth_error', 
                "Private key is required for {$mode_label} mode API requests"
            );
        }

        // Check for required transaction type
        if (empty($data['type'])) {
            return new WP_Error('nmi_validation_error', 'Transaction type is required');
        }

        // Check in settings for this restricted type card.
        // Validate transaction type
        $valid_types = ['sale', 'auth', 'capture', 'void', 'refund', 'credit', 'validate', 'generic'];
        if (!in_array($data['type'], $valid_types, true)) {
            return new WP_Error('nmi_validation_error', 'Invalid transaction type: ' . $data['type']);
        }

        return null;
    }

    /**
     * Validate that the correct keys are configured for the current mode
     *
     * @return bool
     */
    public function validate_keys_for_mode(): bool
    {
        $mode_label = $this->test_mode ? 'test' : 'live';
        
        if (empty($this->private_key)) {
            $this->logger->error("NMI API: Missing {$mode_label} private key for {$mode_label} mode");
            return false;
        }

        $this->logger->debug("NMI API: Keys validated for {$mode_label} mode", [
            'mode' => $mode_label,
            'has_private_key' => !empty($this->private_key),
            'has_public_key' => !empty($this->public_key),
        ]);

        return true;
    }

     /**
     * Parse the API response
     *
     * @param string $response_body Raw response body
     * @return array
     */
    protected function parse_response(string $response_body): array
    {
        $parsed = [];
        parse_str($response_body, $parsed);

        // Log the parsed response (without sensitive data)
        $log_data = $parsed;
        unset($log_data['ccnumber'], $log_data['cvv']);
        
        $this->logger->debug('NMI API: Response parsed', $log_data);

        return $parsed;
    }

    /**
     * Get the user agent string for API requests
     *
     * @return string
     */
    protected function get_user_agent(): string
    {
        global $wp_version;
        
        $plugin_version = defined('AP_NMI_PAYMENT_GATEWAY_VERSION') ? AP_NMI_PAYMENT_GATEWAY_VERSION : '1.0.0';
        
        return sprintf(
            'WordPress/%s WooCommerce/%s AP-NMI-Gateway/%s (PHP/%s)',
            $wp_version,
            defined('WC_VERSION') ? WC_VERSION : 'unknown',
            $plugin_version,
            PHP_VERSION
        );
    }

    /**
     * Get the last API response
     *
     * @return array|null
     */
    public function get_last_response(): ?array
    {
        return $this->last_response;
    }

    /**
     * Check if the last response was successful
     *
     * @return bool
     */
    public function is_last_response_successful(): bool
    {
        return isset($this->last_response['response']) && $this->last_response['response'] === '1';
    }

    /**
     * Get error message from the last response
     *
     * @return string
     */
    public function get_last_error_message(): string
    {
        if (empty($this->last_response)) {
            return 'No response available';
        }

        return $this->last_response['responsetext'] ?? 'Unknown error occurred';
    }

    /**
     * Get transaction ID from the last response
     *
     * @return string|null
     */
    public function get_last_transaction_id(): ?string
    {
        return $this->last_response['transactionid'] ?? null;
    }

    /**
     * Sanitize sensitive data for logging
     *
     * @param array $data Data to sanitize
     * @return array
     */
    protected function sanitize_for_logging(array $data): array
    {
        $sanitized = $data;
        $sensitive_fields = [
            'ccnumber', 'cvv', 'checkaccount', 'checkaba'
        ];

        foreach ($sensitive_fields as $field) {
            if (isset($sanitized[$field])) {
                $sanitized[$field] = str_repeat('*', strlen($sanitized[$field]));
            }
        }

        return $sanitized;
    }
}