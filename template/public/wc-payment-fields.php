<?php
if ( ! defined( 'ABSPATH' ) ) exit;

$description        = isset($args['description']) ? $args['description'] : '';
$gateway_id         = isset($args['gateway_id']) ? $args['gateway_id'] : '';
$is_on_test_mode    = isset($args['is_on_test_mode']) ? $args['is_on_test_mode'] : false;
$test_mode_notes    = isset($args['test_mode_notes']) ? $args['test_mode_notes'] : '';
$use_collect_js     = isset($args['use_collect_js']) ? $args['use_collect_js'] : false;
$display_accepted_cards = isset($args['display_accepted_cards']) ? $args['display_accepted_cards'] : false;

// Check for saved payment method (premium feature)
$has_saved_card = false;
$saved_card_details = null;
if (class_exists('GainCommerceNmiEnterprise\\User\\Meta_Save_Payment_Method_CC') && 
    class_exists('GainCommerceNmiEnterprise\\Service\\Get_Customer_Vault_Service')) {
    
    $user_id = get_current_user_id();
    if ($user_id) {
        $has_saved_card = \GainCommerceNmiEnterprise\User\Meta_Save_Payment_Method_CC::has_customer_vault_id_in_user_meta($user_id);
        
        if ($has_saved_card) {
            $customer_vault_id = \GainCommerceNmiEnterprise\User\Meta_Save_Payment_Method_CC::get_customer_vault_id_from_user_meta($user_id);
            $saved_card_details = \GainCommerceNmiEnterprise\Service\Get_Customer_Vault_Service::get_cc_details($customer_vault_id, $user_id);
        }
    }
}
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

    <?php if ($has_saved_card && $saved_card_details): ?>
    <div class="ap-nmi-saved-card-selection" style="margin-bottom: 1em;">
        <p class="form-row form-row-wide">
            <label>
                <input type="radio" name="use_save_payment_method" value="1" checked="checked" />
                <?php 
                    printf(
                        esc_html__('Use saved card ending in ****%s', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                        esc_html($saved_card_details['last4'])
                    );
                    if (!empty($saved_card_details['type'])) {
                        echo ' (' . esc_html($saved_card_details['type']) . ')';
                    }
                    if (!empty($saved_card_details['exp_date'])) {
                        echo ' - ' . esc_html__('Exp:', 'gaincommerce-nmi-payment-gateway-for-woocommerce') . ' ' . esc_html($saved_card_details['exp_date']);
                    }
                ?>
            </label>
        </p>
        <p class="form-row form-row-wide">
            <label>
                <input type="radio" name="use_save_payment_method" value="0" />
                <?php esc_html_e('Use a new card', 'gaincommerce-nmi-payment-gateway-for-woocommerce'); ?>
            </label>
        </p>
    </div>
    <?php else: ?>
        <input type="hidden" name="use_save_payment_method" value="0" />
    <?php endif; ?>

    <div id="ap-nmi-wc-fields-container" <?php echo ($has_saved_card ? 'style="display:none;"' : ''); ?>>
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
        // Save payment method checkbox - only show when using new card
        $save_payment_enabled = isset($args['save_payment_enabled']) ? $args['save_payment_enabled'] : false;
        if ($save_payment_enabled) :
            do_action('gaincommerce_before_save_payment_checkbox', $gateway_id);
    ?>
    <p class="form-row form-row-wide ap-nmi-save-payment-row" <?php echo ($has_saved_card ? 'style="display:none;"' : ''); ?>>
        <label class="woocommerce-form__label woocommerce-form__label-for-checkbox checkbox">
            <input id="save_payment_method" type="checkbox" value="1" />
            <span><?php esc_html_e('Save payment method for future purchases', 'gaincommerce-nmi-payment-gateway-for-woocommerce'); ?></span>
        </label>
    </p>
    <?php
            do_action('gaincommerce_after_save_payment_checkbox', $gateway_id);
        endif;
    ?>

    <?php if ($has_saved_card): ?>
    <script type="text/javascript">
    jQuery(function($) {
        $('input[name="use_save_payment_method"]').on('change', function() {
            var useSavedCard = $(this).val() === '1';
            if (useSavedCard) {
                $('#ap-nmi-wc-fields-container').hide();
                $('.ap-nmi-save-payment-row').hide();
            } else {
                $('#ap-nmi-wc-fields-container').show();
                $('.ap-nmi-save-payment-row').show();
            }
        });
    });
    </script>
    <?php endif; ?>
</div>
