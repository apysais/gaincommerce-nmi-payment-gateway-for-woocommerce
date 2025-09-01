<?php
$display_accepted_cards = isset($args['display_accepted_cards']) ? $args['display_accepted_cards'] : '';
?>
<div>
    <?php echo esc_html($display_accepted_cards); ?>
</div>
<div class="ap-nmi-collectjs-container">
    <div class="form-row form-row-wide">
        <label>Card Number<span class="required">*</span></label>
        <div id="ap-nmi-card-number"></div>
    </div>
    <div class="form-row form-row-first" style="width:40%;">
        <label>Expiry Date <span class="required">*</span></label>
        <div id="ap-nmi-expiry-date"></div>
    </div>
    <div class="form-row form-row-first">
        <label>CVV</label>
        <div id="ap-nmi-card-cvv"></div>    
    </div>
</div>