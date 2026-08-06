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
 * Tracing is a dependency of this bundle, but never let a missing trace helper break
 * checkout — fall back to console-only.
 */
const NMITrace = window.NMITrace || {
    id: () => '',
    log: ( stage, detail ) => console.log( 'NMI ' + stage, detail || '' ),
    warn: ( stage, detail ) => console.warn( 'NMI ' + stage, detail || '' ),
    error: ( stage, detail ) => console.error( 'NMI ' + stage, detail || '' ),
    flush: () => {},
};

/**
 * Field name carrying the trace id into process_payment, so the server entries log
 * under the same id as the browser entries.
 */
const TRACE_FIELD = ( window.apNmiTraceConfig && window.apNmiTraceConfig.field ) || 'ap_nmi_trace_id';

/**
 * Merge the trace id into a paymentMethodData payload.
 *
 * @param {Object} data paymentMethodData.
 * @return {Object} Same data plus the trace id.
 */
const withTraceId = ( data ) => Object.assign( {}, data, { [ TRACE_FIELD ]: NMITrace.id() } );

/**
 * Snapshot of the shared CollectJS state, attached to tokenization failures.
 *
 * CollectJS is a singleton and more than one gateway configures it (the card gateway
 * here, the ACH gateway in the enterprise plugin). Config.update() deep-merges, so
 * `fields` accumulate across gateways while scalars such as `callback` and
 * `timeoutDuration` are overwritten by whichever configure() ran last. When
 * tokenization stalls, this snapshot shows who ended up owning the object and which
 * iframes were actually messaged.
 *
 * @return {Object} Diagnostic snapshot.
 */
