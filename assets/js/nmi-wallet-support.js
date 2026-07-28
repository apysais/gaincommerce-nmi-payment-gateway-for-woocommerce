/**
 * Digital wallet precondition checks, shared by the legacy and blocks checkouts.
 *
 * Apple Pay and Google Pay each have hard environment requirements that CollectJS
 * does not check for us. If we hand CollectJS a wallet field whose requirements
 * aren't met it fails loudly and unrecoverably:
 *
 *   - Google Pay's isReadyToPay() throws
 *     "DEVELOPER_ERROR ... Google Pay APIs should be called in secure context!"
 *   - ApplePayFieldFactory logs "Failed to create an Apple Pay button. You must
 *     allow <host> to use Apple Pay." as soon as its selector matches an element.
 *
 * Neither is recoverable from the page, and neither has anything to do with card
 * payments. So we check the preconditions *before* building the wallet config and
 * skip the wallet if they aren't met, logging at console.info — an unsupported
 * browser or a non-HTTPS dev origin is expected, not an error, and it must never
 * read as a checkout failure.
 *
 * @package APNMIPaymentGateway
 */
( function ( window ) {
	'use strict';

	var loggedInsecure = false;

	function info( message ) {
		console.info( 'NMI wallets: ' + message );
	}

	/**
	 * Both wallets require a secure context.
	 *
	 * Note that a cross-origin iframe inherits its secure-context status from the
	 * whole ancestor chain, so the HTTPS CollectJS iframe is *also* insecure when
	 * the top-level page is HTTP. Only localhost/127.0.0.1 are exempt from the
	 * HTTPS requirement — a custom dev hostname such as example.local is not.
	 *
	 * @return {boolean} True when wallets may be initialised.
	 */
	function isSecureContext() {
		if ( window.isSecureContext ) {
			return true;
		}

		if ( ! loggedInsecure ) {
			loggedInsecure = true;
			info(
				'skipping Apple Pay and Google Pay — ' + window.location.protocol +
				'//' + window.location.host + ' is not a secure context. Both wallets ' +
				'require HTTPS (localhost is the only exception). Card payments are unaffected.'
			);
		}

		return false;
	}

	/**
	 * Token types CollectJS uses for wallet tokenizations. Everything else
	 * ('inline', 'lightbox') is a card or ACH tokenization.
	 */
	var WALLET_TOKEN_TYPES = [ 'applePay', 'googlePay' ];

	window.NMIWalletSupport = {
		isSecureContext: isSecureContext,

		/**
		 * Is this CollectJS token response a wallet payment?
		 *
		 * Test `tokenType`, never `response.wallet`. CollectJS's TokenResponse always
		 * assigns a `wallet` property, and for a card tokenization it is
		 * TokenResponse.createEmptyWalletData() — a fully-populated object whose leaves
		 * are all null. It is therefore ALWAYS truthy, so `if (response.wallet)` treats
		 * every card payment as a wallet payment. `tokenType` is the only field that
		 * actually distinguishes them.
		 *
		 * @param {Object} response CollectJS token response.
		 * @return {boolean} True for an Apple Pay / Google Pay tokenization.
		 */
		isWalletResponse: function ( response ) {
			return !! response && WALLET_TOKEN_TYPES.indexOf( response.tokenType ) !== -1;
		},

		/**
		 * @param {Object} response CollectJS token response.
		 * @return {string} 'applePay' | 'googlePay' | 'unknown'
		 */
		walletTypeOf: function ( response ) {
			return this.isWalletResponse( response ) ? response.tokenType : 'unknown';
		},

		/**
		 * @param {boolean} enabled  Apple Pay enabled in gateway settings.
		 * @param {string}  selector Container the button would mount into.
		 * @return {boolean} True when the Apple Pay field should be configured.
		 */
		canUseApplePay: function ( enabled, selector ) {
			// Silent: wallets are off by default, so this is the common case and
			// logging it would put noise in every merchant's console.
			if ( ! enabled ) {
				return false;
			}

			if ( ! document.querySelector( selector ) ) {
				info( 'Apple Pay container ' + selector + ' is not in the DOM — skipping.' );
				return false;
			}

			if ( ! isSecureContext() ) {
				return false;
			}

			if ( typeof window.ApplePaySession === 'undefined' ) {
				info( 'Apple Pay is not available in this browser — skipping.' );
				return false;
			}

			if ( typeof window.ApplePaySession.canMakePayments !== 'function' ) {
				info( 'ApplePaySession.canMakePayments is not callable — skipping.' );
				return false;
			}

			try {
				if ( ! window.ApplePaySession.canMakePayments() ) {
					info( 'ApplePaySession.canMakePayments() returned false — skipping.' );
					return false;
				}
			} catch ( e ) {
				info( 'ApplePaySession.canMakePayments() threw (' + e.message + ') — skipping.' );
				return false;
			}

			return true;
		},

		/**
		 * @param {boolean} enabled  Google Pay enabled in gateway settings.
		 * @param {string}  selector Container the button would mount into.
		 * @return {boolean} True when the Google Pay field should be configured.
		 */
		canUseGooglePay: function ( enabled, selector ) {
			// Silent for the same reason as canUseApplePay above.
			if ( ! enabled ) {
				return false;
			}

			if ( ! document.querySelector( selector ) ) {
				info( 'Google Pay container ' + selector + ' is not in the DOM — skipping.' );
				return false;
			}

			// CollectJS decides Google Pay availability itself beyond this point; the
			// secure-context check is the one requirement it does not guard.
			return isSecureContext();
		},
	};
} )( window );
