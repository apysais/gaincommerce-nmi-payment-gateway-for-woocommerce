# Email Troubleshooting Guide for Gain Commerce NMI Payment Gateway for WooCommerce

## Issue: Custom Payment Gateway Not Sending Emails

### Root Causes and Solutions

## 1. **WooCommerce Email Settings Check**

First, verify that WooCommerce emails are properly configured:

### Admin Checklist:
- Go to **WooCommerce > Settings > Emails**
- Ensure the following emails are **enabled**:
  - `New Order` (to admin)
  - `Processing Order` (to customer)
  - `Order on Hold` (to customer)
  - `Completed Order` (to customer)

### Common Issues:
- **Emails disabled**: Check each email type is enabled
- **Wrong recipient**: Verify admin email and customer email addresses
- **Email templates**: Ensure templates are not corrupted

## 2. **Payment Gateway Implementation Issues**

### Problem: Missing Email Triggers
The original code was missing proper email triggering after payment processing.

### Solution Applied:
Added `trigger_order_emails()` method that:
- Gets WooCommerce mailer instance
- Triggers appropriate emails based on order status
- Handles both "sale" and "auth" transaction modes

```php
// In process_payment() method, after successful payment:
$this->trigger_order_emails($order);
```

### Problem: Order Status Not Triggering Emails
When `payment_complete()` is called, it should trigger emails automatically, but sometimes it doesn't.

### Solution Applied:
Added order status change hook:
```php
// In constructor:
add_action('woocommerce_order_status_changed', [$this, 'on_order_status_changed'], 10, 3);
```

## 3. **WordPress Mail Configuration**

### Check Mail Functionality:
```php
// Test if WordPress can send emails
$test = wp_mail('test@example.com', 'Test Subject', 'Test message');
var_dump($test); // Should return true
```

### Common Mail Issues:
- **No SMTP configured**: WordPress default mail may not work on all servers
- **Mail server blocked**: Hosting provider may block outgoing mail
- **SPF/DKIM issues**: Domain authentication problems

### Solutions:
1. **Install SMTP Plugin**: Use WP Mail SMTP or similar
2. **Configure Mail Server**: Set up proper SMTP credentials
3. **Contact Hosting**: Verify mail server configuration

## 4. **Order Status Flow Issues**

### Understanding Order Statuses:
- **Pending Payment**: Order created, payment not processed
- **Processing**: Payment successful (sale mode)
- **On Hold**: Payment authorized (auth mode)
- **Completed**: Order fulfilled

### Email Triggers by Status:
- `pending` → `processing`: Triggers "Processing Order" email
- `pending` → `on-hold`: Triggers "Order on Hold" email  
- `on-hold` → `processing`: Triggers "Processing Order" email
- `processing` → `completed`: Triggers "Completed Order" email

## 5. **Implementation Details**

### Files Modified:
1. **src/Gateway.php**:
   - Added `trigger_order_emails()` method
   - Added `on_order_status_changed()` method
   - Enhanced `process_payment()` to call email triggers

### Code Changes Made:

```php
// 1. Added to constructor
add_action('woocommerce_order_status_changed', [$this, 'on_order_status_changed'], 10, 3);

// 2. Added after successful payment processing
$this->trigger_order_emails($order);

// 3. New method to handle email triggering
private function trigger_order_emails($order) {
    $mailer = WC()->mailer();
    $emails = $mailer->get_emails();
    
    // Trigger admin email
    if (isset($emails['WC_Email_New_Order'])) {
        $emails['WC_Email_New_Order']->trigger($order->get_id(), $order);
    }
    
    // Trigger customer email based on status
    switch ($order->get_status()) {
        case 'on-hold':
            if (isset($emails['WC_Email_Customer_On_Hold_Order'])) {
                $emails['WC_Email_Customer_On_Hold_Order']->trigger($order->get_id(), $order);
            }
            break;
        case 'processing':
            if (isset($emails['WC_Email_Customer_Processing_Order'])) {
                $emails['WC_Email_Customer_Processing_Order']->trigger($order->get_id(), $order);
            }
            break;
        case 'completed':
            if (isset($emails['WC_Email_Customer_Completed_Order'])) {
                $emails['WC_Email_Customer_Completed_Order']->trigger($order->get_id(), $order);
            }
            break;
    }
}
```

## 6. **Testing and Debugging**

### Debug Steps:
1. **Enable WP Debug**: Add to wp-config.php:
   ```php
   define('WP_DEBUG', true);
   define('WP_DEBUG_LOG', true);
   ```

2. **Check Debug Log**: Look in `/wp-content/debug.log` for email-related errors

3. **Use Email Debug Helper**: Include the provided `email-debug-helper.php` file

4. **Test Email Manually**:
   ```php
   // Test WordPress mail
   wp_mail('your-email@example.com', 'Test', 'This is a test email');
   
   // Test WooCommerce emails
   $mailer = WC()->mailer();
   $emails = $mailer->get_emails();
   $emails['WC_Email_New_Order']->trigger($order_id);
   ```

### Debug URL:
Visit: `admin.php?page=wc-settings&tab=checkout&section=ap_nmi&ap_nmi_email_debug=1`

## 7. **Common Solutions Summary**

### Quick Fixes:
1. **Enable WooCommerce Emails**: Check WooCommerce > Settings > Emails
2. **Configure SMTP**: Install and configure SMTP plugin
3. **Check Hosting**: Verify mail server works with hosting provider
4. **Update Plugin**: Ensure latest version with email fixes
5. **Test Order**: Place test order and monitor debug logs

### Advanced Fixes:
1. **Custom Email Templates**: Modify email templates if needed
2. **Hook Priorities**: Adjust action hook priorities if conflicts exist
3. **Email Queue**: Implement email queue for high-traffic sites
4. **Third-party Services**: Use services like SendGrid, Mailgun, etc.

## 8. **Prevention Tips**

### Best Practices:
- Always test email functionality in staging environment
- Monitor email delivery rates and bounces
- Keep email templates updated with WooCommerce updates
- Use proper SMTP configuration instead of PHP mail()
- Implement email logging for debugging purposes

### Regular Maintenance:
- Test email functionality monthly
- Check spam folders for delivery issues
- Monitor email server reputation
- Update email templates with design changes

## Conclusion

The email issue has been resolved by:
1. Adding proper email triggering in the payment gateway
2. Implementing order status change monitoring
3. Providing debugging tools for future troubleshooting

The implementation now properly triggers WooCommerce emails when:
- Payment is successful (sale mode)
- Payment is authorized (auth mode) 
- Order status changes occur

If emails still don't work after these changes, the issue is likely with WordPress mail configuration or hosting provider settings, not the payment gateway code.
