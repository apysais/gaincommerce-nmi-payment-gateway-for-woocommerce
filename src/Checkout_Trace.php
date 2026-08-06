<?php
/**
 * Correlated checkout tracing.
 *
 * The checkout flow spans two places that normally cannot be read together: the
 * browser (CollectJS field mounting, tokenization, wallet dispatch, 3DS) and PHP
 * (process_payment, the NMI API call). A failure in one is invisible from the other,
 * which is what made the tokenization timeout so hard to pin down.
 *
 * This class stitches them into one timeline. The browser generates a trace id per
 * page load, logs locally to the console, and mirrors every entry into the
 * WooCommerce log. The same trace id rides along with the order submission, so
 * server-side entries carry it too. Filtering WooCommerce > Status > Logs by one
 * trace id then gives the whole checkout attempt in order.
 *
 * Gated on the gateway's "logging" setting — see Logger::is_logging_enabled().
 *
 * @package APNMIPaymentGateway
 */

namespace APNMIPaymentGateway;

class Checkout_Trace
{
    /**
     * AJAX action name, also used as the nonce action.
     */
    public const AJAX_ACTION = 'ap_nmi_checkout_trace';

    /**
     * Field name carrying the trace id on order submission.
     */
    public const FIELD = 'ap_nmi_trace_id';

    /**
     * Hard caps so a broken loop in the browser cannot flood the log or the request.
     */
    private const MAX_ENTRIES_PER_REQUEST = 100;
    private const MAX_STAGE_LENGTH        = 120;
    private const MAX_DETAIL_LENGTH       = 2000;

    /**
     * Register hooks.
     *
     * @return void
     */
    public static function init(): void
    {
        add_action('wp_ajax_' . self::AJAX_ACTION, [self::class, 'handle_ajax']);
        add_action('wp_ajax_nopriv_' . self::AJAX_ACTION, [self::class, 'handle_ajax']);
    }

    /**
     * Is tracing switched on? Mirrors the gateway's logging setting so there is a
     * single switch for all NMI logging.
     *
     * @return bool
     */
    public static function is_enabled(): bool
    {
        $settings = get_option(AP_NMI_WC_GATEWAY_SETTINGS_ID, []);
        return isset($settings['logging']) && 'yes' === $settings['logging'];
    }

    /**
     * Receive a batch of browser trace entries and mirror them into the WC log.
     *
     * @return void
     */
    public static function handle_ajax(): void
    {
        if (!self::is_enabled()) {
            wp_send_json_error(['message' => 'Tracing disabled'], 403);
        }

        $nonce = isset($_POST['nonce']) ? sanitize_text_field(wp_unslash($_POST['nonce'])) : '';
        if (!wp_verify_nonce($nonce, 'ap_nmi_nonce')) {
            wp_send_json_error(['message' => 'Invalid nonce'], 403);
        }

        $trace_id = isset($_POST['trace_id'])
            ? self::sanitize_trace_id(wp_unslash($_POST['trace_id']))
            : '';

        $raw = isset($_POST['entries']) ? wp_unslash($_POST['entries']) : '';
        $entries = is_string($raw) ? json_decode($raw, true) : $raw;

        if (!is_array($entries)) {
            wp_send_json_error(['message' => 'Malformed entries'], 400);
        }

        $entries = array_slice($entries, 0, self::MAX_ENTRIES_PER_REQUEST);
        $logger  = Logger::get_instance();

        foreach ($entries as $entry) {
            if (!is_array($entry)) {
                continue;
            }

            $level  = self::sanitize_level($entry['level'] ?? 'info');
            $stage  = substr(sanitize_text_field((string) ($entry['stage'] ?? 'unknown')), 0, self::MAX_STAGE_LENGTH);
            $at     = isset($entry['at']) ? (int) $entry['at'] : 0;
            $detail = self::stringify_detail($entry['detail'] ?? null);

            $message = sprintf(
                '[browser] [%s] +%dms %s',
                $trace_id !== '' ? $trace_id : 'no-trace-id',
                $at,
                $stage
            );

            if ($detail !== '') {
                $message .= ' | ' . $detail;
            }

            $logger->{$level}($message);
        }

        wp_send_json_success(['received' => count($entries)]);
    }

