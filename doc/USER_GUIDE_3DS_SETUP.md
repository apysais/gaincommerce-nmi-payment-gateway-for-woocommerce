# 3-D Secure Setup Guide for WordPress Store Owners

**Last Updated**: February 10, 2026  
**Applies to**: Gain Commerce NMI Payment Gateway (Free + Premium Plugin)  
**Time to Complete**: 15-30 minutes

---

## Table of Contents

1. [What You'll Need Before Starting](#what-youll-need-before-starting)
2. [What is 3-D Secure and Why Use It?](#what-is-3-d-secure-and-why-use-it)
3. [Step-by-Step Setup Instructions](#step-by-step-setup-instructions)
4. [Testing Your 3DS Setup](#testing-your-3ds-setup)
5. [Going Live Checklist](#going-live-checklist)
6. [Common Issues and Solutions](#common-issues-and-solutions)
7. [Customer Experience Walkthrough](#customer-experience-walkthrough)
8. [Frequently Asked Questions](#frequently-asked-questions)
9. [Getting Support](#getting-support)

---

## What You'll Need Before Starting

### Required Items Checklist

- ✅ WordPress website with WooCommerce installed
- ✅ **Gain Commerce NMI Payment Gateway** (Free plugin) - already installed and activated
- ✅ **Gain Commerce NMI Enterprise** (Premium plugin) - already installed and activated
- ✅ **NMI Merchant Account** with 3-D Secure enabled
  - If you're not sure, contact NMI: 1-866-937-0624 or support@nmi.com
  - Ask them: "Is 3-D Secure enabled on my merchant account?"
- ✅ Your NMI credentials:
  - Public Key (starts with letters/numbers like: `7242yd-juHM2S-T4ZNh2...`)
  - Private Key (similar format)
- ✅ 15-30 minutes of uninterrupted time
- ✅ Test credit cards from NMI (for testing)

### ⚠️ Important Notes

**About Pathfinder Sandbox:**
- If you're using NMI's "Pathfinder" evaluation account, **3-D Secure will NOT work**
- Pathfinder is for basic testing only
- To test 3DS, you need a real merchant account (you can use it in test mode)

**Browser Requirements:**
- Modern browser (Chrome, Firefox, Safari, Edge)
- JavaScript enabled
- Pop-ups allowed (for 3DS authentication window)

---

## What is 3-D Secure and Why Use It?

### Simple Explanation

3-D Secure (3DS) is like adding a security guard to your online store's checkout. When a customer pays with their credit card, their bank does an extra check to make sure it's really them making the purchase.

**What customers see:**
- Most of the time (80%): Nothing - it happens instantly in the background
- Sometimes (20%): A small popup asking them to verify (enter a code from their bank, use their banking app, etc.)

### Why Your Store Needs This

**1. Protection from Fraud**
- Blocks most fraudulent credit card transactions
- Saves you money from chargebacks

**2. Liability Shift**
- If fraud happens on a 3DS-authenticated payment, **the bank** is responsible, not you
- Without 3DS, **you** are responsible for fraud losses

**3. Fewer Chargebacks**
- When customers dispute charges, 3DS authentication proves they authorized it
- Can reduce chargebacks by 40-70%

**4. Customer Trust**
- Shows you take security seriously
- Familiar to customers (they see it on Amazon, big retailers)

**5. Better Approval Rates**
- Some legitimate transactions that might get declined will be approved with 3DS

### Real-World Example

**Without 3DS:**
- Customer's card is stolen
- Fraudster makes $500 purchase on your store
- Real customer disputes charge
- You lose $500 + chargeback fee ($15-100)
- **Total loss: $515-600**

**With 3DS:**
- Fraudster tries to purchase
- 3DS asks for verification code (sent to real customer)
- Fraudster can't verify
- Transaction blocked
- **You lose: $0**

---

## Step-by-Step Setup Instructions

### Part 1: Verify NMI Account Has 3DS Enabled

**Before configuring WordPress, confirm with NMI:**

1. **Call NMI Support**: 1-866-937-0624 (24/7)
2. **Say**: "I need to confirm 3-D Secure is enabled on my merchant account"
3. **They will check and tell you**: Yes or No
4. **If No**: Ask them to enable it (may take 1-2 business days)

**Alternative - Check Your NMI Portal:**
1. Log in to https://secure.nmi.com/merchants/
2. Go to Settings → Security Settings
3. Look for "3-D Secure" or "Payer Authentication"
4. Should show "Enabled" or "Active"

⚠️ **Don't skip this step!** WordPress setup won't work if NMI hasn't enabled 3DS on their end.

---

### Part 2: WordPress Plugin Configuration

#### Step 1: Access Payment Gateway Settings

1. Log in to your **WordPress Admin Dashboard**
2. Go to **WooCommerce** → **Settings**
3. Click the **Payments** tab at the top
4. Find **"Gain Commerce NMI Payment Gateway"** in the list
5. Click **Manage** button (or click the gateway name)

You should now see the gateway settings page.

---

#### Step 2: Verify Basic Gateway Settings

Before enabling 3DS, make sure these are correct:

**1. Enable/Disable**
- ✅ Check: "Enable NMI Payment Gateway"

**2. Title**
- Default: "Credit Card"
- This is what customers see at checkout
- You can customize if desired

**3. Test Mode**
- For testing: ✅ Check "Enable Test Mode"
- For production: ⬜ Uncheck
- You'll change this later

**4. Live Public Key**
- Paste your NMI public key here
- Example: `7242yd-juHM2S-T4ZNh2-E4s6ne`
- Get this from your NMI account

**5. Live Private Key**
- Paste your NMI private key here
- Keep this secret and secure
- Get this from your NMI account

**6. Save Changes** (bottom of page)

---

#### Step 3: Enable 3-D Secure Feature

**Scroll down to find the "3-D Secure Settings" section:**

> **Note**: If you don't see this section, the premium plugin isn't activated. Go to Plugins → Installed Plugins and activate "Gain Commerce NMI Enterprise"

**Configure 3DS Settings:**

**1. Enable 3-D Secure**
- ✅ Check: "Enable 3-D Secure Authentication"
- This turns on 3DS for all credit card payments

**2. 3DS Failure Action**
- This controls what happens if 3DS authentication fails
- **Recommended for most stores**: Select "**Decline Transaction**"

**Options Explained:**

| Option | What Happens | When to Use | Risk Level |
|--------|--------------|-------------|------------|
| **Decline Transaction** | Payment blocked, customer must use different card | Most stores (recommended) | 🟢 Low Risk |
| **Continue Without 3DS** | Payment processes normally | High-trust customers only | 🔴 High Risk |
| **Continue With Warning** | Payment processes, you get notification to review | Manual review process in place | 🟡 Medium Risk |

**Our Recommendation**: Start with "Decline Transaction" for maximum security.

**3. Save Changes** (bottom of page)

---

#### Step 4: Configure Additional Settings (Optional)

**Email Receipts**
- Default: Unchecked (WooCommerce sends receipts)
- Check if you want NMI to also send receipts
- Most stores leave this unchecked

**Save Payment Methods** (Premium feature)
- This should already be configured if you use saved cards
- Works seamlessly with 3DS
- Customer saves card → 3DS checks both first purchase AND future purchases

**Transaction Mode**
- **Sale**: Charges immediately (most common)
- **Authorize Only**: Hold funds, charge later
- Most stores use "Sale"

**4. Save Changes** again

---

### Part 3: Verify Installation

#### Quick Check - Make Sure Everything is Connected

1. **Go back to**: WooCommerce → Settings → Payments
2. **Verify you see**:
   - ✅ "Gain Commerce NMI Payment Gateway" is **Enabled**
   - ✅ No error messages shown

3. **Check on a new browser tab**:
   - Open your store in incognito/private window
   - Add a product to cart
   - Go to checkout
   - You should see "Credit Card" (or your custom title) as payment option

If you see errors or the payment method doesn't appear, see "Common Issues" section below.

---

## Testing Your 3DS Setup

### ⚠️ IMPORTANT: Test Before Going Live

**Never enable 3DS on a live store without testing first!**

### Testing Environment Setup

#### Option 1: Test Mode (Recommended)

1. **In WooCommerce Settings → Payments → NMI Gateway**:
   - ✅ Enable "Test Mode"
   - ✅ Enable "Enable 3-D Secure Authentication"
   - Save Changes

2. **Your live store** is now in test mode
   - Real customers won't see test transactions
   - You can test on actual checkout page
   - No real charges made

#### Option 2: Staging Site

If you have a staging/development site:
- Configure 3DS there first
- Test thoroughly
- Then copy settings to production

---

### Test Cards for 3DS

Use these special test cards provided by NMI:

| Card Number | What It Tests | Expected Result |
|-------------|---------------|-----------------|
| `4000000000001091` | 3DS v2.0 Frictionless | Instant approval, no popup |
| `4000000000001000` | 3DS v2.0 Challenge | Popup appears, asks for verification |
| `5555555555554444` | 3DS v1.0 | Legacy authentication |
| `4111111111111111` | Basic Visa | Non-3DS test |

**Card Details for Testing:**
- **Expiration**: Any future date (e.g., 12/28)
- **CVV**: Any 3 digits (e.g., 123)
- **Name**: Any name
- **ZIP**: Any 5 digits (e.g., 90210)

---

### Step-by-Step Test Process

#### Test 1: Frictionless Authentication (Quick Success)

**Goal**: Verify 3DS works without customer interaction

1. **Add a product to cart**
2. **Go to checkout**
3. **Fill in billing details** (use test email: test@example.com)
4. **Enter test card**: `4000000000001091`
   - Expiration: 12/28
   - CVV: 123
5. **Click "Place Order"**

**What you should see:**
- Brief loading spinner (1-2 seconds)
- Success! Order placed
- Redirected to order confirmation page

**What you should NOT see:**
- No popup or extra verification
- No errors

**Verify the order:**
1. Go to **WooCommerce → Orders**
2. Open the test order
3. Scroll to **Order Notes**
4. Look for: "3-D Secure: authenticated, version 2.0" (or similar)

✅ **Success** if order completed and has 3DS note.

---

#### Test 2: Challenge Authentication (With Popup)

**Goal**: Verify 3DS popup authentication works

1. **Add a product to cart**
2. **Go to checkout**
3. **Fill in billing details**
4. **Enter test card**: `4000000000001000`
   - Expiration: 12/28
   - CVV: 123
5. **Click "Place Order"**

**What you should see:**
- Loading spinner
- **A popup window appears** titled "3-D Secure Authentication"
- Inside popup: "Test Bank" authentication page
- Button or code entry field

**Complete the test:**
- In test mode, you can usually just click "Submit" or "Authenticate"
- Some test popups have a code like: `1234` - enter it and submit

**After authentication:**
- Popup closes
- Order completes
- Redirected to confirmation

**Verify:**
- Check order notes for 3DS authentication confirmation

✅ **Success** if popup appeared and order completed.

---

#### Test 3: Saved Card with 3DS (If Using Save Payment Feature)

**Goal**: Verify saved cards work with 3DS

**First, save a card:**
1. Checkout with card `4000000000001091`
2. ✅ Check "Save payment method for future purchases"
3. Complete order

**Then, use saved card:**
1. Add another product to cart
2. Go to checkout
3. **Select**: "Use saved card ending in ****1091"
4. Click "Place Order"

**What you should see:**
- Same 3DS flow as above
- Even though card is saved, 3DS still authenticates
- Order completes successfully

✅ **Success** if 3DS authenticated with saved card.

---

#### Test 4: Failure Handling

**Goal**: Verify what happens when 3DS fails

**Set failure mode:**
1. **WooCommerce → Settings → Payments → NMI**
2. **3DS Failure Action**: Select "Decline Transaction"
3. Save

**Simulate failure:**
- Use card: `4000000000001091`
- When 3DS popup appears (if any), close it without completing
- Or wait for timeout

**Expected result:**
- Error message appears
- Payment NOT processed
- Order NOT created

✅ **Success** if payment was blocked.

---

### Troubleshooting Test Issues

**Problem: No 3DS popup appears**

Possible causes:
1. Test mode using wrong keys → Verify keys are correct
2. 3DS not enabled in WordPress → Check settings again
3. 3DS not enabled on NMI account → Call NMI
4. Using Pathfinder sandbox → Switch to real account in test mode
5. Ad blocker blocking popup → Disable ad blocker temporarily

**Problem: "Payment Token does not exist" error**

This means:
- Keys don't match between settings
- Check that Public Key and Private Key are from same NMI account
- Re-save settings and try again

**Problem: "3-D Secure is not enabled on merchant account"**

This means:
- NMI hasn't enabled 3DS on their side
- Call NMI support to enable: 1-866-937-0624

**Problem: 3DS Settings section doesn't appear**

This means:
- Premium plugin not activated
- Go to **Plugins → Installed Plugins**
- Find "Gain Commerce NMI Enterprise"
- Click "Activate"
- Refresh settings page

---

## Going Live Checklist

### Before Enabling 3DS for Real Customers

Print this checklist and check off each item:

#### Testing Complete
- [ ] Tested frictionless authentication (card 1091) - ✅ Success
- [ ] Tested challenge authentication (card 1000) - ✅ Success
- [ ] Tested on desktop computer - ✅ Works
- [ ] Tested on mobile phone - ✅ Works
- [ ] Tested with Chrome browser - ✅ Works
- [ ] Tested with Safari or Firefox - ✅ Works
- [ ] Tested saved card (if using feature) - ✅ Works
- [ ] Verified order notes show 3DS authentication - ✅ Shows

#### Settings Verified
- [ ] Test Mode is **OFF** (unchecked)
- [ ] 3-D Secure is **ON** (checked)
- [ ] 3DS Failure Action set to "Decline Transaction"
- [ ] Public Key and Private Key are **production** keys (not test)
- [ ] Gateway is enabled in WooCommerce Payments

#### NMI Account Confirmed
- [ ] Called NMI and confirmed 3DS is enabled
- [ ] Using full merchant account (not Pathfinder)
- [ ] Know your NMI support contact

#### Support Prepared
- [ ] Support team trained on 3DS customer questions
- [ ] Know how to check order notes for 3DS status
- [ ] Have NMI support number: 1-866-937-0624
- [ ] Can access error logs if needed

#### Monitoring Ready
- [ ] Know how to check WooCommerce orders
- [ ] Know where error logs are stored
- [ ] Plan to check orders closely for first day
- [ ] Have backup payment method available (just in case)

---

### Steps to Go Live

**When all checklist items are complete:**

1. **Go to WooCommerce → Settings → Payments → NMI Gateway**

2. **Make these changes:**
   - Test Mode: ⬜ **Uncheck** "Enable Test Mode"
   - Verify keys are **production** keys (not test)
   - 3-D Secure: ✅ **Keep checked** "Enable 3-D Secure Authentication"
   - 3DS Failure Action: **Decline Transaction**

3. **Click "Save Changes"**

4. **Test with a SMALL real transaction**:
   - Use your own credit card
   - Make a $1 purchase
   - Verify 3DS authenticates
   - Verify order completes
   - If successful, refund the order

5. **Monitor closely**:
   - Check every order for first few hours
   - Look for any error patterns
   - Be ready to disable if major issues

6. **Be available**:
   - First day: Check error logs every 2-3 hours
   - First week: Daily log review
   - After: Weekly monitoring

---

## Customer Experience Walkthrough

### What Your Customers Will See

Help your support team understand the customer journey:

#### Scenario 1: Smooth Experience (80% of customers)

**Customer Steps:**
1. Adds product to cart
2. Goes to checkout
3. Enters card details
4. Clicks "Place Order"
5. Sees "Processing..." for 1-2 seconds
6. Order confirmed! ✅

**What happened behind scenes:**
- Card tokenized securely
- 3DS checked in milliseconds
- Bank verified: "Looks legitimate"
- No customer action needed
- Payment processed

**Customer never knows 3DS happened** - it's invisible.

---

#### Scenario 2: Extra Verification Needed (20% of customers)

**Customer Steps:**
1. Adds product to cart
2. Goes to checkout
3. Enters card details
4. Clicks "Place Order"
5. **Sees popup window appear** 📱
   - Title: "[Bank Name] - Secure Authentication"
   - Message: "Verify this purchase"
6. **Options shown:**
   - Enter code from SMS
   - Approve in banking app
   - Answer security question
7. **Customer completes verification** ✅
8. Popup closes automatically
9. Order confirmed!

**Total time added:** 15-30 seconds

**Why this happens:**
- Bank's fraud detection needs extra check
- Large purchase amount
- New device/location
- Card has high fraud risk
- Random security check

**Customer perception:**
- "My bank is protecting me" ✅
- Familiar from other sites
- Feels secure

---

#### Scenario 3: Authentication Fails

**What triggers this:**
- Customer closes popup without verifying
- Wrong verification code entered 3 times
- Customer doesn't have phone for SMS code
- Verification timeout (60 seconds usually)

**Customer sees:**
- Error message: "Payment verification failed. Please try again or use a different payment method."
- No charge made
- Can retry or use different card

**What to tell customers:**
"The verification failed. This is a security feature from your bank. You can:
1. Try again
2. Contact your bank for help
3. Use a different payment method"

---

### Common Customer Questions & Answers

**Q: "Why do I need to verify my card?"**

**A:** "This is an extra security step required by your bank to protect you from fraud. It only takes a few seconds and ensures your payment is safe. It's the same verification you see on Amazon and other major retailers."

---

**Q: "I didn't get a verification code"**

**A:** "The verification code is sent by your bank, not by us. Please:
1. Check your phone's text messages
2. Check your banking app notifications
3. Wait 30 seconds and check again
4. If still nothing, please contact your bank's customer service
5. Or try a different payment method"

---

**Q: "This is taking too long, can I skip it?"**

**A:** "Unfortunately, no. This security check is required by your bank and cannot be skipped. It usually completes in 15-30 seconds. If it's taking longer, you can:
1. Wait a bit longer (sometimes banks are slow)
2. Try refreshing and starting over
3. Use a different card"

---

**Q: "I used this card before and didn't have to verify"**

**A:** "We've recently upgraded our security to better protect you. Most customers are verified instantly (you won't notice), but sometimes your bank may request additional confirmation. This is a one-time verification in most cases."

---

**Q: "Why can't I get the popup to appear?"**

**A:** "Please check:
1. Pop-up blocker is turned off
2. Ad blocker is disabled for our site
3. Using a modern browser (Chrome, Firefox, Safari, Edge)
4. JavaScript is enabled
5. Try a different browser if problems continue"

---

**Q: "I verified but order still failed"**

**A:** "This can happen if:
1. Verification took too long (timeout)
2. Card was declined for other reasons (insufficient funds, etc.)
3. Technical issue occurred

Please try again. If it happens repeatedly, please contact us with your order number and we'll investigate."

---

## Common Issues and Solutions

### Issue: 3DS Not Working at All

**Symptoms:**
- Customers complete checkout without seeing any 3DS
- Orders process normally but no 3DS authentication
- Order notes don't mention 3DS

**Diagnosis Steps:**

1. **Check if 3DS is enabled in WordPress:**
   - WooCommerce → Settings → Payments → NMI → Manage
   - Scroll to "3-D Secure Settings"
   - Is "Enable 3-D Secure Authentication" checked? ✅

2. **Check if premium plugin is active:**
   - Plugins → Installed Plugins
   - "Gain Commerce NMI Enterprise" shows "Active"?

3. **Check browser console for errors:**
   - Right-click page → Inspect → Console tab
   - Look for Gateway.js errors

4. **Verify NMI account has 3DS:**
   - Call NMI: 1-866-937-0624
   - Ask: "Is 3-D Secure enabled on my merchant account?"

**Solutions:**
- If unchecked: Enable in settings
- If premium not active: Activate plugin
- If console errors: Contact plugin support
- If NMI says no: Ask them to enable 3DS

---

### Issue: "Payment Token Does Not Exist" Error

**Symptoms:**
- 3DS popup appears
- Customer completes authentication
- Error appears: "Payment Token does not exist REFID:XXXXXX"
- Payment fails

**Common Causes:**
1. Public Key and Private Key don't match
2. Using Pathfinder keys (not supported)
3. Keys from different NMI accounts

**Solutions:**

**Step 1: Verify keys match**
1. Log in to NMI merchant portal
2. Go to Settings → Security Keys
3. Copy BOTH keys from same account
4. Paste into WordPress settings
5. Save changes
6. Test again

**Step 2: Confirm NOT using Pathfinder**
1. Check if keys start with testable/demo characters
2. If using Pathfinder → Get real merchant account
3. Pathfinder doesn't support 3DS at all

**Step 3: Check key format**
- Should be long strings like: `7242yd-juHM2S-T4ZNh2-E4s6ne`
- Should NOT have spaces
- Should NOT be truncated

---

### Issue: 3DS Popup Blocked by Browser

**Symptoms:**
- Nothing happens after clicking "Place Order"
- No popup appears
- Page just spins/loads forever

**Causes:**
- Pop-up blocker enabled
- Ad blocker active
- Browser security settings

**Solutions:**

**For You (Testing):**
1. Disable pop-up blocker for your site
2. Disable ad blocker temporarily
3. Try incognito/private mode
4. Try different browser

**For Customers:**
1. Add help text on checkout page:
   - "Please disable pop-up blockers for secure payment"
   - "Allow pop-ups from [yoursite.com]"
2. Support response template:
   - "Please allow pop-ups from our website for secure payment processing"

---

### Issue: Mobile 3DS Not Working

**Symptoms:**
- Works on desktop
- Fails on mobile devices
- Modal appears but can't interact

**Solutions:**

1. **Test different mobile browsers:**
   - iOS Safari
   - Chrome mobile
   - Firefox mobile

2. **Check responsive design:**
   - 3DS modal should fit screen
   - Buttons should be tappable
   - Not cut off at edges

3. **Verify touchscreen works:**
   - Can tap verification buttons
   - Can enter codes in fields

4. **Update plugins:**
   - Make sure latest version installed
   - Mobile improvements in recent updates

---

### Issue: High Failure Rate

**Symptoms:**
- Many customers can't complete 3DS
- Multiple complaints about verification
- Orders failing frequently

**Diagnosis:**

**Check failure rate:**
1. WooCommerce → Orders
2. Count failed orders in last 24 hours
3. Calculate: (Failed / Total Attempted) × 100
4. Over 10% = Problem
5. Under 5% = Normal

**Common patterns:**
1. All same card type (Visa, Mastercard, etc.)
2. All international customers
3. All mobile users
4. All during peak hours

**Solutions:**

1. **If pattern found:**
   - Contact NMI support
   - Describe pattern
   - May need settings adjustment

2. **If random failures:**
   - Normal (some customers will always fail)
   - Provide good error messages
   - Offer alternative payment methods

3. **If excessive (>15%):**
   - May need to adjust 3DS settings with NMI
   - Consider different failure action temporarily
   - Collect data and contact support

---

### Issue: Saved Cards Not Working with 3DS

**Symptoms:**
- New cards work fine
- Saved cards fail with 3DS error
- Or saved cards skip 3DS entirely

**Solutions:**

1. **Verify Save Card feature enabled:**
   - Premium plugin active ✅
   - Save Payment checkbox appears at checkout ✅

2. **Check customer vault in NMI:**
   - Log into NMI portal
   - Customer Vault → Search for customer
   - Verify card is stored

3. **Test with fresh saved card:**
   - Delete old saved cards from WP Admin
   - Save a new card fresh
   - Test using it

4. **Check for conflicts:**
   - Disable other payment plugins temporarily
   - Test again
   - Re-enable one by one to find conflict

---

## Advanced Configuration

### Customizing 3DS Behavior

**Where to find advanced settings:**
- These are controlled by NMI, not WordPress
- Log into NMI merchant portal
- Settings → 3-D Secure Settings
- Options may include:
  - Challenge preference (prefer frictionless vs prefer challenge)
  - 3DS version preference (v1 vs v2)
  - Exemption rules
  - Dynamic 3DS (based on amount)

**Contact NMI before changing these!**

---

### Logs and Debugging

**Finding error logs:**

**Method 1: WP Debug Log**
1. Enable in wp-config.php:
   ```php
   define('WP_DEBUG', true);
   define('WP_DEBUG_LOG', true);
   ```
2. Log file: `/wp-content/debug.log`

**Method 2: Plugin Log**
1. Enable in WooCommerce → Settings → Payments → NMI
2. Check "Enable Logging"
3. Save
4. Log file: `/nmi/3ds/gaincommerce-nmi-gateway-[date].log`

**What to look for:**
- "3DS enabled - checking for authentication data"
- "Adding 3DS data to payment request"
- "Payment Token does not exist" = Key mismatch
- "3DSecure is inactive" = Not enabled on NMI

**Sharing logs with support:**
- Copy last 50 lines
- Remove any private keys if shown
- Email to support with order number

---

## Performance Considerations

### Does 3DS Slow Down Checkout?

**Speed Impact:**

**Frictionless (80% of transactions):**
- Added time: 1-2 seconds
- Customer barely notices
- Happens in background

**Challenge (20% of transactions):**
- Added time: 15-30 seconds
- Customer sees popup
- Worth it for security

**Overall checkout time:**
- Average increase: 3-5 seconds
- Better than manual fraud review!
- Faster than losing money to fraud

**Optimization tips:**
- Make sure hosting is fast
- Use CDN if available
- Keep other plugins minimal
- Test on slow connection to verify

---

## Frequently Asked Questions

### General Questions

**Q: Is 3DS required by law?**

**A:** Not in most cases, but:
- Required in Europe (PSD2/SCA regulations)
- Recommended everywhere for fraud protection
- May be required by your payment processor
- Check with legal/accounting advisor for your region

---

**Q: Can I make 3DS optional for small purchases?**

**A:** Not through WordPress settings. NMI may offer:
- Transaction amount thresholds
- Dynamic 3DS rules
- Contact NMI to discuss options

---

**Q: Will this work with my theme?**

**A:** Yes, works with all modern WooCommerce themes:
- Uses standard WooCommerce checkout
- 3DS popup is separate from theme
- Tested with popular themes
- If issues, contact support

---

**Q: Does it work with WooCommerce Blocks checkout?**

**A:** ✅ Yes! Fully supported:
- Classic checkout: ✅ Works
- Block-based checkout: ✅ Works
- Both tested and working

---

**Q: Can customers save cards with 3DS?**

**A:** ✅ Yes!
- Customer saves card during first purchase
- 3DS authenticates that purchase
- Card saved to vault
- Future purchases also use 3DS
- Even more secure

---

**Q: What about subscriptions/recurring payments?**

**A:** 
- Initial purchase: 3DS applies
- Recurring charges: May not require 3DS (by design)
- Bank knows it's a stored credential
- Follow NMI's credential-on-file guidelines

---

**Q: Does it cost extra?**

**A:** 
- NMI may charge per 3DS transaction
- Typical: $0.05-$0.15 per authentication
- Check your NMI merchant agreement
- Usually offset by fraud savings

---

**Q: Can I disable 3DS temporarily?**

**A:** Yes:
1. WooCommerce → Settings → Payments → NMI
2. Uncheck "Enable 3-D Secure Authentication"
3. Save Changes
4. Takes effect immediately

---

### Technical Questions

**Q: Where is the 3DS data stored?**

**A:**
- Authentication data sent to NMI with transaction
- Transaction ID stored in WooCommerce order
- Customer vault ID stored in user meta
- Nothing sensitive stored on your server

---

**Q: Is it PCI compliant?**

**A:**
- 3DS uses NMI's tokenization (PCI compliant)
- Card data never touches your server
- Authentication handled by NMI
- You still need general PCI compliance

---

**Q: Can I test in Pathfinder?**

**A:** ❌ No
- Pathfinder doesn't support 3DS
- Pathfinder doesn't support customer vault
- Use real account in test mode instead

---

**Q: What 3DS version is used?**

**A:**
- Automatically uses 3DS v2.0 when available (modern)
- Falls back to 3DS v1.0 for older cards
- NMI determines version based on card
- No configuration needed

---

**Q: Does it work internationally?**

**A:** ✅ Yes:
- Works worldwide
- Customer sees verification in their language
- Bank determines verification method
- No geographic restrictions

---

## Getting Support

### Quick Reference

**Plugin Issues:**
- Email: support@gaincommerce.com
- Include: WordPress version, WooCommerce version, error messages, screenshots

**NMI/Gateway Issues:**
- Phone: 1-866-937-0624 (24/7)
- Email: support@nmi.com
- Portal: https://secure.nmi.com/merchants/

**WordPress/WooCommerce Issues:**
- WooCommerce Docs: https://woocommerce.com/documentation/
- WP Forums: https://wordpress.org/support/

---

### Before Contacting Support

**Have this information ready:**

1. **WordPress Environment:**
   - WordPress version
   - WooCommerce version
   - PHP version (Tools → Site Health)
   - Active theme name

2. **Plugin Versions:**
   - Free plugin version
   - Premium plugin version

3. **Error Details:**
   - Exact error message
   - When it occurs
   - Steps to reproduce
   - Screenshot if possible

4. **Order Information:**
   - Order number if applicable
   - Customer email (if allowed)
   - Transaction ID from NMI

5. **What You've Tried:**
   - List troubleshooting steps already taken
   - Results of each attempt

---

### Emergency Contact

**If your store is down or 3DS is broken:**

1. **Immediate action:**
   - Disable 3DS temporarily (uncheck in settings)
   - Allows customers to checkout while you fix issue
   - Enable after resolution

2. **Contact priority:**
   - NMI Support (if keys/authentication issue): 1-866-937-0624
   - Plugin Support (if WordPress issue): support@gaincommerce.com
   - Hosting Support (if server issue): Your hosting provider

3. **Don't panic:**
   - Disabling 3DS lets store work normally
   - You can fix and re-enable when ready
   - No data is lost

---

## Success Checklist

**You've successfully set up 3DS when:**

- ✅ 3DS enabled in WordPress settings
- ✅ NMI confirmed 3DS active on account
- ✅ Tested frictionless flow successfully
- ✅ Tested challenge flow successfully
- ✅ Tested with mobile device
- ✅ Tested with saved card (if using feature)
- ✅ Support team trained on customer questions
- ✅ Know how to check logs for issues
- ✅ Know how to disable if emergency
- ✅ Monitoring orders for any issues

**Congratulations! Your store is now more secure.**

---

## Next Steps

**After successful setup:**

1. **Monitor for first week:**
   - Check orders daily
   - Review any error patterns
   - Note customer feedback

2. **Review monthly:**
   - Check authentication success rate
   - Compare chargebacks before/after
   - Assess fraud reduction

3. **Stay updated:**
   - Keep plugins updated
   - Watch for NMI updates
   - Review new features

4. **Optimize:**
   - Fine-tune failure action if needed
   - Adjust settings based on experience
   - Consider additional security features

---

## Appendix: Quick Reference

### Settings Location Cheat Sheet

```
WordPress Admin
└── WooCommerce
    └── Settings
        └── Payments tab
            └── Gain Commerce NMI Payment Gateway
                └── Manage button
                    └── Scroll to "3-D Secure Settings"
                        ├── Enable 3-D Secure Authentication ☑️
                        └── 3DS Failure Action: [Decline Transaction]
```

### Test Card Quick Reference

| Card | Purpose | Result |
|------|---------|--------|
| 4000000000001091 | Quick test | Instant approval |
| 4000000000001000 | Full test | Challenge popup |
| 5555555555554444 | 3DS v1.0 | Legacy flow |

**Expiry**: Any future date  
**CVV**: Any 3 digits  
**ZIP**: Any 5 digits  

### Support Contact Card

```
┌─────────────────────────────────────┐
│ NMI SUPPORT (Gateway)               │
│ Phone: 1-866-937-0624 (24/7)        │
│ Email: support@nmi.com              │
├─────────────────────────────────────┤
│ PLUGIN SUPPORT (Technical)          │
│ Email: support@gaincommerce.com     │
└─────────────────────────────────────┘
```

---

**Document Version**: 1.0  
**Last Updated**: February 10, 2026  
**Feedback**: support@gaincommerce.com

**Thank you for using Gain Commerce NMI Payment Gateway!**
