<?php
/**
 * NMI API Payment Factory Class
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
use APNMIPaymentGateway\API\NMI_Payment_API;
use APNMIPaymentGateway\API\NMI_Response_Handler;
/**
 * NMI API Factory Class
 *
 * Factory for creating and configuring NMI API instances
 */
class NMI_API_Factory
{
    use Single_Instance_Trait;

    /**
     * Logger instance
     *
     * @var Logger
     */
    protected Logger $logger;

    /**
     * Default configuration
     *
     * @var array
     */
    protected array $default_config = [];

    /**
     * Constructor
     */
    public function __construct()
    {
        $this->logger = Logger::get_instance();
        //$this->load_default_config();
    }

    /**
     * Create a payment API instance
     *
     * @param array $config Optional configuration override
     * @return NMI_Payment_API
     */
    public function create_payment_api(array $config = []): NMI_Payment_API
    {
        //$final_config = array_merge($this->default_config, $config);
        $config = wp_parse_args($this->default_config, $config);

        $this->logger->debug('NMI API Factory: Creating payment API instance', [
            'test_mode' => $config['test_mode'] ?? false,
        ]);

        return new NMI_Payment_API($config);
    }

    /**
     * Create a response handler instance
     *
     * @return NMI_Response_Handler
     */
    public function create_response_handler(): NMI_Response_Handler
    {
        $this->logger->debug('NMI API Factory: Creating response handler instance');
        
        return new NMI_Response_Handler();
    }

    /**
     * Set default configuration
     *
     * @param array $config Configuration array
     * @return void
     */
    public function set_default_config(array $config): void
    {
        $this->default_config = array_merge($this->default_config, $config);
        
        $this->logger->info('NMI API Factory: Default configuration updated', [
            'test_mode' => $this->default_config['test_mode'] ?? false,
            'has_public_key' => !empty($this->default_config['public_key']),
            'has_private_key' => !empty($this->default_config['private_key']),
        ]);
    }

    /**
     * Validate API configuration
     *
     * @param array $config Configuration to validate
     * @return bool
     */
    public function validate_config(array $config): bool
    {
        $test_mode = $config['test_mode'] ?? false;
        $mode_label = $test_mode ? 'test' : 'live';
        
        // Validate private key (required for API requests)
        if (empty($config['private_key'])) {
            $this->logger->warning("NMI API Factory: Missing {$mode_label} private key");
            return false;
        }

        // Public key is optional but recommended
        if (empty($config['public_key'])) {
            $this->logger->info("NMI API Factory: Public key not set for {$mode_label} mode (optional)");
        }

        $this->logger->debug("NMI API Factory: Configuration validation passed for {$mode_label} mode");
        return true;
    }
    
    /**
     * Get API status information
     *
     * @return array
     */
    public function get_api_status(): array
    {
        return [
            'configured' => $this->validate_config($this->default_config),
            'test_mode' => $this->default_config['test_mode'] ?? false,
            'has_public_key' => !empty($this->default_config['public_key']),
            'has_private_key' => !empty($this->default_config['private_key']),
            'last_updated' => current_time('mysql'),
        ];
    }

    /**
     * Test API connectivity
     *
     * @param array $config Optional configuration override
     * @return bool
     */
    public function test_connection(array $config = []): bool
    {
        try {
            $payment_api = $this->create_payment_api($config);
            
            // Perform a simple validation request to test connectivity
            $test_data = [
                'ccnumber' => '4111111111111111',
                'ccexp' => '1225',
                'cvv' => '123',
                'amount' => '1.00',
                'first_name' => 'Test',
                'last_name' => 'User',
            ];
            
            $response = $payment_api->validate_card($test_data);
            
            if (is_wp_error($response)) {
                $this->logger->error('NMI API Factory: Connection test failed', [
                    'error' => $response->get_error_message(),
                ]);
                return false;
            }

            $this->logger->info('NMI API Factory: Connection test successful');
            return true;

        } catch (\Exception $e) {
            $this->logger->error('NMI API Factory: Connection test exception', [
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }
}
