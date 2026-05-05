/**
 * NMI Apple Pay — WooCommerce Blocks Express Payment Method
 *
 * Registers Apple Pay as an express payment method (shown above the checkout
 * form) using registerExpressPaymentMethod(). Processes via the existing
 * gaincommerce_nmi CC gateway — no separate gateway class needed.
 */

import { createElement, useEffect, useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { registerExpressPaymentMethod } from '@woocommerce/blocks-registry';
import { getSetting } from '@woocommerce/settings';

const settings = getSetting( 'gaincommerce_nmi_apple_pay_express_data', {} );

/**
 * Apple Pay button component.
 * CollectJS mounts the native Apple Pay button into #nmi-apple-pay-button-blocks.
 */
const ApplePayButton = ( { onClick, onClose } ) => {
    const initDone = useRef( false );

    useEffect( () => {
        if ( initDone.current ) return;
        initDone.current = true;

        if ( typeof CollectJS === 'undefined' ) {
            console.error( 'NMI Apple Pay Blocks: CollectJS not loaded.' );
            return;
        }

        CollectJS.configure( {
            variant: 'inline',
            fields: {
                applepay: {
                    selector: '#nmi-apple-pay-button-blocks',
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
                console.log( 'NMI Apple Pay Blocks: Button rendered.' );
            },
            timeoutDuration: 10000,
            timeoutCallback: function () {
                console.error( 'NMI Apple Pay Blocks: Timeout waiting for button.' );
            },
            callback: function ( response ) {
                console.log( 'NMI Apple Pay Blocks: Token received.', response.token );

                if ( ! response.token ) {
                    console.error( 'NMI Apple Pay Blocks: No token in response.' );
                    onClose();
                    return;
                }

                // onClick must be called to tell WooCommerce blocks the payment
                // is ready; pass token via paymentMethodData.
                onClick( {
                    payment_token: response.token,
                    nmi_wallet_type: 'applepay',
                } );
            },
        } );
    }, [] );

    return createElement(
        'div',
        { className: 'nmi-apple-pay-blocks-wrap', style: { width: '100%', marginBottom: '8px' } },
        createElement( 'div', { id: 'nmi-apple-pay-button-blocks' } )
    );
};

/**
 * canMakePayment — only show in Safari on Apple devices.
 */
const canMakePayment = () => {
    if ( settings.is_available !== 'yes' ) return false;
    return (
        typeof window.ApplePaySession !== 'undefined' &&
        typeof window.ApplePaySession.canMakePayments === 'function' &&
        window.ApplePaySession.canMakePayments()
    );
};

registerExpressPaymentMethod( {
    name: 'gaincommerce_nmi_apple_pay_express',
    // paymentMethodId maps the express method back to the CC gateway for processing
    paymentMethodId: 'gaincommerce_nmi',
    label: __( 'Apple Pay', 'gaincommerce-nmi-payment-gateway-for-woocommerce' ),
    content: createElement( ApplePayButton, null ),
    edit: createElement(
        'div',
        { style: { padding: '8px', background: '#000', color: '#fff', borderRadius: '4px', textAlign: 'center' } },
        __( 'Apple Pay (preview)', 'gaincommerce-nmi-payment-gateway-for-woocommerce' )
    ),
    canMakePayment,
    ariaLabel: __( 'Apple Pay', 'gaincommerce-nmi-payment-gateway-for-woocommerce' ),
    supports: {
        features: settings.supports || [ 'products' ],
        // Express payment methods should not show saved-card UI
        showSavedCards: false,
        showSaveOption: false,
    },
} );