const nmiTokenizationTrace = () => {
    if (typeof CollectJS === 'undefined') {
        return { collectJS: 'undefined' };
    }

    return {
        // Which fields CollectJS thinks it has, i.e. whether ACH fields merged in.
        configuredFields: CollectJS.config ? Object.keys(CollectJS.config.fields || {}) : null,
        // Which iframes startPaymentRequest() actually posts SaveMultipartToken to.
        iframeKeys: CollectJS.iframes ? Object.keys(CollectJS.iframes) : null,
        inlineIframesInDom: document.querySelectorAll('.CollectJSInlineIframe').length,
        inSubmission: CollectJS.inSubmission,
        timeoutDuration: CollectJS.config ? CollectJS.config.timeoutDuration : null,
    };
};

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

    // Log configuration to debug panel when component mounts
    useEffect(() => {
        if (typeof window.NMI_Debug !== 'undefined') {
            console.log('NMI Blocks Configuration:', {
                public_key_present: !!(settings.public_key && settings.public_key.length > 0),
                public_key_prefix: settings.public_key ? settings.public_key.substring(0, 10) + '...' : 'none',
                apple_pay_enabled: settings.apple_pay_enabled,
                google_pay_enabled: settings.google_pay_enabled,
                apple_merchant_id: settings.apple_merchant_id || 'not set',
                google_merchant_id: settings.google_merchant_id || 'not set',
                country: settings.country,
                currency: settings.currency,
                cart_total: settings.cart_total,
                is_blocks_checkout: true
            });
            
            // Add to debug panel
            window.NMI_Debug.addSystemInfo('Checkout Type', 'WooCommerce Blocks');
            window.NMI_Debug.addSystemInfo('Apple Pay Enabled (Settings)', settings.apple_pay_enabled);
            window.NMI_Debug.addSystemInfo('Google Pay Enabled (Settings)', settings.google_pay_enabled);
            window.NMI_Debug.addSystemInfo('Apple Merchant ID', settings.apple_merchant_id || 'not set');
            window.NMI_Debug.addSystemInfo('Google Merchant ID', settings.google_merchant_id || 'not set');
            window.NMI_Debug.addSystemInfo('Cart Total', settings.currency + ' ' + settings.cart_total);
            window.NMI_Debug.addSystemInfo('Country', settings.country);
            window.NMI_Debug.addSystemInfo('Public Key Present', !!(settings.public_key && settings.public_key.length > 0));
            window.NMI_Debug.addSystemInfo('CollectJS Loaded', typeof CollectJS !== 'undefined');
        }
    }, []); // Empty dependency array - run once on mount

    // Initialize CollectJS and set up the callback just once
    useEffect(() => {
        if (typeof CollectJS === 'undefined') {
            console.error('AP NMI Blocks: CollectJS not loaded');
            setError(__('Payment form failed to load. Please refresh the page.', 'gaincommerce-nmi-payment-gateway-for-woocommerce'));
            return;
        }

        console.log('AP NMI Blocks: Initializing CollectJS...');

        // Mark as configured so apple-pay-blocks.js fallback skips its own configure call.
        window.nmiCollectJSBlocksConfigured = true;

        // Build wallet fields to include in the same configure call as CC fields.
        // CollectJS can only be configured once, so all fields must be declared together.
        //
        // Preconditions are checked before we hand anything to CollectJS — see
        // assets/js/nmi-wallet-support.js, shared with the legacy checkout. An unmet
        // precondition is logged at console.info and the wallet is left out of the
        // config; it must never affect the card fields or block checkout.
        const walletFields = {};
        const walletSupport = window.NMIWalletSupport;

        if ( walletSupport && walletSupport.canUseApplePay( settings.apple_pay_enabled === 'yes', '#nmi-apple-pay-button-blocks' ) ) {
            // Key is camelCase `applePay` — CollectJS's Config accepts `applePay` and
            // silently ignores anything else, so a lowercase `applepay` configures
            // nothing at all.
            walletFields.applePay = {
                selector: '#nmi-apple-pay-button-blocks',
            };
            console.log('AP NMI Blocks: Including Apple Pay field in CollectJS config');
        }

        if ( walletSupport && walletSupport.canUseGooglePay( settings.google_pay_enabled === 'yes', '#nmi-google-pay-button-blocks' ) ) {
            // Only the properties in CollectJS's googlePay allowlist may appear here.
            // An unknown key makes configure() throw, which aborts before the card
            // iframes are built. The merchant ID is not one of them — CollectJS takes
            // it from the tokenization response.
            walletFields.googlePay = {
                selector:    '#nmi-google-pay-button-blocks',
                buttonType:  'buy',
                buttonColor: 'black',
            };
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
            fieldsAvailableCallback: () => {
                NMITrace.log('blocks:fieldsAvailable', nmiTokenizationTrace());
                if (typeof window.NMI_Debug !== 'undefined') {
                    window.NMI_Debug.addSystemInfo('Card Fields Mounted', 'YES');
                }
            },
            // CollectJS's own timer. It is shorter than the 15s watchdog on the
            // tokenization promise below, so it always fires first — it must reject the
            // pending order, otherwise the checkout sits idle for another 5s and then
            // reports a second, differently worded timeout.
            timeoutDuration: 10000,
            timeoutCallback: () => {
                NMITrace.error('blocks:tokenize:timeout_collectjs', nmiTokenizationTrace());
                if (typeof window.NMI_Debug !== 'undefined') {
                    window.NMI_Debug.addSystemInfo('CollectJS Timeout', 'Tokenization did not respond within 10s');
                }

                const errorMessage = __('Payment processing timed out. Please try again.', 'gaincommerce-nmi-payment-gateway-for-woocommerce');
                setError(errorMessage);
                if (promiseRef.current) {
                    if (promiseRef.current.clearTimeout) {
                        promiseRef.current.clearTimeout();
                    }
                    promiseRef.current.reject({
                        type: emitResponse.responseTypes.ERROR,
                        message: errorMessage,
                    });
                    promiseRef.current = null;
                }
            },
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
                NMITrace.log('blocks:token:received', {
                    tokenType: response.tokenType,
                    hasToken: !!response.token,
                    cardType: response.card && response.card.type,
                    isWallet: !!(window.NMIWalletSupport && window.NMIWalletSupport.isWalletResponse(response)),
                    hasPendingOrder: !!promiseRef.current
                });

                // Wallet payment — stash the token and start the blocks checkout, so
                // onPaymentSetup below picks it up out of walletTokenRef.
                //
                // The wallet button lives inside the CC payment form rather than being
                // a registered express payment method (see Plugin::init_blocks_support),
                // so a tap happens outside WooCommerce's place-order flow entirely and
                // there is no pending order to settle. Clicking the place-order button
                // is what starts one.
                //
                // Dispatch on tokenType, NOT on response.wallet. CollectJS always sets
                // response.wallet, and for a card tokenization it is an object of null
                // fields — always truthy. Testing it sent every card payment down this
                // branch, which returns without settling promiseRef, so the order hung
                // until the tokenization watchdog fired.
                if (window.NMIWalletSupport && window.NMIWalletSupport.isWalletResponse(response)) {
                    const walletType = window.NMIWalletSupport.walletTypeOf(response);
                    NMITrace.log('blocks:wallet:token', { walletType: walletType });

                    walletTokenRef.current = response.token;
                    walletTypeRef.current  = walletType;

                    // If an order is already in flight (the shopper hit Place Order and
                    // onPaymentSetup is waiting on us), settle it directly instead.
                    if (promiseRef.current) {
                        if (promiseRef.current.clearTimeout) {
                            promiseRef.current.clearTimeout();
                        }
                        walletTokenRef.current = null;
                        walletTypeRef.current  = null;
                        promiseRef.current.resolve({
                            type: emitResponse.responseTypes.SUCCESS,
                            meta: {
                                paymentMethodData: withTraceId({
                                    payment_token:           response.token,
                                    nmi_wallet_type:         walletType,
                                    save_payment_method:     '0',
                                    use_save_payment_method: '0',
                                }),
                            },
                        });
                        promiseRef.current = null;
                        return;
                    }

                    const placeOrder = document.querySelector('.wc-block-components-checkout-place-order-button');
                    if (placeOrder) {
                        placeOrder.click();
                        return;
                    }

                    // Nothing left to drive the order with. Clear the refs so a stale
                    // token cannot attach itself to the shopper's next card attempt.
                    walletTokenRef.current = null;
                    walletTypeRef.current  = null;
                    NMITrace.error('blocks:wallet:no_place_order_button', { walletType: walletType });
                    setError(__('This wallet is not available at checkout. Please pay by card.', 'gaincommerce-nmi-payment-gateway-for-woocommerce'));
                    return;
                }

                // CC payment (existing promise-based flow)
                if (promiseRef.current) {
                    // Clear the timeout since we got a response
                    if (promiseRef.current.clearTimeout) {
                        promiseRef.current.clearTimeout();
                    }

                    // Card type restriction check.
                    // Anything that throws in this callback leaves CollectJS permanently
                    // wedged: MessageHandler sets inSubmission = false and calls
                    // retokenize() only *after* this callback returns, so a throw makes
                    // every later Place Order a silent no-op. Keep this defensive.
                    if (response.card && response.card.type) {
                        const restricted_card = settings.restricted_card_types || '';
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
                                NMITrace.log('blocks:token:ok');
                        
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
                                    paymentMethodData: withTraceId({
                                        payment_token: response.token,
                                        save_payment_method: savePaymentMethodRef.current ? '1' : '0',
                                        use_save_payment_method: '0', // New card
                                    }),
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

        // CollectJS throws "Could not create PaymentRequestAbstraction" *asynchronously*
        // (inside a Promise) when the Apple Pay merchant session fails — e.g. NMI account
        // not yet activated for Apple Pay, or domain validation handshake rejected.
        // A synchronous try-catch won't catch it; we need an unhandledrejection listener.
        if ( Object.keys( walletFields ).length > 0 ) {
            const nmiAsyncWalletErrHandler = ( event ) => {
                const msg = event.reason && ( event.reason.message || String( event.reason ) );
                if ( msg && msg.indexOf( 'PaymentRequestAbstraction' ) !== -1 ) {
                    console.warn( 'AP NMI Blocks: Apple Pay merchant session failed (async). ' +
                        'Verify NMI merchant account has Apple Pay activated. Hiding button.' );
                    event.preventDefault();
                    const apWrap = document.querySelector( '.nmi-apple-pay-wrap' );
                    if ( apWrap ) apWrap.style.display = 'none';
                    window.removeEventListener( 'unhandledrejection', nmiAsyncWalletErrHandler );
                }
            };
            window.addEventListener( 'unhandledrejection', nmiAsyncWalletErrHandler );
        }

        // Also guard the synchronous path (some environments throw sync).
        //
        // Any throw out of configure() must degrade to card-only rather than propagate:
        // Config.update() assigns the new config *before* it validates, so a rejected
        // config leaves CollectJS mutated but skips buildInlineIframes() — mutated
        // config, no card fields, and in blocks a throw here also tears down the React
        // subtree. Card-only is always the safe fallback.
        try {
            runConfigure( Object.assign( {}, ccFields, walletFields ) );
        } catch ( e ) {
            if ( Object.keys( walletFields ).length === 0 ) {
                // Nothing left to drop — the card config itself is bad.
                console.error( 'AP NMI Blocks: CollectJS.configure() failed with card fields only:', e.message, e );
                setError( __( 'The payment form failed to load. Please reload the page.', 'gaincommerce-nmi-payment-gateway-for-woocommerce' ) );
                return;
            }

            console.warn( 'AP NMI Blocks: CollectJS.configure() rejected the wallet fields, retrying card-only:', e.message );
            const apWrap = document.querySelector( '.nmi-apple-pay-wrap' );
            if ( apWrap ) apWrap.style.display = 'none';
            const gpWrap = document.querySelector( '.nmi-google-pay-wrap' );
            if ( gpWrap ) gpWrap.style.display = 'none';

            try {
                runConfigure( ccFields );
            } catch ( ccError ) {
                console.error( 'AP NMI Blocks: card-only CollectJS.configure() also failed:', ccError.message, ccError );
                setError( __( 'The payment form failed to load. Please reload the page.', 'gaincommerce-nmi-payment-gateway-for-woocommerce' ) );
            }
        }
    }, []); // Empty dependency array ensures this runs only once

    // Register payment setup handler
    useEffect(() => {
        const unsubscribe = onPaymentSetup(() => {
            NMITrace.log('blocks:onPaymentSetup');
            setError(null); // Clear previous errors

            // Wallet payment — the token was captured when the wallet button was tapped,
            // and that handler clicked Place Order to get us here. Must stay ahead of
            // the saved-card and card branches: a wallet payment carries its own token
            // and needs no Collect.js round trip.
            if (walletTokenRef.current) {
                const token    = walletTokenRef.current;
                const walletType = walletTypeRef.current;
                walletTokenRef.current = null;
                walletTypeRef.current  = null;
                NMITrace.log('blocks:wallet:resolve', { walletType: walletType });
                return {
                    type: emitResponse.responseTypes.SUCCESS,
                    meta: {
                        paymentMethodData: withTraceId({
                            payment_token:           token,
                            nmi_wallet_type:         walletType,
                            save_payment_method:     '0',
                            use_save_payment_method: '0',
                        }),
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
                        paymentMethodData: withTraceId({
                            use_save_payment_method: '1', // Using saved card
                            save_payment_method: '0', // Not saving
                        }),
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

            NMITrace.log('blocks:tokenize:start', nmiTokenizationTrace());

            return new Promise((resolve, reject) => {
                // Store promise handlers and timeout clearer in the ref
                promiseRef.current = { 
                    resolve, 
                    reject,
                    clearTimeout: null 
                };

                // Backstop only — CollectJS's own 10s timeoutCallback normally rejects
                // first. This catches the case where CollectJS never starts its timer.
                const timeout = setTimeout(() => {
                    NMITrace.error('blocks:tokenize:timeout_watchdog', nmiTokenizationTrace());
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
                            paymentMethodData: withTraceId({
                                use_save_payment_method: '1',
                                save_payment_method: '0',
                                ...safe3DSData,
                            }),
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
                                paymentMethodData: withTraceId({
                                    use_save_payment_method: '1',
                                    save_payment_method: '0',
                                }),
                            },
                        });
                    } else if (failureAction === 'continue_with_warning') {
                        resolve({
                            type: emitResponse.responseTypes.SUCCESS,
                            meta: {
                                paymentMethodData: withTraceId({
                                    use_save_payment_method: '1',
                                    save_payment_method: '0',
                                    threeds_warning: 'authentication_failed',
                                }),
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
                            paymentMethodData: withTraceId({
                                payment_token: paymentToken,
                                save_payment_method: savePaymentMethodRef.current ? '1' : '0',
                                use_save_payment_method: '0',
                                ...safe3DSData,
                            }),
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
                                paymentMethodData: withTraceId({
                                    payment_token: paymentToken,
                                    save_payment_method: savePaymentMethodRef.current ? '1' : '0',
                                    use_save_payment_method: '0',
                                }),
                            },
                        });
                    } else if (failureAction === 'continue_with_warning') {
                        resolve({
                            type: emitResponse.responseTypes.SUCCESS,
                            meta: {
                                paymentMethodData: withTraceId({
                                    payment_token: paymentToken,
                                    save_payment_method: savePaymentMethodRef.current ? '1' : '0',
                                    use_save_payment_method: '0',
                                    threeds_warning: 'authentication_failed',
                                }),
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
            {/* NMI Debug Panel for Apple Pay/Google Pay Debugging */}
            {settings.debug_console_enabled && (
            <div className="nmi-debug-panel">
                <div className="nmi-debug-panel-header">
                    <div>
                        <h3 className="nmi-debug-panel-title">🐛 NMI Payment Debug Console</h3>
                        <p className="nmi-debug-panel-subtitle">Real-time debugging for Apple Pay & Google Pay</p>
                    </div>
                    <div className="nmi-debug-panel-actions">
                        <button
                            type="button"
                            id="nmi-debug-clear"
                            className="nmi-debug-btn"
                            onClick={() => window.NMI_Debug && window.NMI_Debug.clear()}
                        >
                            Clear Logs
                        </button>
                        <button
                            type="button"
                            id="nmi-debug-copy"
                            className="nmi-debug-btn"
                            onClick={() => window.NMI_Debug && window.NMI_Debug.copyLogs()}
                        >
                            Copy All
                        </button>
                    </div>
                </div>

                <div className="nmi-debug-section">
                    <h4 className="nmi-debug-section-title">📱 System Information</h4>
                    <div id="nmi-debug-system-info" className="nmi-debug-system-info">
                        <div className="nmi-debug-loading">Loading system information</div>
                    </div>
                </div>

                <div className="nmi-debug-section">
                    <h4 className="nmi-debug-section-title">📝 Console Logs (NMI-related only)</h4>
                    <div id="nmi-debug-logs" className="nmi-debug-logs-container">
                        <div className="nmi-debug-no-logs">Waiting for logs...</div>
                    </div>
                </div>
            </div>
            )}
            {/* End NMI Debug Panel */}

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
