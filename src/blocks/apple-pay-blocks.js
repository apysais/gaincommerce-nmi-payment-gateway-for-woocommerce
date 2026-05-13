/**
 * NMI Apple Pay — WooCommerce Blocks Express Payment Method
 *
 * Registers Apple Pay as an express payment method (shown above the checkout
 * form) using registerExpressPaymentMethod(). Processes via the existing
 * gaincommerce_nmi CC gateway — no separate gateway class needed.
 *
 * CollectJS constraint: configure() can only be called once per page load.
 * If the NMI CC form (checkout-blocks.js) is also mounted it will include the
 * applepay field in its own configure call and dispatch tokens here via
 * window.__nmiWalletCallbacks.applepay.
 * If the CC form is NOT mounted (customer hasn't selected NMI CC), this
 * component configures CollectJS itself with only the applepay field so the
 * button still renders when the browser supports Apple Pay.
 */

import { createElement, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { registerExpressPaymentMethod } from '@woocommerce/blocks-registry';
import { getSetting } from '@woocommerce/settings';

const settings = getSetting( 'gaincommerce_nmi_apple_pay_express_data', {} );

const ApplePayButton = ( { onClick, onClose } ) => {
    useEffect( () => {
        // Register our onClick handler so the CollectJS callback (wherever it
        // fires — CC form or this component) can hand off the token correctly.
        window.__nmiWalletCallbacks = window.__nmiWalletCallbacks || {};
        window.__nmiWalletCallbacks.applepay = ( token ) => {
            console.log( 'NMI Apple Pay Blocks: Token received, triggering express payment.' );
            onClick( {
                payment_token: token,
                nmi_wallet_type: 'applepay',
            } );
        };

        // If CollectJS has NOT been configured yet (CC form not mounted), configure
        // it here with only the applepay field so the button appears when available.
        let appleSupported = false;
        try {
            appleSupported =
                window.isSecureContext &&
                typeof window.ApplePaySession !== 'undefined' &&
                typeof window.ApplePaySession.canMakePayments === 'function' &&
                window.ApplePaySession.canMakePayments();
        } catch ( e ) {
            // Throws InvalidAccessError on insecure (HTTP) pages — treat as unsupported.
            console.log( 'NMI Apple Pay Blocks: canMakePayments() unavailable:', e.message );
        }

        if ( appleSupported && typeof CollectJS !== 'undefined' && ! window.nmiCollectJSBlocksConfigured ) {
            console.log( 'NMI Apple Pay Blocks: CC form not active, configuring CollectJS for Apple Pay only.' );
            window.nmiCollectJSBlocksConfigured = true;

            const apayConfig = {
                selector: '#nmi-apple-pay-button-blocks',
            };

            CollectJS.configure( {
                variant:  'inline',
                country:  settings.country   || 'US',
                currency: settings.currency  || 'USD',
                price:    settings.cart_total || '0.00',
                fields: { applepay: apayConfig },
                validationCallback: () => {},
                fieldsAvailableCallback: () => {
                    console.log( 'NMI Apple Pay Blocks: Button rendered.' );
                },
                timeoutDuration: 10000,
                timeoutCallback: () => {
                    console.error( 'NMI Apple Pay Blocks: CollectJS timeout.' );
                },
                callback: ( response ) => {
                    if ( response.token && window.__nmiWalletCallbacks && window.__nmiWalletCallbacks.applepay ) {
                        window.__nmiWalletCallbacks.applepay( response.token );
                    }
                },
            } );
        }

        return () => {
            if ( window.__nmiWalletCallbacks ) {
                delete window.__nmiWalletCallbacks.applepay;
            }
        };
    }, [ onClick ] );

    // The container div is targeted by CollectJS
    return createElement(
        'div',
        { className: 'nmi-apple-pay-blocks-wrap', style: { width: '100%', marginBottom: '8px' } },
        createElement( 'div', { id: 'nmi-apple-pay-button-blocks' } )
    );
};

/**
 * canMakePayment — only show in Safari on Apple devices.
 * No merchant ID guard — display is allowed during merchant approval review.
 */
const canMakePayment = () => {
    if ( ! window.isSecureContext ) return false;
    if ( settings.is_available !== 'yes' ) return false;
    try {
        return (
            typeof window.ApplePaySession !== 'undefined' &&
            typeof window.ApplePaySession.canMakePayments === 'function' &&
            window.ApplePaySession.canMakePayments()
        );
    } catch ( e ) {
        // Throws InvalidAccessError on insecure (HTTP) pages.
        return false;
    }
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
        showSavedCards: false,
        showSaveOption: false,
    },
} );
