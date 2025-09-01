<?php

namespace APNMIPaymentGateway\WC;

class Void_Transaction
{

    public function init_hook()
    {
        // Constructor code
        // capture the woocommerce change order status of cancel and check if it has transaction ID and void it
        // note: refunded orders should not be voided
        add_action( 'woocommerce_order_status_cancelled', 'my_custom_cancelled_order_action' );
    }

    /**
     * Process a void transaction
     *
     * @param int $transaction_id The ID of the transaction to void
     * @return bool True on success, false on failure
     */
    public function process_void($transaction_id)
    {
        // Logic to void the transaction using the NMI API
        // This is a placeholder for actual implementation
        return true;
    }
}