/**
 * NMI Google Pay — WooCommerce Blocks Express Payment Method
 *
 * Registers Google Pay as an express payment method (shown above the checkout
 * form) using registerExpressPaymentMethod(). Processes via the existing
 * gaincommerce_nmi CC gateway — no separate gateway class needed.
 */

import { createElement, useEffect, useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { registerExpressPaymentMethod } from '@woocommerce/blocks-registry';
import { getSetting } from '@woocommerce/settings';

const settings = getSetting( 'gaincommerce_nmi_google_pay_express_data', {} );

/**
 * Google Pay button component.
 * CollectJS mounts the native Google Pay button into #nmi-google-pay-button-blocks.
 */
const GooglePayButton = ( { onClick, onClose } ) => {
    const initDone = useRef( false );

    useEffect( () => {
        if ( initDone.current ) return;
        initDone.current = true;

        if ( typeof CollectJS === 'undefined' ) {
            console.error( 'NMI Google Pay Blocks: CollectJS not loaded.' );
            return;
        }

        const googlePayConfig = {
            selector: '#nmi-google-pay-button-blocks',
            style: {
                buttonType: 'buy',
                buttonColor: 'black',
                buttonLocale: settings.locale || 'en',
            },
        };

        if ( settings.google_merchant_id ) {
            googlePayConfig.googlePayMerchantId = settings.google_merchant_id;
        }

        CollectJS.configure( {
            variant: 'inline',
            fields: {
                googlepay: googlePayConfig,
            },
            validationCallback: function () {},
            fieldsAvailableCallback: function () {
                console.log( 'NMI Google Pay Blocks: Button rendered.' );
            },
            timeoutDuration: 10000,
            timeoutCallback: function () {
                console.error( 'NMI Google Pay Blocks: Timeout waiting for button.' );
            },
            callback: function ( response ) {
                console.log( 'NMI Google Pay Blocks: Token received.', response.token );

                if ( ! response.token ) {
                    console.error( 'NMI Google Pay Blocks: No token in response.' );
                    onClose();
                    return;
                }

                // onClick must be called to tell WooCommerce blocks the payment
                // is ready; pass token via paymentMethodData.
                onClick( {
                    payment_token: response.token,
                    nmi_wallet_type: 'googlepay',
                } );
            },
        } );
    }, [] );

    return createElement(
        'div',
        { className: 'nmi-google-pay-blocks-wrap', style: { width: '100%', marginBottom: '8px' } },
        createElement( 'div', { id: 'nmi-google-pay-button-blocks' } )
    );
};

/**
 * canMakePayment — CollectJS handles availability; default to true and let
 * CollectJS hide the button itself if Google Pay is unavailable in this browser.
 */
const canMakePayment = () => {
    return settings.is_available === 'yes';
};

registerExpressPaymentMethod( {
    name: 'gaincommerce_nmi_google_pay_express',
    // paymentMethodId maps the express method back to the CC gateway for processing
    paymentMethodId: 'gaincommerce_nmi',
    label: __( 'Google Pay', 'gaincommerce-nmi-payment-gateway-for-woocommerce' ),
    content: createElement( GooglePayButton, null ),
    edit: createElement(
        'div',
        { style: { padding: '8px', background: '#000', color: '#fff', borderRadius: '4px', textAlign: 'center' } },
        __( 'Google Pay (preview)', 'gaincommerce-nmi-payment-gateway-for-woocommerce' )
    ),
    canMakePayment,
    ariaLabel: __( 'Google Pay', 'gaincommerce-nmi-payment-gateway-for-woocommerce' ),
    supports: {
        features: settings.supports || [ 'products' ],
        showSavedCards: false,
        showSaveOption: false,
    },
} );
