/**
 * NMI Apple Pay — Legacy Checkout Integration
 *
 * Renders an Apple Pay button via CollectJS on the legacy WooCommerce checkout.
 * Only runs when:
 *  - The current browser supports Apple Pay (Safari on Apple devices)
 *  - CollectJS is loaded
 *  - The #nmi-apple-pay-button container is present in the DOM
 */
(function ($) {
    'use strict';

    var params = window.ap_nmi_apple_pay_params || {};

    /**
     * Show a WooCommerce-style error notice above the payment section.
     */
    function showError(message) {
        var $notices = $('.woocommerce-NoticeGroup-checkout, .woocommerce-error, .woocommerce-messages');
        $notices.remove();

        var $form = $('form.woocommerce-checkout');
        $form.prepend(
            '<div class="woocommerce-NoticeGroup woocommerce-NoticeGroup-checkout">' +
            '<ul class="woocommerce-error" role="alert"><li>' + message + '</li></ul></div>'
        );
        $('html, body').animate({ scrollTop: $form.offset().top - 100 }, 500);
    }

    /**
     * Check whether the current browser supports Apple Pay.
     * ApplePaySession is only available in Safari on Apple devices.
     */
    function isApplePayAvailable() {
        return (
            typeof window.ApplePaySession !== 'undefined' &&
            typeof window.ApplePaySession.canMakePayments === 'function' &&
            window.ApplePaySession.canMakePayments()
        );
    }

    function init() {
        var $container = $('#nmi-apple-pay-button');

        if ($container.length === 0) {
            return; // Container not in DOM — gateway not selected
        }

        if (!isApplePayAvailable()) {
            $container.closest('.nmi-apple-pay-wrap').hide();
            return;
        }

        if (typeof CollectJS === 'undefined') {
            console.error('NMI Apple Pay: CollectJS not loaded.');
            $container.closest('.nmi-apple-pay-wrap').hide();
            return;
        }

        console.log('NMI Apple Pay: Initializing CollectJS for Apple Pay...');

        CollectJS.configure({
            variant: 'inline',
            fields: {
                applepay: {
                    selector: '#nmi-apple-pay-button',
                    type: 'buy',
                    style: {
                        'button-style': 'black',
                        'button-type': 'buy',
                        'border-radius': '4px',
                        width: '100%',
                        height: '44px',
                    },
                },
            },
            validationCallback: function () {},
            fieldsAvailableCallback: function () {
                console.log('NMI Apple Pay: Button rendered.');
                $container.closest('.nmi-apple-pay-wrap').show();
            },
            timeoutDuration: 10000,
            timeoutCallback: function () {
                console.error('NMI Apple Pay: Timeout waiting for button.');
                $container.closest('.nmi-apple-pay-wrap').hide();
            },
            callback: function (response) {
                console.log('NMI Apple Pay: Token received.', response.token);

                if (!response.token) {
                    showError(
                        params.error_message ||
                        'Apple Pay failed to generate a payment token. Please try again.'
                    );
                    return;
                }

                var $form = $('form.woocommerce-checkout');

                // Inject token into the checkout form
                if ($form.find('input[name="payment_token"]').length === 0) {
                    $form.append(
                        '<input type="hidden" name="payment_token" value="' +
                        response.token + '">'
                    );
                } else {
                    $form.find('input[name="payment_token"]').val(response.token);
                }

                // Mark as wallet payment so the server can skip 3DS
                if ($form.find('input[name="nmi_wallet_type"]').length === 0) {
                    $form.append('<input type="hidden" name="nmi_wallet_type" value="applepay">');
                } else {
                    $form.find('input[name="nmi_wallet_type"]').val('applepay');
                }

                // Submit the form
                $form.off('checkout_place_order').submit();
            },
        });
    }

    // Run on document-ready and re-run when the checkout updates (e.g. payment method switch)
    $(document).ready(function () {
        init();
    });

    $(document.body).on('updated_checkout', function () {
        init();
    });

})(jQuery);
