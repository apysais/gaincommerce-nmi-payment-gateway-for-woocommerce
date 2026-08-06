/**
 * TEMPORARY DIAGNOSTIC — CollectJS postMessage tap.
 *
 * Loaded in <head> ahead of Collect.js, and only when the checkout URL carries
 * ?nmi_trace=1, so it costs nothing on a normal request.
 *
 * Why this exists: tokenization can stall with no error at all. CollectJS's
 * startPaymentRequest() posts {action:'SaveMultipartToken', token} into each field
 * iframe, and only fires config.callback once BOTH ccnumber and ccexp have posted
 * back {action:'FinalizeMultipartToken', response:'success'}. Three different
 * failures are indistinguishable from the outside — all you see is the timeout:
 *
 *   1. The iframe never replies at all.
 *   2. The iframe replies with response !== 'success' (MessageHandler drops it).
 *   3. The iframe ignores the request entirely, because it compares the incoming
 *      token against its own hidden input and silently returns on a mismatch.
 *
 * This tap logs every message in both directions with its action / elementId /
 * response / token, which tells the three apart directly.
 *
 * Remove this file, its wp_register_script/wp_enqueue_script block in
 * enqueue-scripts.php, and this comment once the stall is diagnosed.
 *
 * @package APNMIPaymentGateway
 */
( function ( window ) {
	'use strict';

	var COLLECTJS_ORIGIN = 'https://secure.nmi.com';

	// Route through NMITrace so these entries also reach the WooCommerce log under the
	// page's trace id, interleaved with the checkout entries and the server side.
	var trace = window.NMITrace || {
		log: function ( stage, detail ) { console.log( 'NMI ' + stage, detail || '' ); },
	};

	function shortToken( token ) {
		if ( typeof token !== 'string' || token === '' ) {
			return token;
		}
		return token.slice( 0, 8 ) + '…' + token.slice( -4 );
	}

	// Inbound: iframe -> page.
	window.addEventListener( 'message', function ( event ) {
		if ( event.origin !== COLLECTJS_ORIGIN ) {
			return;
		}
		var data = event.data || {};
		trace.log( 'collectjs:msg:in:' + ( data.action || 'unknown' ), {
			elementId: data.elementId || data.fieldId,
			response: data.response,
			token: shortToken( data.token ),
		} );
	}, false );

	// Outbound: page -> iframe. A window's own postMessage calls never surface to
	// message listeners, so the only way to see them is to patch the prototype.
	// Calls of the form iframe.contentWindow.postMessage(...) made from this realm
	// resolve postMessage from this realm's Window.prototype, so this catches them
	// even though the iframe itself is cross-origin.
	if ( window.Window && window.Window.prototype && window.Window.prototype.postMessage ) {
		var nativePostMessage = window.Window.prototype.postMessage;
		window.Window.prototype.postMessage = function ( message, targetOrigin, transfer ) {
			if ( message && typeof message === 'object' && message.action ) {
				trace.log( 'collectjs:msg:out:' + message.action, {
					token: shortToken( message.token ),
					targetOrigin: targetOrigin,
				} );
			}
			return nativePostMessage.call( this, message, targetOrigin, transfer );
		};
	}

	/**
	 * The token each field iframe currently holds, versus the token the page thinks
	 * is current. A divergence here is failure mode 3 above.
	 */
	window.__nmiTraceTokens = function () {
		var out = { pageToken: null, iframes: {} };

		if ( typeof window.CollectJS !== 'undefined' && window.CollectJS.iframes ) {
			Object.keys( window.CollectJS.iframes ).forEach( function ( key ) {
				var frame = window.CollectJS.iframes[ key ];
				out.iframes[ key ] = frame && frame.contentWindow ? 'live' : 'detached';
			} );
		}

		if ( typeof window.CollectJS !== 'undefined' && window.CollectJS.tokenPromise ) {
			window.CollectJS.tokenPromise.then( function ( result ) {
				trace.log( 'collectjs:page_token', { token: shortToken( result && result.token ) } );
			} );
		}

		trace.log( 'collectjs:iframe_state', out.iframes );
		return out;
	};

	trace.log( 'collectjs:msg_tap:installed' );
} )( window );
