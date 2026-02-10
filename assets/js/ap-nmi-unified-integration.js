jQuery(document).ready(function($) {
    'use strict';
    
    // Check if we're in a blocks checkout - if so, don't run legacy scripts
    if ($('div.wc-block-checkout').length > 0) {
        console.log('Blocks checkout detected - skipping legacy CollectJS integration');
        return;
    }
    
    // Wait for CollectJS to load
    if (typeof CollectJS === 'undefined') {
        console.error('CollectJS not loaded');
        return;
    }

    console.log('Legacy checkout detected - initializing CollectJS integration');

    // Initialize validation tracking
    window.nmiFieldValidation = {
        ccnumber: false,
        ccexp: false,
        cvv: false
    };

    /**
     * Helper function to safely build 3DS data object
     * Only includes fields that are strings and not empty/null
     * Prevents REST API type validation errors
     */
    window.nmiSafe3DSData = function(threeDSResponse) {
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
        
        console.log('NMI Safe 3DS data prepared', {
            has_cavv: !!data.cavv,
            has_xid: !!data.xid,
            three_ds_version: data.three_ds_version || 'none'
        });
        
        return data;
    };

    // Function to query CollectJS iframes after they're created
    window.queryCollectJSIframes = function() {
        console.log('Querying CollectJS iframes...');
        
        var fieldContainers = {
            ccnumber: '#ap-nmi-card-number',
            ccexp: '#ap-nmi-expiry-date', 
            cvv: '#ap-nmi-card-cvv'
        };
        
        // Check each container for iframes
        Object.keys(fieldContainers).forEach(function(fieldName) {
            var container = $(fieldContainers[fieldName]);
            var iframe = container.find('iframe');
            
            if (iframe.length > 0) {
                console.log(fieldName + ' iframe found:', {
                    id: iframe.attr('id'),
                    src: iframe.attr('src'),
                    class: iframe.attr('class'),
                    width: iframe.attr('width'),
                    height: iframe.attr('height')
                });
                
                // Try to detect if iframe has content (limited by cross-origin)
                try {
                    var iframeDoc = iframe[0].contentDocument || iframe[0].contentWindow.document;
                    if (iframeDoc) {
                        console.log(fieldName + ' iframe document accessible');
                        // Note: This will likely fail due to cross-origin restrictions
                        var inputs = $(iframeDoc).find('input');
                        console.log(fieldName + ' inputs found:', inputs.length);
                    }
                } catch (e) {
                    console.log(fieldName + ' iframe content not accessible (cross-origin):', e.message);
                }
            } else {
                console.log(fieldName + ' iframe not found in container');
            }
        });
        
        // Query all CollectJS iframes globally
        var allIframes = $('.CollectJSInlineIframe');
        console.log('Total CollectJS iframes found:', allIframes.length);
        
        allIframes.each(function(index, iframe) {
            var $iframe = $(iframe);
            console.log('Iframe ' + index + ':', {
                id: $iframe.attr('id'),
                parent: $iframe.parent().attr('id'),
                src: $iframe.attr('src')
            });
        });
    };

    // Function to check if all iframes are loaded
    window.checkCollectJSIframesLoaded = function() {
        var expectedIframes = 3; // ccnumber, ccexp, cvv
        var loadedIframes = $('.CollectJSInlineIframe').length;
        
        console.log('Iframe load status:', loadedIframes + '/' + expectedIframes);
        
        return loadedIframes >= expectedIframes;
    };

    // Configure CollectJS with shared settings
    CollectJS.configure({
        paymentSelector: '#place_order, .wc-block-components-checkout-place-order-button',
        variant: "inline",
        invalidCss: {
            color: "#e74c3c",
            "border-color": "#e74c3c",
        },
        validCss: {
            color: "black",
            "border-color": "#2ecc71",
        },
        placeholderCss: {
            color: "darkgray",
            "background-color": "#ffffff",
        },
        focusCss: {
            color: "black",
            "border-color": "#4681f4",
        },
        fields: {
            ccnumber: {
                selector: "#ap-nmi-card-number",
                title: "Card Number",
                placeholder: "0000 0000 0000 0000",
            },
            ccexp: {
                selector: "#ap-nmi-expiry-date",
                title: "Card Expiration",
                placeholder: "MM/YY",
            },
            cvv: {
                display: "show",
                selector: "#ap-nmi-card-cvv",
                title: "CVV Code",
                placeholder: "123",
            }
        },
        timeoutDuration: 10000,
        timeoutCallback: function () {
            console.log("The tokenization didn't respond in the expected timeframe.");
            nmiShowError('Payment processing timeout. Please try again.');
            nmiEnableSubmitButton();
        },
        fieldsAvailableCallback: function () {
            console.log("Collect.js loaded the fields onto the form");
            // Reset validation when fields are available
            window.nmiFieldValidation = {
                ccnumber: false,
                ccexp: false,
                cvv: false
            };
            
            // Query and log iframe information after fields are ready
            /*setTimeout(function() {
                queryCollectJSIframes();
            }, 500);*/
        },
        callback: function(response) {
            let restricted_card = ap_nmi_params.gateway_config.restricted_card_types;
            
            if (restricted_card.includes(response.card.type)) {
                nmiShowError('This card type is not accepted.');
                nmiEnableSubmitButton();
                return;
            }

            nmiHandleTokenResponse(response);
        },
        validationCallback: function(field, status, message) {
            nmiHandleValidation(field, status, message);
        }
    });

    window.checkValidCardType = function(response) {
        let restricted_card = ap_nmi_params.gateway_config.restricted_card_types;
        if (restricted_card.includes(response.card.type)) {
            nmiShowError('This card type is not accepted.');
            return;
        }
    };

    // Shared token response handler
    window.nmiHandleTokenResponse = function(response) {
        if (response.token) {
            console.log('Token generated successfully:', response.token);
            
            // Check if 3DS is enabled
            if (typeof ap_nmi_threeds_config !== 'undefined' && ap_nmi_threeds_config.enable_3ds === 'yes') {
                console.log('3DS enabled, initiating authentication...');
                nmiHandle3DSAuthentication(response.token, false);
            } else {
                // No 3DS, proceed with normal flow
                nmiSubmitFormWithToken(response.token, {});
            }
        } else {
            console.error('Token generation failed:', response);
            nmiShowError('Payment processing failed. Please check your card details and try again.');
            nmiEnableSubmitButton();
        }
    };

    // Handle 3DS authentication flow
    window.nmiHandle3DSAuthentication = function(paymentToken, isUsingSavedCard) {
        if (typeof Gateway === 'undefined') {
            console.error('Gateway.js not loaded');
            nmiShowError('3D Secure authentication unavailable. Please try again.');
            nmiEnableSubmitButton();
            return;
        }

        // Show 3DS message
        nmiShow3DSMessage('Verifying your card...');
        
        // Disable place order button
        $('#place_order').prop('disabled', true);
        
        try {
            const gateway = Gateway.create(ap_nmi_threeds_config.public_key);
            const threeDS = gateway.get3DSecure();
            
            // Prepare 3DS options
            let options = {
                currency: ap_nmi_threeds_config.currency,
                amount: ap_nmi_threeds_config.amount
            };
            
            if (isUsingSavedCard) {
                // Using saved payment method from customer vault
                const customerVaultId = $('input[name="use_save_payment_method"]').val();
                if (customerVaultId) {
                    options.customerVaultId = customerVaultId;
                }
            } else {
                // Using new card with payment token
                options.paymentToken = paymentToken;
                
                // Add billing data
                if (ap_nmi_threeds_config.billing_data) {
                    Object.assign(options, ap_nmi_threeds_config.billing_data);
                }
                
                // Add device data to prevent timeouts (per latest NMI docs)
                Object.assign(options, nmiCollectDeviceData());
            }
            
            console.log('3DS options:', options);
            
            // Create 3DS interface
            const threeDSecureInterface = threeDS.createUI(options);
            
            // Mount to DOM
            threeDSecureInterface.start('#threeDSMountPoint');
            
            // Handle challenge event
            threeDSecureInterface.on('challenge', function(e) {
                console.log('3DS Challenge initiated');
                nmiShow3DSMessage('Please complete the verification...');
            });
            
            // Handle complete event
            threeDSecureInterface.on('complete', function(e) {
                console.log('3DS Authentication complete:', e);
                nmiHide3DSMessage();
                
                // Use helper to safely extract only valid 3DS fields
                const threeDSData = window.nmiSafe3DSData(e);
                
                // Submit form with token and 3DS data
                nmiSubmitFormWithToken(paymentToken, threeDSData);
            });
            
            // Handle failure event
            threeDSecureInterface.on('failure', function(e) {
                console.error('3DS Authentication failed:', e);
                nmiHide3DSMessage();
                
                const failureAction = ap_nmi_threeds_config['3ds_failure_action'] || 'decline';
                
                if (failureAction === 'decline') {
                    nmiShowError('Card verification failed. Please try a different payment method.');
                    nmiEnableSubmitButton();
                } else if (failureAction === 'continue_without_3ds') {
                    console.log('Continuing without 3DS as per settings');
                    nmiSubmitFormWithToken(paymentToken, {});
                } else if (failureAction === 'continue_with_warning') {
                    console.log('Continuing with warning as per settings');
                    nmiSubmitFormWithToken(paymentToken, { threeds_warning: 'authentication_failed' });
                }
            });
            
            // Handle gateway errors
            gateway.on('error', function(e) {
                console.error('Gateway.js error:', e);
                nmiHide3DSMessage();
                
                // Check if 3DS is inactive on merchant account
                if (e.message && e.message.includes('3DSecure is inactive')) {
                    console.error('NMI 3DS Error: 3-D Secure is not enabled on your NMI merchant account');
                    nmiShowError('Secure payment verification is currently unavailable. Please contact the store or try a different payment method.');
                } else {
                    nmiShowError('Payment verification error. Please try again.');
                }
                
                nmiEnableSubmitButton();
            });
            
        } catch (error) {
            console.error('3DS initialization error:', error);
            nmiHide3DSMessage();
            nmiShowError('Unable to initialize card verification. Please try again.');
            nmiEnableSubmitButton();
        }
    };

    // Submit form with token and optional 3DS data
    window.nmiSubmitFormWithToken = function(token, threeDSData) {
        var form = $('form.woocommerce-checkout');
        
        // Add token to form
        if (form.find('input[name="payment_token"]').length === 0) {
            form.append('<input type="hidden" name="payment_token" value="' + token + '">');
        } else {
            form.find('input[name="payment_token"]').val(token);
        }
        
        // Add 3DS data to form if present
        if (threeDSData && Object.keys(threeDSData).length > 0) {
            Object.keys(threeDSData).forEach(function(key) {
                const fieldName = 'threeds_' + key;
                const value = threeDSData[key] || '';
                
                if (form.find('input[name="' + fieldName + '"]').length === 0) {
                    form.append('<input type="hidden" name="' + fieldName + '" value="' + value + '">');
                } else {
                    form.find('input[name="' + fieldName + '"]').val(value);
                }
            });
        }
        
        // Add save payment method checkbox value
        var savePaymentCheckbox = $('#save_payment_method');
        var savePayment = savePaymentCheckbox.length > 0 && savePaymentCheckbox.is(':checked') ? '1' : '0';
        console.log('Save payment checkbox found:', savePaymentCheckbox.length > 0);
        console.log('Save payment checkbox checked:', savePaymentCheckbox.is(':checked'));
        console.log('Save payment value:', savePayment);
        
        if (form.find('input[name="save_payment_method"]').length === 0) {
            form.append('<input type="hidden" name="save_payment_method" value="' + savePayment + '">');
        } else {
            form.find('input[name="save_payment_method"]').val(savePayment);
        }
        
        // Submit the form
        form.off('checkout_place_order').submit();
    };

    // Show 3DS message
    window.nmiShow3DSMessage = function(message) {
        var messageDiv = $('#threeDSMessage');
        if (messageDiv.length) {
            messageDiv.text(message).show();
        }
    };

    // Hide 3DS message
    window.nmiHide3DSMessage = function() {
        var messageDiv = $('#threeDSMessage');
        if (messageDiv.length) {
            messageDiv.hide();
        }
    };
    
    // Shared validation handler with visual feedback
    window.nmiHandleValidation = function(field, status, message) {
        console.log('Field validation:', field.field || field, status, message);
        
        var fieldName = field.field || field;
        var fieldElement = $(field.selector);
        var parent = fieldElement.closest('.form-row, .nmi-form-row');
        
        // Update validation tracking
        if (window.nmiFieldValidation && fieldName) {
            window.nmiFieldValidation[fieldName] = status;
        }
        
        // Visual feedback
        parent.removeClass('nmi-validated nmi-invalid woocommerce-invalid woocommerce-invalid-required-field');
        parent.find('.nmi-error').remove();
        
        if (status) {
            parent.addClass('nmi-validated');
        } else {
            parent.addClass('nmi-invalid woocommerce-invalid woocommerce-invalid-required-field');
            if (message) {
                parent.append('<span class="nmi-error" style="color: #e74c3c; font-size: 12px; display: block; margin-top: 5px;">' + message + '</span>');
            }
        }
    };
    
    // Helper function to enable submit button
    window.nmiEnableSubmitButton = function() {
        $('#place_order').prop('disabled', false).text('Place order');
        $('.wc-block-components-checkout-place-order-button').prop('disabled', false);
    };
    
    // Shared error display function
    window.nmiShowError = function(message) {
        // Remove existing errors
        $('.woocommerce-error, .nmi-error-message').remove();
        
        var errorHtml = '<div class="woocommerce-error" role="alert">' + message + '</div>';
        var errorDisplayed = false;
        
        // For legacy checkout
        if ($('form.woocommerce-checkout').length) {
            $('form.woocommerce-checkout').prepend(errorHtml);
            errorDisplayed = true;
        }
        
        // For blocks checkout
        if ($('div.wc-block-checkout').length) {
            $('.wc-block-components-checkout-form').prepend(errorHtml);
            errorDisplayed = true;
        }
        
        // Fallback: if error wasn't displayed via DOM, show alert
        if (!errorDisplayed) {
            console.error('NMI: Unable to display error in checkout form, using alert');
            alert('Payment Error: ' + message);
        }
        
        // Scroll to error with safety checks
        var errorElement = $('.woocommerce-error').first();
        if (errorElement.length && errorElement.offset()) {
            $('html, body').animate({
                scrollTop: errorElement.offset().top - 100
            }, 500);
        }
    };
    
    // Legacy checkout integration
    if ($('form.woocommerce-checkout').length && !$('div.wc-block-checkout').length) {
        console.log('Legacy checkout detected - setting up validation');
        
        // Override WooCommerce form submission for our gateway
        $('form.woocommerce-checkout').on('checkout_place_order', function(e) {
            // Only intercept if our gateway is selected
            if ($('input[name="payment_method"]:checked').val() === ap_nmi_params.ap_nmi_gateway_id) {
                e.preventDefault();
                
                console.log('AP NMI payment method selected, validating fields...');
                
                // Clear previous errors
                $('.woocommerce-error, .nmi-error-message').remove();
                
                // Check if using saved payment method
                var useSavedCard = $('input[name="use_save_payment_method"]:checked').val() === '1';
                
                if (useSavedCard) {
                    console.log('Using saved payment method');
                    
                    // Check if 3DS is enabled for saved cards
                    if (typeof ap_nmi_threeds_config !== 'undefined' && ap_nmi_threeds_config.enable_3ds === 'yes') {
                        console.log('3DS enabled for saved card, initiating authentication...');
                        
                        // Disable submit button
                        $('#place_order').prop('disabled', true).text('Processing...');
                        
                        // Get customer vault ID from hidden field or data attribute
                        var customerVaultId = $('input[name="customer_vault_id"]').val();
                        if (!customerVaultId) {
                            // Try to get from saved card display element
                            customerVaultId = $('.ap-nmi-saved-card-info').data('vault-id');
                        }
                        
                        if (customerVaultId) {
                            nmiHandle3DSAuthenticationForVault(customerVaultId);
                        } else {
                            console.error('Customer vault ID not found');
                            nmiShowError('Unable to process saved payment method. Please use a new card.');
                            nmiEnableSubmitButton();
                        }
                    } else {
                        // No 3DS for saved cards, submit directly
                        $(this).off('checkout_place_order').submit();
                    }
                    
                    return false;
                }
                
                // Using new card - check if CollectJS iframes are loaded
                var iframes = $('.CollectJSInlineIframe');
                if (iframes.length < 3) {
                    nmiShowError('Payment form is not ready. Please refresh the page and try again.');
                    return false;
                }
                
                // Validate all required fields
                var validationErrors = [];
                
                if (window.nmiFieldValidation.ccnumber !== true) {
                    validationErrors.push('<p>Please enter a valid card number.</p>');
                    $('#ap-nmi-card-number').closest('.form-row').addClass('woocommerce-invalid woocommerce-invalid-required-field');
                }
                
                if (window.nmiFieldValidation.ccexp !== true) {
                    validationErrors.push('<p>Please enter a valid expiry date.</p>');
                    $('#ap-nmi-expiry-date').closest('.form-row').addClass('woocommerce-invalid woocommerce-invalid-required-field');
                }
                
                // if (window.nmiFieldValidation.cvv !== true) {
                //     validationErrors.push('<p>Please enter a valid CVV code.</p>');
                //     $('#ap-nmi-card-cvv').closest('.form-row').addClass('woocommerce-invalid woocommerce-invalid-required-field');
                // }
                
                if (validationErrors.length > 0) {
                    nmiShowError(validationErrors.join(' '));
                    return false;
                }
                
                // Disable submit button to prevent multiple submissions
                $('#place_order').prop('disabled', true).text('Processing...');
                
                console.log('All fields validated, generating token...');
                
                // All fields are valid, proceed with tokenization
                try {
                    CollectJS.startPaymentRequest();
                } catch (error) {
                    console.error('Error starting payment request:', error);
                    nmiShowError('Payment processing error. Please try again.');
                    nmiEnableSubmitButton();
                }
                
                return false; // Prevent default form submission
            }
            
            return true; // Allow other payment methods to proceed normally
        });
        
        // Handle 3DS for saved vault cards
        window.nmiHandle3DSAuthenticationForVault = function(customerVaultId) {
            if (typeof Gateway === 'undefined') {
                console.error('Gateway.js not loaded');
                nmiShowError('3D Secure authentication unavailable. Please try again.');
                nmiEnableSubmitButton();
                return;
            }

            // Show 3DS message
            nmiShow3DSMessage('Verifying your saved card...');
            
            try {
                const gateway = Gateway.create(ap_nmi_threeds_config.public_key);
                const threeDS = gateway.get3DSecure();
                
                // Prepare 3DS options for customer vault
                const options = {
                    customerVaultId: customerVaultId,
                    currency: ap_nmi_threeds_config.currency,
                    amount: ap_nmi_threeds_config.amount
                };
                
                // Add device data to prevent timeouts (per latest NMI docs)
                Object.assign(options, nmiCollectDeviceData());
                
                console.log('3DS options for vault:', options);
                
                // Create 3DS interface
                const threeDSecureInterface = threeDS.createUI(options);
                
                // Mount to DOM
                threeDSecureInterface.start('#threeDSMountPoint');
                
                // Handle challenge event
                threeDSecureInterface.on('challenge', function(e) {
                    console.log('3DS Challenge initiated for saved card');
                    nmiShow3DSMessage('Please complete the verification...');
                });
                
                // Handle complete event
                threeDSecureInterface.on('complete', function(e) {
                    console.log('3DS Authentication complete for saved card:', e);
                    nmiHide3DSMessage();
                    
                    // Use helper to safely extract only valid 3DS fields
                    const threeDSData = window.nmiSafe3DSData(e);
                    
                    // Submit form with 3DS data (no token needed for vault)
                    nmiSubmitFormWithVaultAndThreeDS(threeDSData);
                });
                
                // Handle failure event
                threeDSecureInterface.on('failure', function(e) {
                    console.error('3DS Authentication failed for saved card:', e);
                    nmiHide3DSMessage();
                    
                    const failureAction = ap_nmi_threeds_config['3ds_failure_action'] || 'decline';
                    
                    if (failureAction === 'decline') {
                        nmiShowError('Card verification failed. Please try a different payment method.');
                        nmiEnableSubmitButton();
                    } else if (failureAction === 'continue_without_3ds') {
                        console.log('Continuing without 3DS as per settings');
                        $('form.woocommerce-checkout').off('checkout_place_order').submit();
                    } else if (failureAction === 'continue_with_warning') {
                        console.log('Continuing with warning as per settings');
                        nmiSubmitFormWithVaultAndThreeDS({ threeds_warning: 'authentication_failed' });
                    }
                });
                
                // Handle gateway errors
                gateway.on('error', function(e) {
                    console.error('Gateway.js error for saved card:', e);
                    nmiHide3DSMessage();
                    
                    // Check if 3DS is inactive on merchant account
                    if (e.message && e.message.includes('3DSecure is inactive')) {
                        console.error('NMI 3DS Error: 3-D Secure is not enabled on your NMI merchant account');
                        nmiShowError('Secure payment verification is currently unavailable. Please contact the store or try a different payment method.');
                    } else {
                        nmiShowError('Payment verification error. Please try again.');
                    }
                    
                    nmiEnableSubmitButton();
                });
                
            } catch (error) {
                console.error('3DS initialization error for saved card:', error);
                nmiHide3DSMessage();
                nmiShowError('Unable to initialize card verification. Please try again.');
                nmiEnableSubmitButton();
            }
        };
        
        // Submit form with vault and 3DS data
        window.nmiSubmitFormWithVaultAndThreeDS = function(threeDSData) {
            var form = $('form.woocommerce-checkout');
            
            // Add 3DS data to form if present
            if (threeDSData && Object.keys(threeDSData).length > 0) {
                Object.keys(threeDSData).forEach(function(key) {
                    const fieldName = 'threeds_' + key;
                    const value = threeDSData[key] || '';
                    
                    if (form.find('input[name="' + fieldName + '"]').length === 0) {
                        form.append('<input type="hidden" name="' + fieldName + '" value="' + value + '">');
                    } else {
                        form.find('input[name="' + fieldName + '"]').val(value);
                    }
                });
            }
            

        /**
         * Collect device data for 3DS authentication
         * Per latest NMI docs, helps prevent timeouts
         * 
         * @returns {Object} Device data fields
         */
        function nmiCollectDeviceData() {
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
            // Submit the form
            form.off('checkout_place_order').submit();
        };
    }
});