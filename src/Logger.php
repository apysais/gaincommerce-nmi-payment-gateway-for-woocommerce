<?php

namespace APNMIPaymentGateway;
use APNMIPaymentGateway\Single_Instance_Trait;
use APNMIPaymentGateway\Gateway;
use WooCommerce\WC_Logger;
class Logger
{
    use Single_Instance_Trait;

    private const LOG_SOURCE = 'gaincommerce-nmi-gateway';
    
    private $_wc_logger = null;

    public function __construct()
    {
        if(function_exists('wc_get_logger')) {
            $this->_wc_logger = wc_get_logger();
        } else {
            $this->_wc_logger = new WC_Logger();
        }
    }

    /**
     * Log an emergency message
     *
     * @param string $message The log message
     * @param array  $context Additional context data
     * @return void
     */
    public function emergency(string $message, array $context = []): void
    {
        $this->log('emergency', $message, $context);
    }
    
    /**
     * Log an alert message
     *
     * @param string $message The log message
     * @param array  $context Additional context data
     * @return void
     */
    public function alert(string $message, array $context = []): void
    {
        $this->log('alert', $message, $context);
    }
    
    /**
     * Log a critical message
     *
     * @param string $message The log message
     * @param array  $context Additional context data
     * @return void
     */
    public function critical(string $message, array $context = []): void
    {
        $this->log('critical', $message, $context);
    }
    
    /**
     * Log an error message
     *
     * @param string $message The log message
     * @param array  $context Additional context data
     * @return void
     */
    public function error(string $message, array $context = []): void
    {
        $this->log('error', $message, $context);
    }
    
    /**
     * Log a warning message
     *
     * @param string $message The log message
     * @param array  $context Additional context data
     * @return void
     */
    public function warning(string $message, array $context = []): void
    {
        $this->log('warning', $message, $context);
    }
    
    /**
     * Log a notice message
     *
     * @param string $message The log message
     * @param array  $context Additional context data
     * @return void
     */
    public function notice(string $message, array $context = []): void
    {
        $this->log('notice', $message, $context);
    }
    
    /**
     * Log an info message
     *
     * @param string $message The log message
     * @param array  $context Additional context data
     * @return void
     */
    public function info(string $message, array $context = []): void
    {
        $this->log('info', $message, $context);
    }
    
    /**
     * Log a debug message
     *
     * @param string $message The log message
     * @param array  $context Additional context data
     * @return void
     */
    public function debug(string $message, array $context = []): void
    {
        $this->log('debug', $message, $context);
    }
    
    /**
     * Log a transaction
     *
     * @param string $type Transaction type
     * @param array  $data Transaction data
     * @return void
     */
    public function log_transaction(string $type, array $data): void
    {
        $message = sprintf('Transaction %s: %s', $type, $data['transaction_id'] ?? 'N/A');
        $this->info($message, $data);
    }
    
    /**
     * Log an API request
     *
     * @param string $endpoint API endpoint
     * @param array  $request  Request data
     * @param array  $response Response data
     * @return void
     */
    public function log_api_request(string $endpoint, array $request, array $response): void
    {
        $message = sprintf('API Request to %s', $endpoint);
        
        $context = [
            'endpoint' => $endpoint,
            'request' => $this->sanitized_data($request),
            'response' => $this->sanitized_data($response),
        ];
        
        $this->debug($message, $context);
    }
    
    /**
     * Log webhook data
     *
     * @param string $event_type Webhook event type
     * @param array  $payload    Webhook payload
     * @return void
     */
    public function log_webhook(string $event_type, array $payload): void
    {
        $message = sprintf('Webhook received: %s', $event_type);
        
        $context = [
            'event_type' => $event_type,
            'payload' => $this->sanitized_data($payload),
        ];
        
        $this->info($message, $context);
    }
    
    /**
     * Main logging method
     *
     * @param string $level   Log level
     * @param string $message Log message
     * @param array  $context Additional context
     * @return void
     */
    private function log(string $level, string $message, array $context = []): void
    {
        if (!$this->is_logging_enabled()) {
            return;
        }
        
        if ($this->_wc_logger) {
            $formatted_message = $this->format_message($message, $context);
            $this->_wc_logger->log($level, $formatted_message, ['source' => self::LOG_SOURCE]);
        }
    }
    
    /**
     * Format log message with context
     *
     * @param string $message The base message
     * @param array  $context Context data
     * @return string
     */
    private function format_message(string $message, array $context): string
    {
        if (empty($context)) {
            return $message;
        }
        
        $formatted_context = [];
        foreach ($context as $key => $value) {
            if (is_array($value) || is_object($value)) {
                $formatted_context[] = $key . ': ' . wp_json_encode($value);
            } else {
                $formatted_context[] = $key . ': ' . $value;
            }
        }
        
        return $message . ' | ' . implode(' | ', $formatted_context);
    }
    
    /**
     * Sanitize sensitive data for logging
     *
     * @param array $data Data to sanitize
     * @return array
     */
    private function sanitized_data(array $data): array
    {
        $sensitive_fields = [
            'password',
            'security-key',
            'ccnumber',
            'ccexp',
            'cvv',
            'checkaba',
            'checkaccount',
            'checkname',
            'account_number',
            'routing_number',
        ];
        
        $sanitized = $data;
        
        foreach ($sensitive_fields as $field) {
            if (isset($sanitized[$field])) {
                if (in_array($field, ['ccnumber', 'account_number'], true)) {
                    // Show only last 4 digits
                    $value = (string) $sanitized[$field];
                    $sanitized[$field] = '***' . substr($value, -4);
                } else {
                    // Hide completely
                    $sanitized[$field] = '***';
                }
            }
        }
        
        return $sanitized;
    }
    
    /**
     * Check if logging is enabled
     *
     * @return bool
     */
    private function is_logging_enabled(): bool
    {
        $cc_gateway = new Gateway();
        return $cc_gateway->get_option('logging') === 'yes';
    }
    
    /**
     * Get log file path
     *
     * @return string
     */
    public function get_log_file_path(): string
    {
        if ($this->_wc_logger && method_exists($this->_wc_logger, 'get_log_file_path')) {
            return $this->_wc_logger->get_log_file_path(self::LOG_SOURCE);
        }
        
        return '';
    }
    
    /**
     * Clear log files
     *
     * @return bool
     */
    public function clear_logs(): bool
    {
        $log_path = $this->get_log_file_path();
        
        if (!empty($log_path) && file_exists($log_path)) {
            return wp_delete_file($log_path);
        }
        
        return false;
    }

}