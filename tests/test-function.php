<?php

function apnmi_test_random_float_amount()
{
    $min = 1.00;
	$max = 100.00;
	return $min + mt_rand() / mt_getrandmax() * ($max - $min);
}

function apnmi_test_gateway_config()
{
    $gateway = \APNMIPaymentGateway\Gateway::get_instance();
    $config = [
        'testmode' => $gateway->testmode,
        'private_key' => $gateway->private_key,
        'public_key' => $gateway->public_key
    ];

    return $config;
}
function apnmi_test_api_payment()
{
    $config = apnmi_test_gateway_config();

    $payload_data = [
        'type' => 'sale',
        'amount' => apnmi_test_random_float_amount(),
        'ccnumber' => '4111111111111111',
        'ccexp' => '12/25',
        'cvv' => '123'
    ];

    $nmi_api = new APNMIPaymentGateway\API\NMI_Base($config);
    $request = $nmi_api->make_post_request($payload_data);
    apnmi_dd($request, 1);
}

function apnmi_test_payment_api()
{
    $config = apnmi_test_gateway_config();
    $payment_api = new \APNMIPaymentGateway\API\NMI_Payment_API($config);
    $payload_data = [
        'type' => 'sale',
        'amount' => apnmi_test_random_float_amount(),
        'ccnumber' => '4111111111111111',
        'ccexp' => '12/25',
        'cvv' => '123'
    ];

    $ret = $payment_api->process_sale($payload_data);
    apnmi_dd($ret, 1);  
}

function apnmi_test_payment_factory()
{
    $config = apnmi_test_gateway_config();
    $factory = \APNMIPaymentGateway\API\NMI_API_Factory::get_instance();

    $payment_api = $factory->create_payment_api($config);
    apnmi_dd($payment_api);
    $response_handler = $factory->create_response_handler($payment_api);
    apnmi_dd($response_handler);

    $payload_data = [
        'type' => 'sale',
        'amount' => apnmi_test_random_float_amount(),
        'ccnumber' => '4111111111111111',
        'ccexp' => '1225',
        'cvv' => '123'
    ];
    $api_response = $payment_api->process_sale($payload_data);
    apnmi_dd($api_response);

    $processed_response = $response_handler->process_response($api_response);
    apnmi_dd($processed_response);
    if ($response_handler->is_approved($api_response) ) {
        // Handle approved payment
        echo 'success <br>';
        $transaction_id = $response_handler->get_transaction_id($api_response);
        echo 'transaction ID : ' . $transaction_id . '<br>';
    }

    apnmi_dd([],1);
}

function apnmi_test_auth()
{
    $config = apnmi_test_gateway_config();
    $factory = \APNMIPaymentGateway\API\NMI_API_Factory::get_instance();

    $payment_api = $factory->create_payment_api($config);
    apnmi_dd($payment_api);
    $response_handler = $factory->create_response_handler($payment_api);
    apnmi_dd($response_handler);

    $payload_data = [
        'type' => 'sale',
        'amount' => apnmi_test_random_float_amount(),
        'ccnumber' => '4111111111111111',
        'ccexp' => '12/25',
        'cvv' => '123'
    ];
    $api_response = $payment_api->process_auth($payload_data);
    apnmi_dd($api_response);

    $processed_response = $response_handler->process_response($api_response);
    apnmi_dd($processed_response);
    if ($response_handler->is_approved($api_response) ) {
        // Handle approved payment
        echo 'success <br>';
        $transaction_id = $response_handler->get_transaction_id($api_response);
        echo 'transaction ID : ' . $transaction_id . '<br>';
    }

    apnmi_dd([],1);
}

