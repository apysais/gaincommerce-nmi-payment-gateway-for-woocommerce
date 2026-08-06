/**
 * NMI Debug Logger
 * Captures and displays console logs in a browser-based debug panel
 * for debugging Apple Pay/Google Pay on mobile devices
 */

(function() {
    'use strict';

    // Initialize debug storage
    window.NMI_Debug = {
        logs: [],
        systemInfo: {},
        maxLogs: 500, // Limit to prevent memory issues

        /**
         * Add a log entry to the debug panel
         */
        addLog: function(type, message, data) {
            var timestamp = new Date();
            var logEntry = {
                timestamp: timestamp.toLocaleTimeString() + '.' + timestamp.getMilliseconds(),
                type: type, // log, warn, error, info
                message: String(message),
                data: data || null
            };

            this.logs.push(logEntry);

            // Limit log array size
            if (this.logs.length > this.maxLogs) {
                this.logs.shift();
            }

            // Update UI if panel exists
            this.updateUI();
        },

        /**
         * Get all logs
         */
        getLogs: function() {
            return this.logs;
        },

        /**
         * Clear all logs
         */
        clear: function() {
            this.logs = [];
            this.updateUI();
        },

        /**
         * Add system information
         */
        addSystemInfo: function(key, value) {
            this.systemInfo[key] = value;
            this.updateUI();
        },

        /**
         * Get system information
         */
        getSystemInfo: function() {
            return this.systemInfo;
        },

        /**
         * Update the debug panel UI
         */
        updateUI: function() {
            var logContainer = document.getElementById('nmi-debug-logs');
            var systemInfoContainer = document.getElementById('nmi-debug-system-info');

            // Update logs
            if (logContainer) {
                var logsHtml = '';
                var logs = this.logs.slice(-150); // Show last 150 logs

                logs.forEach(function(log) {
                    var logClass = 'nmi-debug-log-' + log.type;
                    var dataStr = log.data ? ' | Data: ' + JSON.stringify(log.data) : '';
                    logsHtml += '<div class="' + logClass + '">' +
                        '<span class="nmi-debug-timestamp">[' + log.timestamp + ']</span> ' +
                        '<span class="nmi-debug-type">' + log.type.toUpperCase() + '</span> ' +
                        '<span class="nmi-debug-message">' + escapeHtml(log.message) + dataStr + '</span>' +
                        '</div>';
                });

                if (logsHtml === '') {
                    logsHtml = '<div class="nmi-debug-no-logs">No NMI-related logs yet...</div>';
                }

                logContainer.innerHTML = logsHtml;
                // Auto-scroll to bottom
                logContainer.scrollTop = logContainer.scrollHeight;
            }

            // Update system info
            if (systemInfoContainer) {
                var infoHtml = '';
                for (var key in this.systemInfo) {
                    if (this.systemInfo.hasOwnProperty(key)) {
                        var value = this.systemInfo[key];
                        var valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
                        infoHtml += '<div class="nmi-debug-info-item">' +
                            '<strong>' + escapeHtml(key) + ':</strong> ' +
                            '<span>' + escapeHtml(valueStr) + '</span>' +
                            '</div>';
                    }
                }
                systemInfoContainer.innerHTML = infoHtml;
            }
        },

        /**
         * Copy all logs to clipboard
         */
        copyLogs: function() {
            var logsText = '=== NMI Debug Logs ===\n\n';
            
            // Add system info
            logsText += '--- System Info ---\n';
            for (var key in this.systemInfo) {
                if (this.systemInfo.hasOwnProperty(key)) {
                    logsText += key + ': ' + JSON.stringify(this.systemInfo[key]) + '\n';
                }
            }
            
            logsText += '\n--- Logs ---\n';
            this.logs.forEach(function(log) {
                logsText += '[' + log.timestamp + '] ' + log.type.toUpperCase() + ': ' + log.message;
                if (log.data) {
                    logsText += ' | Data: ' + JSON.stringify(log.data);
                }
                logsText += '\n';
            });

            // Copy to clipboard
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(logsText).then(function() {
                    alert('Debug logs copied to clipboard!');
                }).catch(function(err) {
                    console.error('Failed to copy logs:', err);
                    fallbackCopy(logsText);
                });
            } else {
                fallbackCopy(logsText);
            }
        }
    };

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        var map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    /**
     * Fallback copy method for older browsers
     */
    function fallbackCopy(text) {
        var textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.top = '0';
        textArea.style.left = '0';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            alert('Debug logs copied to clipboard!');
        } catch (err) {
            alert('Failed to copy logs. Please copy manually from the console.');
            console.log(text);
        }
        
        document.body.removeChild(textArea);
    }

    /**
     * Intercept console methods
     */
    var originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        info: console.info,
        debug: console.debug
    };

    // Capture every console call unfiltered — there's no way to open Safari's
    // real dev console on iPhone here, so this panel has to be the console.
    ['log', 'warn', 'error', 'info', 'debug'].forEach(function(type) {
        console[type] = function() {
            var args = Array.prototype.slice.call(arguments);
            var message = args.join(' ');

            window.NMI_Debug.addLog(type, message, args.length > 1 ? args : null);

            originalConsole[type].apply(console, arguments);
        };
    });

    // Capture uncaught JS errors
    window.addEventListener('error', function(event) {
        if (event.target && event.target !== window) {
            // Resource load failure (script/img/iframe/link), not a JS error.
            var target = event.target;
            var src = target.src || target.href || '(unknown)';
            window.NMI_Debug.addLog('error', 'Resource failed to load: ' + src, {
                tagName: target.tagName
            });
            return;
        }
        window.NMI_Debug.addLog('error', 'Uncaught error: ' + event.message, {
            source: event.filename,
            line: event.lineno,
            col: event.colno,
            stack: event.error && event.error.stack
        });
    }, true); // capture phase so resource errors (which don't bubble) are caught too

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', function(event) {
        var reason = event.reason;
        window.NMI_Debug.addLog('error', 'Unhandled promise rejection: ' + (reason && reason.message ? reason.message : String(reason)), {
            stack: reason && reason.stack
        });
    });

    /**
     * Collect environment information
     */
    function collectEnvironmentInfo() {
        // User Agent
        window.NMI_Debug.addSystemInfo('User Agent', navigator.userAgent);

        // Device Info
        var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        window.NMI_Debug.addSystemInfo('Is iOS', isIOS);
        window.NMI_Debug.addSystemInfo('Is Safari', isSafari);

        // iOS Version
        if (isIOS) {
            var match = navigator.userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/);
            if (match) {
                window.NMI_Debug.addSystemInfo('iOS Version', match[1] + '.' + match[2] + (match[3] ? '.' + match[3] : ''));
            }
        }

        // HTTPS Check
        window.NMI_Debug.addSystemInfo('Protocol', window.location.protocol);
        window.NMI_Debug.addSystemInfo('Is HTTPS', window.location.protocol === 'https:');
        window.NMI_Debug.addSystemInfo('isSecureContext', window.isSecureContext);

        // Apple Pay Availability
        if (window.ApplePaySession) {
            window.NMI_Debug.addSystemInfo('ApplePaySession Available', true);
            window.NMI_Debug.addSystemInfo('ApplePaySession Version', ApplePaySession.supportsVersion ? 
                (ApplePaySession.supportsVersion(3) ? '3+' : 'Legacy') : 'Unknown');
            
            // Check canMakePayments
            try {
                if (ApplePaySession.canMakePayments) {
                    var canMake = ApplePaySession.canMakePayments();
                    window.NMI_Debug.addSystemInfo('canMakePayments()', canMake);
                    console.log('NMI Debug: ApplePaySession.canMakePayments() =', canMake);
                }
            } catch (e) {
                window.NMI_Debug.addSystemInfo('canMakePayments() Error', e.message);
                console.error('NMI Debug: ApplePaySession.canMakePayments() error:', e);
            }
        } else {
            window.NMI_Debug.addSystemInfo('ApplePaySession Available', false);
            console.log('NMI Debug: ApplePaySession not available on this device/browser');
        }

        // Payment Request API
        window.NMI_Debug.addSystemInfo('PaymentRequest API', typeof window.PaymentRequest !== 'undefined');

        // Screen Info
        window.NMI_Debug.addSystemInfo('Screen Size', window.screen.width + 'x' + window.screen.height);
        window.NMI_Debug.addSystemInfo('Viewport Size', window.innerWidth + 'x' + window.innerHeight);
    }

    /**
     * Initialize debug logger
     */
    function init() {
        console.log('NMI Debug Logger: Initialized');
        collectEnvironmentInfo();

        // Set up event listeners when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupEventListeners);
        } else {
            setupEventListeners();
        }
    }

    /**
     * Set up event listeners for debug panel buttons
     */
    function setupEventListeners() {
        // Clear button
        var clearBtn = document.getElementById('nmi-debug-clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', function() {
                window.NMI_Debug.clear();
            });
        }

        // Copy button
        var copyBtn = document.getElementById('nmi-debug-copy');
        if (copyBtn) {
            copyBtn.addEventListener('click', function() {
                window.NMI_Debug.copyLogs();
            });
        }

        // Initial UI update
        window.NMI_Debug.updateUI();
    }

    // Initialize on script load
    init();

})();
