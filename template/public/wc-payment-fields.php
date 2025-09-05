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
</div>
