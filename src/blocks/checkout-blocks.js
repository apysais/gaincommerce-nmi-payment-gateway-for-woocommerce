/**
 * WooCommerce Checkout Blocks Integration for AP NMI Payment Gateway
 * Modern ES6+ implementation with proper imports and build process
 */

import { createElement, useState, useEffect, useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { registerPaymentMethod } from '@woocommerce/blocks-registry';
import { getSetting } from '@woocommerce/settings';

// Debug logging
console.log('AP NMI Blocks: Script loading...');

// Get payment method data passed from PHP
const settings = getSetting('ap_nmi_data', {});
const defaultLabel = __('AP NMI Payment Gateway', 'gaincommerce-nmi-payment-gateway-for-woocommerce');

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
    const promiseRef = useRef(null); // To hold promise resolve/reject functions

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
                        promiseRef.current.resolve({
                            type: emitResponse.responseTypes.SUCCESS,
                            meta: {
                                paymentMethodData: {
                                    payment_token: response.token,
                                },
                            },
                        });
                    } else {
                        console.error('AP NMI Blocks: Token generation failed.', response);
                        const errorMessage = response.error?.message || __('Invalid card details. Please check and try again.', 'gaincommerce-nmi-payment-gateway-for-woocommerce');
                        setError(errorMessage);
                        promiseRef.current.reject({
                            type: emitResponse.responseTypes.ERROR,
                            message: errorMessage,
                        });
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
        return unsubscribe;
    }, [onPaymentSetup, fieldValidity]);

    // Render the form
    return (
        <div className="ap-nmi-payment-form-blocks">
            {error && <div className="woocommerce-error" role="alert">{error}</div>}

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
    name: settings.wc_gateway_id,
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
