<?php
/**
 * This will log and interpret the return API AVS/CVV code.
 */
namespace APNMIPaymentGateway;

/**
 * Convert the code of AVS and CVV and add to order note
 * 
 */
class Parse_Response_Codes
{
    public static function avs_response($avs)
    {
        $avs_codes = [
            'X' => 'Exact match, 9-character numeric ZIP',
            'Y' => 'Exact match, 5-character numeric ZIP',
            'D' => 'Exact match, 5-character numeric ZIP',
            'M' => 'Exact match, 5-character numeric ZIP',
            '2' => 'Exact match, 5-character numeric ZIP, customer name',
            '6' => 'Exact match, 5-character numeric ZIP, customer name',
            'A' => 'Address match only',
            'B' => 'Address match only',
            '3' => 'Address, customer name match only',
            '7' => 'Address, customer name match only',
            'W' => '9-character numeric ZIP match only',
            'Z' => '5-character ZIP match only',
            'P' => '5-character ZIP match only',
            'L' => '5-character ZIP match only',
            '1' => '5-character ZIP, customer name match only',
            '5' => '5-character ZIP, customer name match only',
            'N' => 'No address or ZIP match only',
            'C' => 'No address or ZIP match only',
            '4' => 'No address or ZIP or customer name match only',
            '8' => 'No address or ZIP or customer name match only',
            'U' => 'Address unavailable',
            'G' => 'Non-U.S. issuer does not participate',
            'I' => 'Non-U.S. issuer does not participate',
            'R' => 'Issuer system unavailable',
            'E' => 'Not a mail/phone order',
            'S' => 'Service not supported',
            '0' => 'AVS not available',
            'O' => 'AVS not available'
        ];

        foreach ($avs_codes as $key => $code) {
            if ($key == $avs) {
                return $code;
            }
        }
        
        return;
    }

    public static function cvv_response($cvv)
    {
        $cvv_status = [
            'M' => 'Match',
            'N' => 'No Match',
            'P' => 'Not Processed',
            'S' => 'Merchant has indicated that CVV2/CVC2 is not present on card',
            'U' => 'Issuer is not certified and/or has not provided Visa encryption keys'
        ];

        foreach ($cvv_status as $key => $cvv_code) {
            if ($key == $cvv) {
                return $cvv_code;
            }
        }
        
        return;
    }

    public static function api_response_code($response_code)
    {
        $api_response_codes = [
            '100' => 'Transaction was approved.',
            '200' => 'Transaction was declined by processor.',
            '201' => 'Do not honor.',
            '202' => 'Insufficient funds.',
            '203' => 'Over limit.',
            '204' => 'Transaction not allowed.',
            '220' => 'Incorrect payment information.',
            '221' => 'No such card issuer.',
            '222' => 'No card number on file with issuer.',
            '223' => 'Expired card.',
            '224' => 'Invalid expiration date.',
            '225' => 'Invalid card security code.',
            '226' => 'Invalid PIN.',
            '240' => 'Call issuer for further information.',
            '250' => 'Pick up card.',
            '251' => 'Lost card.',
            '252' => 'Stolen card.',
            '253' => 'Fraudulent card.',
            '260' => 'Declined with further instructions available. (See response text)',
            '261' => 'Declined-Stop all recurring payments.',
            '262' => 'Declined-Stop this recurring program.',
            '263' => 'Declined-Update cardholder data available.',
            '264' => 'Declined-Retry in a few days.',
            '300' => 'Transaction was rejected by gateway.',
            '400' => 'Transaction error returned by processor.',
            '410' => 'Invalid merchant configuration.',
            '411' => 'Merchant account is inactive.',
            '420' => 'Communication error.',
            '421' => 'Communication error with issuer.',
            '430' => 'Duplicate transaction at processor.',
            '440' => 'Processor format error.',
            '441' => 'Invalid transaction information.',
            '460' => 'Processor feature not available.',
            '461' => 'Unsupported card type.'
        ];

        foreach ($api_response_codes as $key => $res_code) {
            if ($key == $response_code) {
                return $res_code;
            }
        }
        
        return;
    }
}