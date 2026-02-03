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

        CollectJS.configure({
            variant: "inline",
            invalidCss: { color: "#e74c3c", "border-color": "#e74c3c" },
            validCss: { color: "black", "border-color": "#2ecc71" },
            placeholderCss: { color: "darkgray", "background-color": "#ffffff" },
            focusCss: { color: "black", "border-color": "#4681f4" },
            fields: {
                ccnumber: { selector: "#ap-nmi-card-number", title: "Card Number", placeholder: "0000 0000 0000 0000" },
                ccexp: { selector: "#ap-nmi-expiry-date", title: "Card Expiration", placeholder: "MM/YY" },
                cvv: { display: "show", selector: "#ap-nmi-card-cvv", title: "CVV", placeholder: "123" }
            },
            validationCallback: (field, status, message) => {
                console.log('AP NMI Blocks: Validation:', field, status, message);
                setFieldValidity(prev => ({ ...prev, [field.field || field]: status }));
            },
            callback: (response) => {
                console.log('AP NMI Blocks: CollectJS callback triggered.', response);
                
                // If there's an active promise, handle it
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
                            nmiBlocksHandle3DSForNewCard(response.token, promiseRef.current.resolve, promiseRef.current.reject);
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
        });
    }, []); // Empty dependency array ensures this runs only once

    // Register payment setup handler
    useEffect(() => {
        const unsubscribe = onPaymentSetup(() => {
            console.log('AP NMI Blocks: onPaymentSetup triggered.');
            setError(null); // Clear previous errors

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
                        
                        nmiBlocksHandle3DSForVault(customerVaultId, resolve, reject);
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
        
        // 3DS handler for saved vault cards
        window.nmiBlocksHandle3DSForVault = function(customerVaultId, resolve, reject) {
            try {
                const gateway = Gateway.create(ap_nmi_threeds_config.checkout_public_key);
                const threeDS = gateway.get3DSecure();
                
                const options = {
                    customerVaultId: customerVaultId,
                    currency: ap_nmi_threeds_config.currency,
                    amount: ap_nmi_threeds_config.amount
                };
                
                console.log('AP NMI Blocks: 3DS options for vault:', options);
                
                const threeDSecureInterface = threeDS.createUI(options);
                threeDSecureInterface.start('#threeDSMountPoint');
                
                threeDSecureInterface.on('challenge', function(e) {
                    console.log('AP NMI Blocks: 3DS Challenge for saved card');
                });
                
                threeDSecureInterface.on('complete', function(e) {
                    console.log('AP NMI Blocks: 3DS complete for saved card:', e);
                    
                    resolve({
                        type: emitResponse.responseTypes.SUCCESS,
                        meta: {
                            paymentMethodData: {
                                use_save_payment_method: '1',
                                save_payment_method: '0',
                                cavv: e.cavv,
                                xid: e.xid,
                                eci: e.eci,
                                cardholder_auth: e.cardHolderAuth,
                                three_ds_version: e.threeDsVersion,
                                directory_server_id: e.directoryServerId,
                                cardholder_info: e.cardHolderInfo,
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
                    reject({
                        type: emitResponse.responseTypes.ERROR,
                        message: __('Payment verification error. Please try again.', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                    });
                });
                
            } catch (error) {
                console.error('AP NMI Blocks: 3DS initialization error for saved card:', error);
                reject({
                    type: emitResponse.responseTypes.ERROR,
                    message: __('Unable to initialize card verification. Please try again.', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                });
            }
        };
        
        // 3DS handler for new cards
        window.nmiBlocksHandle3DSForNewCard = function(paymentToken, resolve, reject) {
            try {
                const gateway = Gateway.create(ap_nmi_threeds_config.checkout_public_key);
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
                
                console.log('AP NMI Blocks: 3DS options for new card:', options);
                
                const threeDSecureInterface = threeDS.createUI(options);
                threeDSecureInterface.start('#threeDSMountPoint');
                
                threeDSecureInterface.on('challenge', function(e) {
                    console.log('AP NMI Blocks: 3DS Challenge for new card');
                });
                
                threeDSecureInterface.on('complete', function(e) {
                    console.log('AP NMI Blocks: 3DS complete for new card:', e);
                    
                    resolve({
                        type: emitResponse.responseTypes.SUCCESS,
                        meta: {
                            paymentMethodData: {
                                payment_token: paymentToken,
                                save_payment_method: savePaymentMethodRef.current ? '1' : '0',
                                use_save_payment_method: '0',
                                cavv: e.cavv,
                                xid: e.xid,
                                eci: e.eci,
                                cardholder_auth: e.cardHolderAuth,
                                three_ds_version: e.threeDsVersion,
                                directory_server_id: e.directoryServerId,
                                cardholder_info: e.cardHolderInfo,
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
                    reject({
                        type: emitResponse.responseTypes.ERROR,
                        message: __('Payment verification error. Please try again.', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                    });
                });
                
            } catch (error) {
                console.error('AP NMI Blocks: 3DS initialization error for new card:', error);
                reject({
                    type: emitResponse.responseTypes.ERROR,
                    message: __('Unable to initialize card verification. Please try again.', 'gaincommerce-nmi-payment-gateway-for-woocommerce'),
                });
            }
        };
        
        return unsubscribe;
    }, [onPaymentSetup, fieldValidity, useSavedCard]);

    // Render the form
    return (
        <div className="ap-nmi-payment-form-blocks">
            {error && <div className="woocommerce-error" role="alert">{error}</div>}

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
                        minHeight: '400px',
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
console.log('AP NMI Blocks: Registering payment method...');
registerPaymentMethod(apNmiPaymentMethod);
console.log('AP NMI Blocks: Payment method registered successfully');
