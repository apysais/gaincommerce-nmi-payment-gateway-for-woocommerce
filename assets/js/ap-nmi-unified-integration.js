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
            
            // Add token to form
            var form = $('form.woocommerce-checkout');
            if (form.find('input[name="payment_token"]').length === 0) {
                form.append('<input type="hidden" name="payment_token" value="' + response.token + '">');
            } else {
                form.find('input[name="payment_token"]').val(response.token);
            }
            
            // Submit the form
            form.off('checkout_place_order').submit();
        } else {
            console.error('Token generation failed:', response);
            nmiShowError('Payment processing failed. Please check your card details and try again.');
            nmiEnableSubmitButton();
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
        
        // For legacy checkout
        if ($('form.woocommerce-checkout').length) {
            $('form.woocommerce-checkout').prepend(errorHtml);
        }
        
        // For blocks checkout
        if ($('div.wc-block-checkout').length) {
            $('.wc-block-components-checkout-form').prepend(errorHtml);
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
                
                // Check if CollectJS iframes are loaded
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
    }
});