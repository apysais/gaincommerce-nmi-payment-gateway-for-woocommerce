<?php
use APNMIPaymentGateway\Gateway;
class TestGatewayOptionData extends PHPUnit\Framework\TestCase {
    public function test_sample() {
        $this->assertTrue(true);
    }

    public function test_get_option()
    {
        $gateway = new Gateway;

        $private_key = $gateway->get_option('private_key');
        $public_key = $gateway->get_option('public_key');

        $this->assertNotEmpty($public_key);
        $this->assertNotEmpty($private_key);
    }
}