function apnmi_test_capture()
{
    $config = apnmi_test_gateway_config();
    $factory = \APNMIPaymentGateway\API\NMI_API_Factory::get_instance();

    $payment_api = $factory->create_payment_api($config);
    apnmi_dd($payment_api);
    $response_handler = $factory->create_response_handler($payment_api);
    apnmi_dd($response_handler);

    $transaction_id = '11051068055';
    $amount = 82.26;

    $api_response = $payment_api->capture_transaction($transaction_id, $amount);
    apnmi_dd($api_response);

    $processed_response = $response_handler->process_response($api_response);
    apnmi_dd($processed_response);
    if ($response_handler->is_approved($api_response) ) {
        // Handle approved payment
        echo 'success <br>';
        $transaction_id = $response_handler->get_transaction_id($api_response);
        echo 'transaction ID : ' . $transaction_id . '<br>';
    }

    apnmi_dd([],1);
}

function apnmi_test_auth_capture()
{
    $config = apnmi_test_gateway_config();
    $factory = \APNMIPaymentGateway\API\NMI_API_Factory::get_instance();

    $payment_api = $factory->create_payment_api($config);
    apnmi_dd($payment_api);
    $response_handler = $factory->create_response_handler($payment_api);
    apnmi_dd($response_handler);

    $payload_data = [
        'type' => 'sale',
        'amount' => apnmi_test_random_float_amount(),
        'ccnumber' => '4111111111111111',
        'ccexp' => '12/25',
        'cvv' => '123'
    ];
    $api_response = $payment_api->process_auth($payload_data);
    apnmi_dd($api_response);

    $processed_response = $response_handler->process_response($api_response);
    apnmi_dd($processed_response);
    if ($response_handler->is_approved($api_response) ) {
        // Handle approved payment
        echo 'success auth <br>';
        $transaction_id = $response_handler->get_transaction_id($api_response);
        echo 'transaction ID : ' . $transaction_id . '<br>';

        //capture
        $capture_response = $payment_api->capture_transaction($transaction_id, $payload_data['amount']);
        apnmi_dd($capture_response);
        $capture_processed_response = $response_handler->process_response($capture_response);
        apnmi_dd($capture_processed_response);
        if ($response_handler->is_approved($capture_response) ) {
            // Handle approved payment
            echo 'success capture <br>';
            $transaction_id = $response_handler->get_transaction_id($capture_response);
            echo 'transaction ID : ' . $transaction_id . '<br>';
        }
    }

    apnmi_dd([],1);
}

function apnmi_test_refund()
{
    $config = apnmi_test_gateway_config();
    $factory = \APNMIPaymentGateway\API\NMI_API_Factory::get_instance();

    $payment_api = $factory->create_payment_api($config);
    apnmi_dd($payment_api);
    $response_handler = $factory->create_response_handler($payment_api);
    apnmi_dd($response_handler);

    $transaction_id = '11051078372';
    $amount = 34.91;
    $api_response = $payment_api->refund_transaction($transaction_id, $amount);
    apnmi_dd($api_response);

    $processed_response = $response_handler->process_response($api_response);
    apnmi_dd($processed_response);
    if ($response_handler->is_approved($api_response) ) {
        // Handle approved payment
        echo 'success <br>';
        $transaction_id = $response_handler->get_transaction_id($api_response);
        echo 'transaction ID : ' . $transaction_id . '<br>';
    }

    apnmi_dd([],1);
}

function apnmi_test_void()
{
    $config = apnmi_test_gateway_config();
    $factory = \APNMIPaymentGateway\API\NMI_API_Factory::get_instance();

    $payment_api = $factory->create_payment_api($config);
    apnmi_dd($payment_api);
    $response_handler = $factory->create_response_handler($payment_api);
    apnmi_dd($response_handler);

    $transaction_id = '11002486732';
    $amount = 34.91;
    $api_response = $payment_api->void_transaction($transaction_id);
    apnmi_dd($api_response);

    $processed_response = $response_handler->process_response($api_response);
    apnmi_dd($processed_response);
    if ($response_handler->is_approved($api_response) ) {
        // Handle approved payment
        echo 'success <br>';
        $transaction_id = $response_handler->get_transaction_id($api_response);
        echo 'transaction ID : ' . $transaction_id . '<br>';
    }

    apnmi_dd([],1);
}
function apnmi_test_connection()
{

}