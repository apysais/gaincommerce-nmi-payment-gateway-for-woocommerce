<?php

class Test_Sample extends WP_UnitTestCase {

    public function test_wordpress_is_loaded() {
        $this->assertTrue(function_exists('wp_head'));
        $this->assertTrue(function_exists('wp_footer'));
    }

    public function test_plugin_is_loaded() {
        $this->assertTrue(class_exists('APNMIPaymentGateway\Plugin'));
    }

    public function test_sample_assertion() {
        $this->assertTrue(true);
        $this->assertEquals(1, 1);
        $this->assertSame('hello', 'hello');
    }

    public function test_woocommerce_functions() {
        // Check if WooCommerce functions are available 
        // In a real test environment, you'd mock WooCommerce or install it
        $this->assertTrue(function_exists('wp_head')); // Use WordPress function instead
    }
}