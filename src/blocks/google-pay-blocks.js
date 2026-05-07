/**
 * NMI Google Pay — WooCommerce Blocks Express Payment Method
 *
 * Registers Google Pay as an express payment method (shown above the checkout
 * form) using registerExpressPaymentMethod(). Processes via the existing
 * gaincommerce_nmi CC gateway — no separate gateway class needed.
 *
 * CollectJS constraint: configure() can only be called once per page load.
 * If the NMI CC form (checkout-blocks.js) is also mounted it will include the
 * googlepay field in its own configure call and dispatch tokens here via
 * window.__nmiWalletCallbacks.googlepay.
 * If the CC form is NOT mounted (customer hasn't selected NMI CC), this
 * component configures CollectJS itself with only the googlepay field so the
 * button still renders.
 */

import { createElement, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { registerExpressPaymentMethod } from '@woocommerce/blocks-registry';
import { getSetting } from '@woocommerce/settings';

const settings = getSetting( 'gaincommerce_nmi_google_pay_express_data', {} );

const GooglePayButton = ( { onClick, onClose } ) => {
    useEffect( () => {
        // Register our onClick handler so the CollectJS callback (wherever it
        // fires — CC form or this component) can hand off the token correctly.
        window.__nmiWalletCallbacks = window.__nmiWalletCallbacks || {};
        window.__nmiWalletCallbacks.googlePay = ( token ) => {
            console.log( 'NMI Google Pay Blocks: Token received, triggering express payment.' );
            onClick( {
                payment_token: token,
                nmi_wallet_type: 'googlepay',
            } );
        };

        // If CollectJS has NOT been configured yet (CC form not mounted), configure
        // it here with only the googlepay field so the button appears.
        // Google Pay requires HTTPS; skip silently on HTTP.
        if ( typeof CollectJS !== 'undefined' && ! window.nmiCollectJSBlocksConfigured && window.isSecureContext ) {
            console.log( 'NMI Google Pay Blocks: CC form not active, configuring CollectJS for Google Pay only.' );
            window.nmiCollectJSBlocksConfigured = true;

            const gpayConfig = {
                selector:    '#nmi-google-pay-button-blocks',
                buttonType:  'buy',
                buttonColor: 'black',
            };
            if ( settings.google_merchant_id ) {
                gpayConfig.googlePayMerchantId = settings.google_merchant_id;
            }

            CollectJS.configure( {
                variant:  'inline',
                country:  settings.country  || 'US',
                currency: settings.currency || 'USD',
                price:    settings.cart_total || '0.00',
                fields: { googlePay: gpayConfig },
                validationCallback: () => {},
                fieldsAvailableCallback: () => {
                    console.log( 'NMI Google Pay Blocks: Button rendered.' );
                },
                timeoutDuration: 10000,
                timeoutCallback: () => {
                    console.error( 'NMI Google Pay Blocks: CollectJS timeout.' );
                },
                callback: ( response ) => {
                    if ( response.token && window.__nmiWalletCallbacks && window.__nmiWalletCallbacks.googlePay ) {
                        window.__nmiWalletCallbacks.googlePay( response.token );
                    }
                },
            } );
        }

        return () => {
            if ( window.__nmiWalletCallbacks ) {
                delete window.__nmiWalletCallbacks.googlePay;
            }
        };
    }, [ onClick ] );

    // The container div is targeted by CollectJS
    return createElement(
        'div',
        { className: 'nmi-google-pay-blocks-wrap', style: { width: '100%', marginBottom: '8px' } },
        createElement( 'div', { id: 'nmi-google-pay-button-blocks' } )
    );
};

/**
 * canMakePayment — Google Pay requires HTTPS. On HTTP return false immediately
 * so WC Blocks doesn't render the button (and Google's pay.js never fires).
 */
const canMakePayment = () => {
    if ( ! window.isSecureContext ) return false;
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
