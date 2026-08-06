/**
 * Correlated checkout tracing — browser side.
 *
 * Logs to the console AND mirrors every entry into the WooCommerce log, tagged with
 * a trace id generated once per page load. The same trace id is attached to the order
 * submission, so filtering WooCommerce > Status > Logs (source:
 * gaincommerce-nmi-gateway) by that id gives the browser and server halves of one
 * checkout attempt as a single ordered timeline.
 *
 * Usage:
 *   NMITrace.log('collectjs:configure', { fields: [...] });
 *   NMITrace.error('tokenize:timeout', { ... });   // flushed immediately
 *   NMITrace.dump();                               // print the buffer as a table
 *   NMITrace.id();                                 // current trace id
 *
 * Never pass card data. Detail objects are JSON-encoded into the log file, and while
 * the PHP side scrubs obvious PAN/CVV keys as a backstop, the rule here is simply not
 * to collect it.
 *
 * @package APNMIPaymentGateway
 */
( function ( window, document ) {
	'use strict';

	var config = window.apNmiTraceConfig || {};
	var enabled = !! config.enabled;

	var started = ( window.performance && window.performance.now )
		? window.performance.now()
		: 0;

	var buffer = [];
	var flushTimer = null;
	var sentCount = 0;

	// Backstop against a runaway loop filling the log file.
	var MAX_ENTRIES_PER_PAGE = 500;
	var FLUSH_DEBOUNCE_MS = 1000;
	var MAX_BATCH = 100;

	/**
	 * Milliseconds since this script loaded. Relative time is what matters when
	 * reading a checkout timeline.
	 *
	 * @return {number} Elapsed ms.
	 */
	function elapsed() {
		var now = ( window.performance && window.performance.now )
			? window.performance.now()
			: 0;
		return Math.round( now - started );
	}

	/**
	 * Per-page-load trace id. Short enough to type into a log filter.
	 *
	 * @return {string} Trace id.
	 */
	function makeTraceId() {
		var random = Math.random().toString( 36 ).slice( 2, 8 );
		var stamp = ( elapsed() + 100000 ).toString( 36 );
		return 'nmi-' + stamp + '-' + random;
	}

	var traceId = makeTraceId();

	/**
	 * Post the buffered entries to the WC log. Fire-and-forget: tracing must never
	 * interfere with checkout, so failures are swallowed.
	 *
	 * @param {boolean} useBeacon Use sendBeacon (for page unload).
	 * @return {void}
	 */
	function flush( useBeacon ) {
		if ( flushTimer ) {
			window.clearTimeout( flushTimer );
			flushTimer = null;
		}

		if ( ! enabled || ! buffer.length || ! config.ajaxUrl || ! config.nonce ) {
			return;
		}

		var batch = buffer.splice( 0, MAX_BATCH );

		var body = new window.FormData();
		body.append( 'action', config.action );
		body.append( 'nonce', config.nonce );
		body.append( 'trace_id', traceId );
		body.append( 'entries', JSON.stringify( batch ) );

		try {
			if ( useBeacon && window.navigator && window.navigator.sendBeacon ) {
				window.navigator.sendBeacon( config.ajaxUrl, body );
				return;
			}

			window.fetch( config.ajaxUrl, {
				method: 'POST',
				body: body,
				credentials: 'same-origin',
				keepalive: true,
			} ).catch( function () { /* tracing must never break checkout */ } );
		} catch ( e ) {
			// Same: swallow.
		}
	}

	function scheduleFlush() {
		if ( flushTimer ) {
			return;
		}
		flushTimer = window.setTimeout( function () {
			flush( false );
		}, FLUSH_DEBOUNCE_MS );
	}

	/**
	 * @param {string} level  debug|info|notice|warning|error
	 * @param {string} stage  Short label, e.g. 'tokenize:start'.
	 * @param {*}      detail Optional structured detail.
	 * @return {void}
	 */
	function record( level, stage, detail ) {
		var at = elapsed();
		var prefix = 'NMI ' + traceId + ' +' + at + 'ms ' + stage;

		// Console first, so a failed/disabled server flush never costs local visibility.
		if ( level === 'error' ) {
			console.error( prefix, detail !== undefined ? detail : '' );
		} else if ( level === 'warning' ) {
			console.warn( prefix, detail !== undefined ? detail : '' );
		} else {
			console.log( prefix, detail !== undefined ? detail : '' );
		}

		if ( ! enabled || sentCount >= MAX_ENTRIES_PER_PAGE ) {
			return;
		}

		sentCount++;
		buffer.push( { level: level, stage: stage, at: at, detail: detail === undefined ? null : detail } );

		// Errors go out immediately — a hung checkout may never reach a debounce.
		if ( level === 'error' || level === 'warning' ) {
			flush( false );
		} else {
			scheduleFlush();
		}
	}

	window.NMITrace = {
		id: function () {
			return traceId;
		},

		isEnabled: function () {
			return enabled;
		},

		debug: function ( stage, detail ) { record( 'debug', stage, detail ); },
		log: function ( stage, detail ) { record( 'info', stage, detail ); },
		warn: function ( stage, detail ) { record( 'warning', stage, detail ); },
		error: function ( stage, detail ) { record( 'error', stage, detail ); },

		/**
		 * Print everything recorded this page load. Reads the console buffer only —
		 * entries already flushed to the server are not retained here.
		 *
		 * @return {void}
		 */
		dump: function () {
			console.log( 'NMI trace id:', traceId, '(' + sentCount + ' entries recorded, ' + buffer.length + ' pending flush)' );
			if ( console.table ) {
				console.table( buffer );
			} else {
				console.log( buffer );
			}
		},

		/**
		 * Send anything buffered right now.
		 *
		 * @return {void}
		 */
		flush: function () { flush( false ); },
	};

	// Don't lose the tail of a trace when the page navigates away — which is exactly
	// what happens on a successful order.
	window.addEventListener( 'pagehide', function () { flush( true ); } );
	document.addEventListener( 'visibilitychange', function () {
		if ( document.visibilityState === 'hidden' ) {
			flush( true );
		}
	} );

	if ( enabled ) {
		console.log(
			'NMI checkout tracing ON. Trace id: ' + traceId +
			'\nMirrored to WooCommerce > Status > Logs (source: gaincommerce-nmi-gateway).' +
			'\nCall NMITrace.dump() for the local buffer.'
		);
	}
} )( window, document );
