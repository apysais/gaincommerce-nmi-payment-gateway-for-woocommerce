API
Yes, you're correct! The customer_receipt parameter is the right one for API transactions.
Set customer_receipt=true in your Payment API request when processing the CollectJS token:
$api_params = array(
    'payment_token' => $payment_token,
    'amount' => $amount,
    'customer_receipt' => 'true',
    // your other API parameters
);

This will automatically send a transaction receipt to the customer when they're charged. The receipt goes to the billing email address included in your API request.
Note: This parameter is specifically for subscription transactions, but it works the same way for regular API payments - when set to true, customers receive email receipts upon successful charges.
=========================== API =================

partner portal 

You cannot set this yourself - your affiliate partner needs to enable it for you.
Your affiliate partner must log in to their Partner Portal and access your merchant account, then go to the Advanced Merchant Features section and enable "Enable automatic receipt sending functionality for API transactions".
The process is:
- Partner logs into Partner Portal
- Pulls up your merchant account
- Goes to Advanced Merchant Features section
- Clicks Edit
- Checks off "Enable automatic receipt sending functionality for API transactions"
- Clicks Save

Once enabled, your API requests with customer_receipt=true will automatically send email receipts to customers.

Merchant

Even with "Enable automatic receipt sending functionality for API transactions" enabled, you need to ensure proper email configuration for receipts to be delivered.
Check your "Receipts From Address" setting:
- Go to Options → Settings → Account Information in your merchant portal
- We recommend using <outgoing@safewebservices.com> in the "Receipts From Address" field
- Avoid using public webmail addresses (@gmail.com, @hotmail.com) as they may block emails sent on your behalf

Ensure your API request includes:
- customer_receipt=true parameter
- A valid billing email address for the customer

Email delivery issues:
If using your own domain email, you may need SPF records set up with your DNS provider to allow us to send emails on your behalf. Using <outgoing@safewebservices.com> bypasses this requirement as a quick fix.
The receipt will be sent to the billing email address provided in your API transaction once these settings are properly configured.