    /**
     * Log a server-side entry under the browser's trace id, so both sides interleave
     * in one filterable timeline.
     *
     * @param string $stage   Short stage label, e.g. 'process_payment:start'.
     * @param array  $context Extra detail. Sensitive keys are stripped by Logger.
     * @param string $level   Logger level.
     * @return void
     */
    public static function server(string $stage, array $context = [], string $level = 'info'): void
    {
        if (!self::is_enabled()) {
            return;
        }

        $trace_id = self::current_trace_id();

        $message = sprintf(
            '[server] [%s] %s',
            $trace_id !== '' ? $trace_id : 'no-trace-id',
            $stage
        );

        Logger::get_instance()->{self::sanitize_level($level)}($message, $context);
    }

    /**
     * Read the trace id off the current request.
     *
     * Legacy checkout posts it as a top-level field; the blocks checkout nests it
     * under payment_method_data, the same way payment_token arrives.
     *
     * @return string
     */
    public static function current_trace_id(): string
    {
        // phpcs:disable WordPress.Security.NonceVerification.Missing -- read-only, for log correlation only.
        if (isset($_POST['payment_method_data'][self::FIELD])) {
            return self::sanitize_trace_id(wp_unslash($_POST['payment_method_data'][self::FIELD]));
        }

        if (isset($_POST[self::FIELD])) {
            return self::sanitize_trace_id(wp_unslash($_POST[self::FIELD]));
        }
        // phpcs:enable

        return '';
    }

    /**
     * Trace ids are generated by the browser, so constrain them tightly.
     *
     * @param mixed $value Raw value.
     * @return string
     */
    private static function sanitize_trace_id($value): string
    {
        if (!is_string($value)) {
            return '';
        }

        return substr(preg_replace('/[^A-Za-z0-9\-]/', '', $value), 0, 40);
    }

    /**
     * @param mixed $level Raw level.
     * @return string One of the Logger level methods.
     */
    private static function sanitize_level($level): string
    {
        $allowed = ['debug', 'info', 'notice', 'warning', 'error'];
        $level   = is_string($level) ? strtolower($level) : 'info';

        return in_array($level, $allowed, true) ? $level : 'info';
    }

    /**
     * Flatten an entry's detail payload to a single log-safe string.
     *
     * @param mixed $detail Raw detail.
     * @return string
     */
    private static function stringify_detail($detail): string
    {
        if ($detail === null || $detail === '') {
            return '';
        }

        if (is_scalar($detail)) {
            return substr(sanitize_text_field((string) $detail), 0, self::MAX_DETAIL_LENGTH);
        }

        $encoded = wp_json_encode(self::scrub($detail));

        return is_string($encoded) ? substr($encoded, 0, self::MAX_DETAIL_LENGTH) : '';
    }

    /**
     * Defence in depth: the browser side is written not to send card data, but never
     * let anything that looks like a PAN or CVV reach the log file.
     *
     * @param mixed $data Arbitrary nested data.
     * @return mixed
     */
    private static function scrub($data)
    {
        $blocked = ['ccnumber', 'ccexp', 'cvv', 'checkaccount', 'checkaba', 'checkname', 'cardnumber', 'number'];

        if (!is_array($data)) {
            return is_scalar($data) ? $data : null;
        }

        $out = [];
        foreach ($data as $key => $value) {
            if (is_string($key) && in_array(strtolower($key), $blocked, true)) {
                $out[$key] = '***';
                continue;
            }
            $out[$key] = is_array($value) ? self::scrub($value) : (is_scalar($value) || $value === null ? $value : null);
        }

        return $out;
    }
}
