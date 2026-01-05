<?php
if ( ! defined( 'ABSPATH' ) ) exit;

$description        = isset($args['description']) ? $args['description'] : '';
$gateway_id         = isset($args['gateway_id']) ? $args['gateway_id'] : '';
$is_on_test_mode    = isset($args['is_on_test_mode']) ? $args['is_on_test_mode'] : false;
$test_mode_notes    = isset($args['test_mode_notes']) ? $args['test_mode_notes'] : '';
$use_collect_js     = isset($args['use_collect_js']) ? $args['use_collect_js'] : false;
$display_accepted_cards = isset($args['display_accepted_cards']) ? $args['display_accepted_cards'] : false;
?>
<div>
    <p><?php echo wp_kses_post( $description  );?></p>
    <?php if($is_on_test_mode) : ?>
        <p><?php echo wp_kses_post( $test_mode_notes ); ?></p>
    <?php endif; ?>

    <fieldset id="wc-<?php echo esc_attr( $gateway_id ); ?>-payment-form" class="ap-nmi-payment-form loading">

    <?php
        // Add this action hook if you want your custom payment gateway to support it
        do_action( 'woocommerce_credit_card_form_start', $gateway_id );
    ?>
    <div id="ap-nmi-wc-fields-container">
        <?php
            wc_get_template(
                'public/api-collectjs-fields.php',
                $args, // Pass data as needed
                '', // No override path
                apnmi_get_plugin_dir() . 'template/'
            );
        ?>
    </div>

    <?php
        // Add this action hook if you want your custom payment gateway to support it
        do_action( 'woocommerce_credit_card_form_end', $gateway_id );
    ?>

    <?php 
        // Save payment method checkbox
        $save_payment_enabled = isset($args['save_payment_enabled']) ? $args['save_payment_enabled'] : false;
        if ($save_payment_enabled) :
            do_action('gaincommerce_before_save_payment_checkbox', $gateway_id);
    ?>
    <p class="form-row form-row-wide">
        <label class="woocommerce-form__label woocommerce-form__label-for-checkbox checkbox">
            <input id="save_payment_method" type="checkbox" value="1" />
            <span><?php esc_html_e('Save payment method for future purchases', 'gaincommerce-nmi-payment-gateway-for-woocommerce'); ?></span>
        </label>
    </p>
    <?php
            do_action('gaincommerce_after_save_payment_checkbox', $gateway_id);
        endif;
    ?>
</div>
