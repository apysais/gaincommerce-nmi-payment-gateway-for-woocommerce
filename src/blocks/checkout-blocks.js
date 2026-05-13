/**
 * WooCommerce Checkout Blocks Integration for AP NMI Payment Gateway
 * Modern ES6+ implementation with proper imports and build process
 */

import { createElement, useState, useEffect, useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { registerPaymentMethod } from '@woocommerce/blocks-registry';
import { getSetting } from '@woocommerce/settings';
import { CheckboxControl } from '@wordpress/components';

// Debug logging
console.log('AP NMI Blocks: Script loading...');

// Get payment method data passed from PHP
const settings = getSetting('gaincommerce_nmi_data', {});
const defaultLabel = __('Gain Commerce NMI Payment Gateway for WooCommerce', 'gaincommerce-nmi-payment-gateway-for-woocommerce');

console.log('AP NMI Blocks: Settings loaded', settings);

/**
 * Credit Card Form Component
 * This creates the payment form UI that customers will see
 */
const CreditCardForm = ({ billing, eventRegistration, emitResponse }) => {
    const { onPaymentSetup } = eventRegistration;
    const [fieldValidity, setFieldValidity] = useState({
        ccnumber: false,
        ccexp: false,
        cvv: true, // CVV is not always required, so default to true
    });
    const [error, setError] = useState(null);
    const [savePaymentMethod, setSavePaymentMethod] = useState(false);
    const [useSavedCard, setUseSavedCard] = useState(false); // Always start with new card form visible for CollectJS
    const savePaymentMethodRef = useRef(false); // Ref to hold current value
    const useSavedCardRef = useRef(false); // Ref for saved card selection
    const promiseRef = useRef(null); // To hold promise resolve/reject functions
    const walletTokenRef = useRef(null); // Holds wallet token after wallet button tap
    const walletTypeRef  = useRef(null); // Holds wallet type (applepay/googlepay)

    // Keep refs in sync with state
    useEffect(() => {
        savePaymentMethodRef.current = savePaymentMethod;
    }, [savePaymentMethod]);

    useEffect(() => {
        useSavedCardRef.current = useSavedCard;
    }, [useSavedCard]);

    // Initialize CollectJS and set up the callback just once
    useEffect(() => {
        if (typeof CollectJS === 'undefined') {
            console.error('AP NMI Blocks: CollectJS not loaded');
            setError(__('Payment form failed to load. Please refresh the page.', 'gaincommerce-nmi-payment-gateway-for-woocommerce'));
            return;
        }

        console.log('AP NMI Blocks: Initializing CollectJS...');

        // Build wallet fields to include in the same configure call as CC fields.
        // CollectJS can only be configured once, so all fields must be declared together.
        // Guard each wallet type: only add it when the browser actually supports it,
        // otherwise CollectJS throws "Could not create PaymentRequestAbstraction"
        // and crashes the entire CC form init too.
        const walletFields = {};

        // Apple Pay: requires Safari on Apple hardware AND a secure context (HTTPS).
        // canMakePayments() can return true on HTTP in Safari but CollectJS will then
        // throw InvalidAccessError when creating the ApplePaySession, crashing React.
        let applePaySupported = false;
        if ( settings.apple_pay_enabled === 'yes' && window.isSecureContext ) {
            try {
                applePaySupported =
                    typeof window.ApplePaySession !== 'undefined' &&
                    window.ApplePaySession.canMakePayments();
            } catch ( e ) {
                // Throws InvalidAccessError on insecure (HTTP) pages — treat as unsupported.
                console.log( 'AP NMI Blocks: Apple Pay canMakePayments() unavailable:', e.message );
            }
        }

        if (applePaySupported) {
            const apayConfig = {
                selector: '#nmi-apple-pay-button-blocks',
            };
            if (settings.apple_merchant_id) {
                apayConfig.appleMerchantId = settings.apple_merchant_id;
            }
            walletFields.applepay = apayConfig;
            console.log('AP NMI Blocks: Including Apple Pay field in CollectJS config');
        } else if (settings.apple_pay_enabled === 'yes') {
            console.log('AP NMI Blocks: Apple Pay not supported in this browser — field skipped');
        }

        // Google Pay: include if enabled (CollectJS handles availability internally)
        // Google Pay requires a secure context (HTTPS); skip silently on HTTP.
        const googlePaySupported = settings.google_pay_enabled === 'yes';

        if (googlePaySupported) {
            const gpayConfig = {
                selector:    '#nmi-google-pay-button-blocks',
                buttonType:  'buy',
                buttonColor: 'black',
            };
            if (settings.google_merchant_id) {
                gpayConfig.googlePayMerchantId = settings.google_merchant_id;
            }
            walletFields.googlePay = gpayConfig;
            console.log('AP NMI Blocks: Including Google Pay field in CollectJS config');
        }

        const ccFields = {
            ccnumber: { selector: "#ap-nmi-card-number", title: "Card Number", placeholder: "0000 0000 0000 0000" },
            ccexp: { selector: "#ap-nmi-expiry-date", title: "Card Expiration", placeholder: "MM/YY" },
            cvv: { display: "show", selector: "#ap-nmi-card-cvv", title: "CVV", placeholder: "123" }
        };
        const baseConfig = {
            variant: "inline",
            country:  settings.country  || 'US',
            currency: settings.currency || 'USD',
            price:    settings.cart_total || '0.00',
            validCss: { color: "black", "border-color": "#2ecc71" },
            placeholderCss: { color: "darkgray", "background-color": "#ffffff" },
            focusCss: { color: "black", "border-color": "#4681f4" },
        };
        const runConfigure = ( fields ) => {
            CollectJS.configure( {
                ...baseConfig,
                fields,
                validationCallback: (field, status, message) => {
                console.log('AP NMI Blocks: Validation:', field, status, message);
                setFieldValidity(prev => ({ ...prev, [field.field || field]: status }));
            },
            callback: (response) => {
                console.log('AP NMI Blocks: CollectJS callback triggered.', response);

                // Wallet payment — dispatch to the registered express payment method
                // via window.__nmiWalletCallbacks so WooCommerce Blocks handles the
                // express flow correctly (Apple Pay and Google Pay Blocks each register
                // their onClick handler there).
                if (response.wallet || (!response.card && (settings.apple_pay_enabled === 'yes' || settings.google_pay_enabled === 'yes'))) {
                    const walletType = response.wallet || 'unknown';
                    console.log('AP NMI Blocks: Wallet token received for', walletType, response.token);

                    const cb = window.__nmiWalletCallbacks && window.__nmiWalletCallbacks[walletType];
                    if (typeof cb === 'function') {
                        cb(response.token);
                    } else {
                        // Fallback: no express method registered, store token and click place order
                        console.warn('AP NMI Blocks: No wallet callback registered for', walletType, '— falling back to place-order click');
                        walletTokenRef.current = response.token;
                        walletTypeRef.current  = walletType;
                        const placeOrderBtn = document.querySelector('.wc-block-components-checkout-place-order-button');
                        if (placeOrderBtn) {
                            placeOrderBtn.click();
                        } else {
                            console.error('AP NMI Blocks: Place Order button not found');
                        }
                    }
                    return;
                }

                // CC payment (existing promise-based flow)
                if (promiseRef.current) {
                    // Clear the timeout since we got a response
                    if (promiseRef.current.clearTimeout) {
                        promiseRef.current.clearTimeout();
                    }

                    // Card type restriction check
                    if (response.card && response.card.type) {
                        const restricted_card = settings.restricted_card_types;
                        if (restricted_card.includes(response.card.type)) {
                            const errorMessage = __('This card type is not accepted.', 'gaincommerce-nmi-payment-gateway-for-woocommerce');
                            setError(errorMessage);
                            promiseRef.current.reject({
                                type: emitResponse.responseTypes.ERROR,
                                message: errorMessage,
                            });
                            promiseRef.current = null; // Clear ref
                            return;
                        }
                    }

                    if (response.token) {
                        console.log('AP NMI Blocks: Token generated successfully:', response.token);
                        
                        // Check if 3DS is enabled
                        const threeDSEnabled = typeof ap_nmi_threeds_config !== 'undefined' && ap_nmi_threeds_config.enable_3ds === 'yes';
                        
                        if (threeDSEnabled && typeof Gateway !== 'undefined') {
                            console.log('AP NMI Blocks: 3DS enabled, initiating authentication...');
                            nmiBlocksHandle3DSForNewCard(response.token, promiseRef.current.resolve, promiseRef.current.reject, setError);
                            promiseRef.current = null; // Clear ref as 3DS will handle resolution
                        } else {
                            // No 3DS, resolve immediately
                            console.log('AP NMI Blocks: savePaymentMethod state:', savePaymentMethodRef.current);
                            console.log('AP NMI Blocks: save_payment_method value being sent:', savePaymentMethodRef.current ? '1' : '0');
                            promiseRef.current.resolve({
                                type: emitResponse.responseTypes.SUCCESS,
                                meta: {
                                    paymentMethodData: {
                                        payment_token: response.token,
                                        save_payment_method: savePaymentMethodRef.current ? '1' : '0',
                                        use_save_payment_method: '0', // New card
                                    },
                                },
                            });
                            console.log('AP NMI Blocks: paymentMethodData sent:', {
                                payment_token: response.token,
                                save_payment_method: savePaymentMethodRef.current ? '1' : '0',
                                use_save_payment_method: '0',
                            });
                            promiseRef.current = null; // Clear ref
                        }
                    } else {
                        console.error('AP NMI Blocks: Token generation failed.', response);
                        const errorMessage = response.error?.message || __('Invalid card details. Please check and try again.', 'gaincommerce-nmi-payment-gateway-for-woocommerce');
                        setError(errorMessage);
                        promiseRef.current.reject({
                            type: emitResponse.responseTypes.ERROR,
                            message: errorMessage,
                        });
                        promiseRef.current = null; // Clear ref
                    }
                    
                    promiseRef.current = null; // Clear the ref after handling
                }
            }
            } );
        };

        // Try configuring with wallet fields; fall back to CC-only if the wallet
        // Payment Request can't be created (e.g. missing domain verification).
        try {
            runConfigure( Object.assign( {}, ccFields, walletFields ) );
        } catch ( e ) {
            if ( Object.keys( walletFields ).length > 0 &&
                 e.message && e.message.indexOf( 'PaymentRequestAbstraction' ) !== -1 ) {
                console.warn( 'AP NMI Blocks: Wallet PaymentRequest init failed, retrying CC-only:', e.message );
                const apBtn = document.getElementById( 'nmi-apple-pay-button-blocks' );
                if ( apBtn && apBtn.closest( '.nmi-apple-pay-wrap' ) ) apBtn.closest( '.nmi-apple-pay-wrap' ).style.display = 'none';
                const gpBtn = document.getElementById( 'nmi-google-pay-button-blocks' );
                if ( gpBtn && gpBtn.closest( '.nmi-google-pay-wrap' ) ) gpBtn.closest( '.nmi-google-pay-wrap' ).style.display = 'none';
                runConfigure( ccFields );
            } else {
                throw e;
            }
        }
    }, []); // Empty dependency array ensures this runs only once

    // Register payment setup handler
    useEffect(() => {
        const unsubscribe = onPaymentSetup(() => {
            console.log('AP NMI Blocks: onPaymentSetup triggered.');
            setError(null); // Clear previous errors

            // Wallet payment — token already captured when wallet button was tapped
            if (walletTokenRef.current) {
                const token    = walletTokenRef.current;
                const walletType = walletTypeRef.current;
                walletTokenRef.current = null;
                walletTypeRef.current  = null;
                console.log('AP NMI Blocks: Resolving wallet payment:', walletType, token);
                return {
                    type: emitResponse.responseTypes.SUCCESS,
                    meta: {
                        paymentMethodData: {
                            payment_token:           token,
                            nmi_wallet_type:         walletType,
                            save_payment_method:     '0',
                            use_save_payment_method: '0',
                        },
                    },
                };
            }

            // Check if 3DS is enabled
            const threeDSEnabled = typeof ap_nmi_threeds_config !== 'undefined' && ap_nmi_threeds_config.enable_3ds === 'yes';

            // If using saved card
            if (useSavedCardRef.current && settings.has_saved_card) {
                console.log('AP NMI Blocks: Using saved payment method.');
                
                // If 3DS is enabled for saved cards, authenticate first
                if (threeDSEnabled && typeof Gateway !== 'undefined') {
                    console.log('AP NMI Blocks: 3DS enabled for saved card, authenticating...');
                    
                    return new Promise((resolve, reject) => {
                        const customerVaultId = settings.customer_vault_id;
                        
                        if (!customerVaultId) {
                            const errorMessage = __('Customer vault ID not found.', 'gaincommerce-nmi-payment-gateway-for-woocommerce');
                            setError(errorMessage);
                            reject({
                                type: emitResponse.responseTypes.ERROR,
                                message: errorMessage,
                            });
                            return;
                        }
                        
                        nmiBlocksHandle3DSForVault(customerVaultId, resolve, reject, setError);
                    });
                }
                
                // No 3DS for saved cards, return directly
                return {
                    type: emitResponse.responseTypes.SUCCESS,
                    meta: {
                        paymentMethodData: {
                            use_save_payment_method: '1', // Using saved card
                            save_payment_method: '0', // Not saving
                        },
                    },
                };
            }

            // Check field validity before proceeding
            const allFieldsValid = Object.values(fieldValidity).every(Boolean);
            if (!allFieldsValid) {
                console.log('AP NMI Blocks: Validation failed before tokenization.', fieldValidity);
                const errorMessage = __('Please fill in all required payment fields.', 'gaincommerce-nmi-payment-gateway-for-woocommerce');
                setError(errorMessage);
                return {
                    type: emitResponse.responseTypes.ERROR,
                    message: errorMessage,
                };
            }

            console.log('AP NMI Blocks: All fields appear valid, requesting token...');

            return new Promise((resolve, reject) => {
                // Store promise handlers and timeout clearer in the ref
                promiseRef.current = { 
                    resolve, 
                    reject,
                    clearTimeout: null 
                };

                const timeout = setTimeout(() => {
                    console.error('AP NMI Blocks: Tokenization timed out.');
                    const errorMessage = __('Payment processing timed out. Please try again.', 'gaincommerce-nmi-payment-gateway-for-woocommerce');
                    setError(errorMessage);
                    if (promiseRef.current) {
                        promiseRef.current.reject({
                            type: emitResponse.responseTypes.ERROR,
                            message: errorMessage,
                        });
                        promiseRef.current = null; // Clear ref on timeout
                    }
                }, 15000); // 15-second timeout

                // Store the function to clear the timeout
                promiseRef.current.clearTimeout = () => clearTimeout(timeout);

                // Start the payment request
                CollectJS.startPaymentRequest();
            });
        });
        
        // Track current 3DS instance globally to allow unmounting
        window.currentNmi3DSInstance = null;
        
        /**
         * Helper function to safely add 3DS fields to payment data
         * Only includes fields that are strings and not empty/null
         * This prevents REST API type validation errors
         */
        window.nmiBlocksSafe3DSData = function(threeDSResponse) {
            const data = {};
            
            // Only add fields if they are strings and not empty
            if (typeof threeDSResponse.cavv === 'string' && threeDSResponse.cavv) {
                data.cavv = threeDSResponse.cavv;
            }
            if (typeof threeDSResponse.xid === 'string' && threeDSResponse.xid) {
                data.xid = threeDSResponse.xid;
            }
            if (typeof threeDSResponse.eci === 'string' && threeDSResponse.eci) {
                data.eci = threeDSResponse.eci;
            }
            if (typeof threeDSResponse.cardHolderAuth === 'string' && threeDSResponse.cardHolderAuth) {
                data.cardholder_auth = threeDSResponse.cardHolderAuth;
            }
            if (typeof threeDSResponse.threeDsVersion === 'string' && threeDSResponse.threeDsVersion) {
                data.three_ds_version = threeDSResponse.threeDsVersion;
            }
            if (typeof threeDSResponse.directoryServerId === 'string' && threeDSResponse.directoryServerId) {
                data.directory_server_id = threeDSResponse.directoryServerId;
            }
            if (typeof threeDSResponse.cardHolderInfo === 'string' && threeDSResponse.cardHolderInfo) {
                data.cardholder_info = threeDSResponse.cardHolderInfo;
            }
            
            console.log('AP NMI Blocks: Safe 3DS data prepared', {
                has_cavv: !!data.cavv,
                has_xid: !!data.xid,
                three_ds_version: data.three_ds_version || 'none'
            });
            
            return data;
        };
        
        // 3DS handler for saved vault cards
        window.nmiBlocksHandle3DSForVault = function(customerVaultId, resolve, reject, setError) {
            try {
                // Unmount any existing 3DS instance first
                if (window.currentNmi3DSInstance) {
                    console.log('AP NMI Blocks: Unmounting existing 3DS instance');
                    try {
                        window.currentNmi3DSInstance.unmount();
                    } catch (e) {
                        console.warn('AP NMI Blocks: Error unmounting 3DS instance:', e);
                    }
                    window.currentNmi3DSInstance = null;
                }
                
                // Debug: Log Gateway.js key for saved card 3DS
                const gatewayJsKey = ap_nmi_threeds_config.public_key;
                console.log('AP NMI Blocks: 3DS Key for Saved Card', {
                    gatewayjs_key: gatewayJsKey ? gatewayJsKey.substring(0, 20) + '...' : 'EMPTY',
                    vault_id: customerVaultId
                });
                
                const gateway = Gateway.create(ap_nmi_threeds_config.public_key);
                const threeDS = gateway.get3DSecure();
                
                const options = {
                    customerVaultId: customerVaultId,
                    currency: ap_nmi_threeds_config.currency,
                    amount: ap_nmi_threeds_config.amount
                };
                
                // Add device data to prevent timeouts (per latest NMI docs)
                Object.assign(options, nmiBlocksCollectDeviceData());
                
                console.log('AP NMI Blocks: 3DS options for vault:', options);
                
                const threeDSecureInterface = threeDS.createUI(options);
                window.currentNmi3DSInstance = threeDSecureInterface; // Track instance
                threeDSecureInterface.start('#threeDSMountPoint');
                
                threeDSecureInterface.on('challenge', function(e) {
                    console.log('AP NMI Blocks: 3DS Challenge for saved card');
                });
                
                threeDSecureInterface.on('complete', function(e) {
                    console.log('AP NMI Blocks: 3DS complete for saved card:', e);
                    
                    // Use helper to safely extract only valid 3DS fields
                    const safe3DSData = window.nmiBlocksSafe3DSData(e);
                    
                    resolve({
                        type: emitResponse.responseTypes.SUCCESS,
                        meta: {
                            paymentMethodData: {
                                use_save_payment_method: '1',
                                save_payment_method: '0',
                                ...safe3DSData,
                            },
                        },
                    });
                });
                
                threeDSecureInterface.on('failure', function(e) {
                    console.error('AP NMI Blocks: 3DS failed for saved card:', e);
                    
                    const failureAction = ap_nmi_threeds_config['3ds_failure_action'] || 'decline';
                    
                    if (failureAction === 'decline') {
                        reject({
                            type: emitResponse.responseTypes.ERROR,
                            message: __('Card verification failed. Please try a different payment method.', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                        });
                    } else if (failureAction === 'continue_without_3ds') {
                        resolve({
                            type: emitResponse.responseTypes.SUCCESS,
                            meta: {
                                paymentMethodData: {
                                    use_save_payment_method: '1',
                                    save_payment_method: '0',
                                },
                            },
                        });
                    } else if (failureAction === 'continue_with_warning') {
                        resolve({
                            type: emitResponse.responseTypes.SUCCESS,
                            meta: {
                                paymentMethodData: {
                                    use_save_payment_method: '1',
                                    save_payment_method: '0',
                                    threeds_warning: 'authentication_failed',
                                },
                            },
                        });
                    }
                });
                
                gateway.on('error', function(e) {
                    console.error('AP NMI Blocks: Gateway error for saved card:', e);
                    
                    // Check if 3DS is inactive on merchant account
                    let errorMessage = __('Payment verification error. Please try again.', 'gaincommerce-nmi-payment-gateway-for-woocommerce');
                    
                    if (e.message && e.message.includes('3DSecure is inactive')) {
                        console.error('NMI 3DS Error: 3-D Secure is not enabled on your NMI merchant account');
                        errorMessage = __('Secure payment verification is currently unavailable. Please contact the store or try a different payment method.', 'gaincommerce-nmi-payment-gateway-for-woocommerce');
                    }
                    
                    console.log('AP NMI Blocks: Calling setError for saved card with message:', errorMessage);
                    
                    // Display error directly in DOM
                    const errorContainer = document.querySelector('.wc-block-components-notices');
                    if (errorContainer) {
                        errorContainer.innerHTML = `<div class="wc-block-components-notice-banner is-error" role="alert"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M12 3.2c-4.8 0-8.8 3.9-8.8 8.8 0 4.8 3.9 8.8 8.8 8.8 4.8 0 8.8-3.9 8.8-8.8 0-4.8-4-8.8-8.8-8.8zm0 16c-4 0-7.2-3.3-7.2-7.2C4.8 8 8 4.8 12 4.8s7.2 3.3 7.2 7.2c0 4-3.2 7.2-7.2 7.2zM11 17h2v-6h-2v6zm0-8h2V7h-2v2z"></path></svg><div class="wc-block-components-notice-banner__content">${errorMessage}</div></div>`;
                    }
                    
                    // Also show an alert as fallback
                    alert(errorMessage);
                    
                    setError(errorMessage);
                    reject({
                        type: emitResponse.responseTypes.ERROR,
                        message: errorMessage,
                    });
                });
                
            } catch (error) {
                console.error('AP NMI Blocks: 3DS initialization error for saved card:', error);
                const errorMessage = __('Unable to initialize card verification. Please try again.', 'gaincommerce-nmi-payment-gateway-for-woocommerce');
                alert(errorMessage); // Fallback alert
                reject({
                    type: emitResponse.responseTypes.ERROR,
                    message: errorMessage,
                });
            }
        };
        
        // 3DS handler for new cards
        window.nmiBlocksHandle3DSForNewCard = function(paymentToken, resolve, reject, setError) {
            try {
                // Unmount any existing 3DS instance first
                if (window.currentNmi3DSInstance) {
                    console.log('AP NMI Blocks: Unmounting existing 3DS instance');
                    try {
                        window.currentNmi3DSInstance.unmount();
                    } catch (e) {
                        console.warn('AP NMI Blocks: Error unmounting 3DS instance:', e);
                    }
                    window.currentNmi3DSInstance = null;
                }
                
                // Debug: Verify key consistency between CollectJS and Gateway.js
                const collectJsKey = typeof ap_nmi_params !== 'undefined' ? ap_nmi_params.public_key : 'NOT FOUND';
                const gatewayJsKey = ap_nmi_threeds_config.public_key;
                const keysMatch = collectJsKey === gatewayJsKey;
                
                console.log('AP NMI Blocks: 3DS Key Verification for New Card', {
                    collectjs_key: collectJsKey ? collectJsKey.substring(0, 20) + '...' : 'EMPTY',
                    gatewayjs_key: gatewayJsKey ? gatewayJsKey.substring(0, 20) + '...' : 'EMPTY',
                    keys_match: keysMatch ? 'YES' : 'NO - MISMATCH DETECTED!',
                    token: paymentToken.substring(0, 20) + '...'
                });
                
                if (!keysMatch) {
                    console.error('AP NMI Blocks: KEY MISMATCH! CollectJS token generated with one key, but Gateway.js using different key. This causes "Payment Token does not exist" errors.');
                }
                
                const gateway = Gateway.create(ap_nmi_threeds_config.public_key);
                const threeDS = gateway.get3DSecure();
                
                const options = {
                    paymentToken: paymentToken,
                    currency: ap_nmi_threeds_config.currency,
                    amount: ap_nmi_threeds_config.amount
                };
                
                // Add billing data
                if (ap_nmi_threeds_config.billing_data) {
                    Object.assign(options, ap_nmi_threeds_config.billing_data);
                }
                
                // Add device data to prevent timeouts (per latest NMI docs)
                Object.assign(options, nmiBlocksCollectDeviceData());
                
                console.log('AP NMI Blocks: 3DS options for new card:', options);
                
                const threeDSecureInterface = threeDS.createUI(options);
                window.currentNmi3DSInstance = threeDSecureInterface; // Track instance
                threeDSecureInterface.start('#threeDSMountPoint');
                
                threeDSecureInterface.on('challenge', function(e) {
                    console.log('AP NMI Blocks: 3DS Challenge for new card');
                });
                
                threeDSecureInterface.on('complete', function(e) {
                    console.log('AP NMI Blocks: 3DS complete for new card:', e);
                    
                    // Use helper to safely extract only valid 3DS fields
                    const safe3DSData = window.nmiBlocksSafe3DSData(e);
                    
                    resolve({
                        type: emitResponse.responseTypes.SUCCESS,
                        meta: {
                            paymentMethodData: {
                                payment_token: paymentToken,
                                save_payment_method: savePaymentMethodRef.current ? '1' : '0',
                                use_save_payment_method: '0',
                                ...safe3DSData,
                            },
                        },
                    });
                });
                
                threeDSecureInterface.on('failure', function(e) {
                    console.error('AP NMI Blocks: 3DS failed for new card:', e);
                    
                    const failureAction = ap_nmi_threeds_config['3ds_failure_action'] || 'decline';
                    
                    if (failureAction === 'decline') {
                        reject({
                            type: emitResponse.responseTypes.ERROR,
                            message: __('Card verification failed. Please try a different payment method.', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                        });
                    } else if (failureAction === 'continue_without_3ds') {
                        resolve({
                            type: emitResponse.responseTypes.SUCCESS,
                            meta: {
                                paymentMethodData: {
                                    payment_token: paymentToken,
                                    save_payment_method: savePaymentMethodRef.current ? '1' : '0',
                                    use_save_payment_method: '0',
                                },
                            },
                        });
                    } else if (failureAction === 'continue_with_warning') {
                        resolve({
                            type: emitResponse.responseTypes.SUCCESS,
                            meta: {
                                paymentMethodData: {
                                    payment_token: paymentToken,
                                    save_payment_method: savePaymentMethodRef.current ? '1' : '0',
                                    use_save_payment_method: '0',
                                    threeds_warning: 'authentication_failed',
                                },
                            },
                        });
                    }
                });
                
                gateway.on('error', function(e) {
                    console.error('AP NMI Blocks: Gateway error for new card:', e);
                    
                    // Check if 3DS is inactive on merchant account
                    let errorMessage = __('Payment verification error. Please try again.', 'gaincommerce-nmi-payment-gateway-for-woocommerce');
                    
                    if (e.message && e.message.includes('3DSecure is inactive')) {
                        console.error('NMI 3DS Error: 3-D Secure is not enabled on your NMI merchant account');
                        errorMessage = __('Secure payment verification is currently unavailable. Please contact the store or try a different payment method.', 'gaincommerce-nmi-payment-gateway-for-woocommerce');
                    }
                    
                    console.log('AP NMI Blocks: Calling setError for new card with message:', errorMessage);
                    
                    // Display error directly in DOM
                    const errorContainer = document.querySelector('.wc-block-components-notices');
                    if (errorContainer) {
                        errorContainer.innerHTML = `<div class="wc-block-components-notice-banner is-error" role="alert"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M12 3.2c-4.8 0-8.8 3.9-8.8 8.8 0 4.8 3.9 8.8 8.8 8.8 4.8 0 8.8-3.9 8.8-8.8 0-4.8-4-8.8-8.8-8.8zm0 16c-4 0-7.2-3.3-7.2-7.2C4.8 8 8 4.8 12 4.8s7.2 3.3 7.2 7.2c0 4-3.2 7.2-7.2 7.2zM11 17h2v-6h-2v6zm0-8h2V7h-2v2z"></path></svg><div class="wc-block-components-notice-banner__content">${errorMessage}</div></div>`;
                    }
                    
                    // Also show an alert as fallback
                    alert(errorMessage);
                    
                    setError(errorMessage);
                    reject({
                        type: emitResponse.responseTypes.ERROR,
                        message: errorMessage,
                    });
                });
                
            } catch (error) {
                console.error('AP NMI Blocks: 3DS initialization error for new card:', error);
                const errorMessage = __('Unable to initialize card verification. Please try again.', 'gaincommerce-nmi-payment-gateway-for-woocommerce');
                alert(errorMessage); // Fallback alert
                reject({
                    type: emitResponse.responseTypes.ERROR,
                    message: errorMessage,
                });
            }
        };
        
        return unsubscribe;
    }, [onPaymentSetup, fieldValidity, useSavedCard]);

    // Render the form
    // Both wallet types require HTTPS — guard with isSecureContext before any
    // browser API call so HTTP dev environments don't throw or crash React.
    let applePayAvailable = false;
    if ( window.isSecureContext && settings.apple_pay_enabled === 'yes' ) {
        try {
            applePayAvailable =
                typeof window.ApplePaySession !== 'undefined' &&
                window.ApplePaySession.canMakePayments();
        } catch ( e ) {
            // InvalidAccessError on HTTP — treat as unsupported
        }
    }
    const googlePayAvailable = settings.google_pay_enabled === 'yes';
    const showWallets = applePayAvailable || googlePayAvailable;

    return (
        <div className="ap-nmi-payment-form-blocks">
            {/* Digital Wallet Buttons — shown above CC form when enabled and supported */}
            {showWallets && (
                <div className="nmi-digital-wallets-wrap" style={{ marginBottom: '16px' }}>
                    {applePayAvailable && (
                        <div className="nmi-apple-pay-wrap" style={{ marginBottom: '10px' }}>
                            <div id="nmi-apple-pay-button-blocks"></div>
                        </div>
                    )}
                    {googlePayAvailable && (
                        <div className="nmi-google-pay-wrap" style={{ marginBottom: '10px' }}>
                            <div id="nmi-google-pay-button-blocks"></div>
                        </div>
                    )}
                    <div className="nmi-or-divider" style={{ textAlign: 'center', margin: '10px 0', color: '#999' }}>
                        {__('— or pay with card —', 'gaincommerce-nmi-payment-gateway-for-woocommerce')}
                    </div>
                </div>
            )}

            {error && (
                <div className="woocommerce-error" role="alert" style={{
                    backgroundColor: '#e2401c',
                    color: '#fff',
                    padding: '1em',
                    marginBottom: '1em',
                    borderRadius: '4px',
                    fontSize: '14px',
                    lineHeight: '1.5'
                }}>
                    {error}
                </div>
            )}

            {/* Saved Payment Method Selection */}
            {settings.has_saved_card && settings.saved_card_details && (
                <div className="ap-nmi-saved-card-selection" style={{ marginBottom: '1em' }}>
                    <label style={{ display: 'block', marginBottom: '0.5em' }}>
                        <input
                            type="radio"
                            name="use_save_payment_method"
                            value="1"
                            checked={useSavedCard}
                            onChange={() => setUseSavedCard(true)}
                            style={{ marginRight: '0.5em' }}
                        />
                        {__('Use saved card ending in', 'gaincommerce-nmi-payment-gateway-for-woocommerce')} ****{settings.saved_card_details.last4}
                        {settings.saved_card_details.type && ` (${settings.saved_card_details.type})`}
                        {settings.saved_card_details.exp_date && ` - Exp: ${settings.saved_card_details.exp_date}`}
                    </label>
                    <label style={{ display: 'block' }}>
                        <input
                            type="radio"
                            name="use_save_payment_method"
                            value="0"
                            checked={!useSavedCard}
                            onChange={() => setUseSavedCard(false)}
                            style={{ marginRight: '0.5em' }}
                        />
                        {__('Use a new card', 'gaincommerce-nmi-payment-gateway-for-woocommerce')}
                    </label>
                </div>
            )}

            {/* Card fields - always rendered but hidden when using saved card */}
            <div style={{ display: (settings.has_saved_card && useSavedCard) ? 'none' : 'block' }}>
                <div className="ap-nni-card-icons-container">
                    <div className="ap-nmi-card-icons">
                        {settings.allowed_card_types && Object.entries(settings.allowed_card_types).map(([cardType, cardData]) => (
                            <span 
                                key={cardType} 
                                className={`card-icon ${cardType} ${cardData.status}`}
                                title={cardData.title}
                            ></span>
                        ))}
                        
                    </div>
                    {settings.restricted_card_types.length > 0 && (
                        <div className="ap-nmi-card-restrictions-info">
                            {__('Cards marked with ✕ are not accepted for payment.', 'gaincommerce-nmi-payment-gateway-for-woocommerce')}
                        </div>
                    )}
                    <p></p>
                </div>

                {/* Card Number Field */}
                <div className="ap-nmi-field form-row form-row-wide">
                    <label htmlFor="ap-nmi-card-number">
                        {__('Card Number', 'gaincommerce-nmi-payment-gateway-for-woocommerce')} <span className="required">*</span>
                    </label>
                    <div id="ap-nmi-card-number"></div>
                </div>

                {/* Row for Expiry and CVV */}
                <div className="ap-nmi-row">
                    {/* Expiry Date Field */}
                    <div className="ap-nmi-field ap-nmi-half form-row form-row-first">
                        <label htmlFor="ap-nmi-expiry-date">
                            {__('Expiry Date', 'gaincommerce-nmi-payment-gateway-for-woocommerce')} <span className="required">*</span>
                        </label>
                        <div id="ap-nmi-expiry-date"></div>
                    </div>

                    {/* CVV Field */}
                    <div className="ap-nmi-field ap-nmi-half form-row form-row-last">
                        <label htmlFor="ap-nmi-card-cvv">
                            {__('CVV', 'gaincommerce-nmi-payment-gateway-for-woocommerce')}
                        </label>
                        <div id="ap-nmi-card-cvv"></div>
                    </div>
                </div>

                {/* Test mode notice */}
                {settings.testmode === 'yes' && (
                    <div className="ap-nmi-test-notice" style={{ marginTop: '1em', padding: '0.5em', backgroundColor: '#f0f0f0', border: '1px solid #ddd', borderRadius: '4px' }}>
                        {__('TEST MODE: Use a test card number.', 'gaincommerce-nmi-payment-gateway-for-woocommerce')}
                    </div>
                )}

                {/* Save Payment Method Checkbox - only show when using new card */}
                {settings.save_payment_enabled && (
                    <div className="ap-nmi-field form-row form-row-wide" style={{ marginTop: '1em' }}>
                        {console.log('AP NMI Blocks: Rendering save payment checkbox, current state:', savePaymentMethod)}
                        <CheckboxControl
                            label={__('Save payment method for future purchases', 'gaincommerce-nmi-payment-gateway-for-woocommerce')}
                            checked={savePaymentMethod}
                            onChange={(newValue) => {
                                console.log('AP NMI Blocks: Checkbox onChange fired, new value:', newValue);
                                setSavePaymentMethod(newValue);
                            }}
                            __nextHasNoMarginBottom
                            className="ap-nmi-save-payment-checkbox"
                        />
                    </div>
                )}
                {!settings.save_payment_enabled && console.log('AP NMI Blocks: save_payment_enabled is FALSE, checkbox not rendered')}
                
                {/* 3D Secure Mount Point */}
                <div 
                    id="threeDSMountPoint" 
                    style={{ 
                        marginTop: '15px',
                        minHeight: '100px',
                        maxWidth: '100%',
                        position: 'relative'
                    }}
                ></div>
                
                {/* 3D Secure Message */}
                <div 
                    id="threeDSMessage" 
                    style={{ 
                        display: 'none',
                        padding: '10px',
                        background: '#f0f0f0',
                        marginTop: '10px',
                        borderRadius: '4px',
                        textAlign: 'center'
                    }}
                ></div>
            </div>
        </div>
    );
};

/**
 * Label component - what customers see in the payment method list
 */
const Label = () => {
    return (
        <span style={{ width: '100%' }}>
            <span>
                {settings.title || defaultLabel}
            </span>
            {settings.description && (
                <span style={{ 
                    display: 'block', 
                    fontSize: '0.9em', 
                    color: '#666',
                    marginTop: '4px' 
                }}>
                    {settings.description}
                </span>
            )}
        </span>
    );
};

/**
 * Payment method configuration object
 */
const apNmiPaymentMethod = {
    name: settings.wc_gateway_id || 'gaincommerce_nmi',
    label: <Label />,
    content: <CreditCardForm />,
    edit: <CreditCardForm />,
    canMakePayment: () => {
        // Simple availability check
        return settings.is_available === 'yes';
    },
    ariaLabel: settings.title || defaultLabel,
    supports: {
        features: settings.supports || ['products'],
    },
};

// Register the payment method with WooCommerce Blocks

/**
 * Collect device data for 3DS authentication in blocks checkout
 * Per latest NMI docs, helps prevent timeouts
 * 
 * @returns {Object} Device data fields
 */
function nmiBlocksCollectDeviceData() {
    let browserJavaEnabled = 'false';
    
    // window.navigator.javaEnabled() is deprecated, use try/catch
    try {
        if (navigator.javaEnabled && typeof navigator.javaEnabled === 'function') {
            browserJavaEnabled = navigator.javaEnabled() ? 'true' : 'false';
        }
    } catch(e) {
        browserJavaEnabled = 'false';
    }
    
    return {
        browserJavaEnabled: browserJavaEnabled,
        browserJavascriptEnabled: 'true',
        browserLanguage: window.navigator.language || window.navigator.userLanguage || 'en-US',
        browserColorDepth: String(window.screen.colorDepth || '24'),
        browserScreenHeight: String(window.screen.height || '768'),
        browserScreenWidth: String(window.screen.width || '1024'),
        browserTimeZone: String(new Date().getTimezoneOffset()),
        deviceChannel: 'Browser'
    };
}
console.log('AP NMI Blocks: Registering payment method...');
registerPaymentMethod(apNmiPaymentMethod);
console.log('AP NMI Blocks: Payment method registered successfully');
