/**
 * NMI Google Pay — Legacy Checkout Integration
 *
 * Renders a Google Pay button via CollectJS on the legacy WooCommerce checkout.
 * Only runs when:
 *  - CollectJS is loaded
 *  - The #nmi-google-pay-button container is present in the DOM
 * CollectJS handles Google Pay availability internally (hides button if unsupported).
 */
(function ($) {
    'use strict';

    var params = window.ap_nmi_google_pay_params || {};

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

    function init() {
        var $container = $('#nmi-google-pay-button');

        if ($container.length === 0) {
            return; // Container not in DOM — gateway not selected
        }

        if (typeof CollectJS === 'undefined') {
            console.error('NMI Google Pay: CollectJS not loaded.');
            $container.closest('.nmi-google-pay-wrap').hide();
            return;
        }

        console.log('NMI Google Pay: Initializing CollectJS for Google Pay...');

        var googlePayConfig = {
            selector: '#nmi-google-pay-button',
            style: {
                buttonType: 'buy',
                buttonColor: 'black',
                buttonLocale: params.locale || 'en',
            },
        };

        if (params.google_merchant_id) {
            googlePayConfig.googlePayMerchantId = params.google_merchant_id;
        }

        CollectJS.configure({
            variant: 'inline',
            fields: {
                googlepay: googlePayConfig,
            },
            validationCallback: function () {},
            fieldsAvailableCallback: function () {
                console.log('NMI Google Pay: Button rendered.');
                // CollectJS hides the button automatically if Google Pay is unavailable
                $container.closest('.nmi-google-pay-wrap').show();
            },
            timeoutDuration: 10000,
            timeoutCallback: function () {
                console.error('NMI Google Pay: Timeout waiting for button.');
                $container.closest('.nmi-google-pay-wrap').hide();
            },
            callback: function (response) {
                console.log('NMI Google Pay: Token received.', response.token);

                if (!response.token) {
                    showError(
                        params.error_message ||
                        'Google Pay failed to generate a payment token. Please try again.'
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
                    $form.append('<input type="hidden" name="nmi_wallet_type" value="googlepay">');
                } else {
                    $form.find('input[name="nmi_wallet_type"]').val('googlepay');
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
