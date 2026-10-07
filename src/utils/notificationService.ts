import { ServiceBooking, OwnerNotificationConfig, BookingNotificationLog, ReminderSettings, ReminderChannel, DEFAULT_REMINDER_SETTINGS, clampNumber } from '../types/bikeShop';
import { getSupabaseClient } from '../lib/supabase';
import { vehicleNouns } from './vehicleType';
import { shouldSendBookingEmail } from './bookingEmailLedger';
import { sendPushToUser } from './pushNotifications';
import { bookingDeepLink, sosPushCopy } from './bookingNotifications';

export interface DispatchResult {
  emailLog: BookingNotificationLog;
  customerEmailLog: BookingNotificationLog;
  timestamp: string;
  /** Human-readable reasons any notification failed to actually send. */
  failures?: string[];
}

/**
 * Generates branded HTML email content for the workshop owner/staff
 */
export function generateBookingEmailHtml(booking: ServiceBooking, config: OwnerNotificationConfig): string {
  const sos = Boolean(booking.isSos);
  const alertBannerBg = sos ? '#7f1d1d' : '#1f2937';
  const alertBannerColor = sos ? '#fecaca' : '#34d399';
  const alertText = sos
    ? '🚨 SOS EMERGENCY — PRIORITY CALL-OUT (EXPRESS QUEUE)'
    : '⚡ NEW WORKSHOP REPAIR BOOKING RECEIVED';
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${sos ? '🚨 SOS Emergency Repair' : 'New Service Booking'} - Stakey's Cycles & Scooter</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0d0e; color: #ffffff; margin: 0; padding: 24px;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #141517; border-radius: 16px; border: 1px solid #27272a; overflow: hidden;">
    <!-- Header with Stakey's Shield Branding -->
    <tr>
      <td style="background-color: #05C147; padding: 24px; text-align: center;">
        <h1 style="color: #000000; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 2px;">STAKEYS</h1>
        <p style="color: #000000; margin: 4px 0 0 0; font-size: 14px; font-weight: 600; letter-spacing: 1px;">CYCLES &amp; SCOOTER</p>
      </td>
    </tr>

    <!-- Alert Banner -->
    <tr>
      <td style="background-color: ${alertBannerBg}; padding: 12px 24px; border-bottom: 1px solid #374151; color: ${alertBannerColor}; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
        ${alertText}
      </td>
    </tr>
${sos ? `
    <!-- SOS priority block -->
    <tr>
      <td style="padding: 20px 24px 0 24px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="12" style="background-color: #450a0a; border-radius: 12px; border: 2px solid #ef4444;">
          <tr>
            <td style="color: #fecaca; font-size: 15px; font-weight: 800; line-height: 1.5;">
              🚨 SOS EMERGENCY REPAIR — HIGH IMPORTANCE<br />
              <span style="font-weight: 600; font-size: 13px;">A rider is off the road and needs this job treated as priority. Jump the workshop queue and dispatch as soon as capacity allows.</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>` : ''}

    <!-- Booking Details Body -->
    <tr>
      <td style="padding: 28px 24px;">
        <h2 style="color: #ffffff; font-size: 20px; margin: 0 0 16px 0;">${sos ? '🚨 ' : ''}Booking #${booking.id}</h2>

        <table width="100%" border="0" cellspacing="0" cellpadding="8" style="background-color: #18181b; border-radius: 12px; margin-bottom: 20px; border: 1px solid #27272a;">
          <tr>
            <td style="color: #a1a1aa; font-size: 13px; width: 35%;">Service Requested:</td>
            <td style="color: #05C147; font-size: 15px; font-weight: 700;">${booking.serviceTitle}</td>
          </tr>
          <tr>
            <td style="color: #a1a1aa; font-size: 13px;">Vehicle:</td>
            <td style="color: #ffffff; font-size: 14px; font-weight: 600;">
              ${booking.vehicleCategory.toUpperCase().replace('_', ' ')} — ${booking.vehicleModel}
            </td>
          </tr>
          <tr>
            <td style="color: #a1a1aa; font-size: 13px;">Scheduled Slot:</td>
            <td style="color: #ffffff; font-size: 14px; font-weight: 600;">
              📅 ${booking.preferredDate} (${booking.preferredTimeSlot})
            </td>
          </tr>
          <tr>
            <td style="color: #a1a1aa; font-size: 13px;">Estimated Charge:</td>
            <td style="color: #34d399; font-size: 15px; font-weight: 700;">£${booking.servicePrice.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="color: #a1a1aa; font-size: 13px;">Email Delivery:</td>
            <td style="color: #38bdf8; font-size: 13px; font-weight: 600;">
              ✅ Confirmation delivered to Customer (${booking.customerEmail}) &amp; Workshop (${config.ownerEmail})
            </td>
          </tr>
          <tr>
            <td style="color: #a1a1aa; font-size: 13px;">Status:</td>
            <td style="color: #facc15; font-size: 13px; font-weight: 700;">
              ${booking.approvalStatus === 'approved' ? '✅ Confirmed & Approved' : '⏳ Awaiting Workshop Review & Approval'}
            </td>
          </tr>
          ${sos ? `
          <tr>
            <td style="color: #a1a1aa; font-size: 13px;">SOS Status:</td>
            <td style="color: #f87171; font-size: 13px; font-weight: 700; text-transform: uppercase;">
              🚨 ${(booking.sosStatus || 'requested').replace(/_/g, ' ')}
            </td>
          </tr>` : ''}
        </table>

        <!-- Customer Contact Details -->
        <h3 style="color: #d4d4d8; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px 0;">Customer Information</h3>
        <table width="100%" border="0" cellspacing="0" cellpadding="8" style="background-color: #18181b; border-radius: 12px; margin-bottom: 20px; border: 1px solid #27272a;">
          <tr>
            <td style="color: #a1a1aa; font-size: 13px; width: 35%;">Customer Name:</td>
            <td style="color: #ffffff; font-size: 14px; font-weight: 600;">${booking.customerName}</td>
          </tr>
          <tr>
            <td style="color: #a1a1aa; font-size: 13px;">Email:</td>
            <td style="color: #38bdf8; font-size: 14px;">
              <a href="mailto:${booking.customerEmail}" style="color: #38bdf8; text-decoration: none;">${booking.customerEmail}</a>
            </td>
          </tr>
          <tr>
            <td style="color: #a1a1aa; font-size: 13px;">Phone / Mobile:</td>
            <td style="color: #38bdf8; font-size: 14px; font-weight: 600;">
              <a href="tel:${booking.customerPhone}" style="color: #34d399; text-decoration: none;">${booking.customerPhone}</a>
            </td>
          </tr>
          ${booking.membershipNumber ? `
          <tr>
            <td style="color: #a1a1aa; font-size: 13px;">Loyalty Member ID:</td>
            <td style="color: #05C147; font-size: 13px; font-family: monospace; font-weight: 700;">${booking.membershipNumber}</td>
          </tr>
          ` : ''}
          ${booking.notes ? `
          <tr>
            <td style="color: #a1a1aa; font-size: 13px; vertical-align: top;">Customer Notes:</td>
            <td style="color: #e4e4e7; font-size: 13px; font-style: italic;">"${booking.notes}"</td>
          </tr>
          ` : ''}
        </table>

        <!-- Quick Action Buttons -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" style="padding-top: 10px;">
              <a href="mailto:${booking.customerEmail}?subject=Regarding Your Stakey's Cycles Repair Booking #${booking.id}" style="background-color: #05C147; color: #000000; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block; margin-right: 10px;">
                ✉️ Reply via Email
              </a>
              <a href="tel:${booking.customerPhone}" style="background-color: #27272a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">
                📞 Call Customer
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #090a0b; padding: 16px 24px; text-align: center; border-top: 1px solid #27272a; color: #71717a; font-size: 12px;">
        Notification delivered automatically to <strong>${config.ownerEmail}</strong> • Stakey's Cycles &amp; Scooter Staff Portal
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generates branded HTML email sent to customer confirming booking submission
 */
export function generateCustomerBookingEmailHtml(booking: ServiceBooking, config: OwnerNotificationConfig): string {
  const shopPhone = config.ownerPhone || '+44 7388 209102';
  const shopEmail = config.ownerEmail || 'workshop@stakeyscycles.com';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Repair Request Received - Stakey's Cycles &amp; Scooter</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0d0e; color: #ffffff; margin: 0; padding: 24px;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #141517; border-radius: 16px; border: 1px solid #27272a; overflow: hidden;">
    <!-- Header with Stakey's Branding -->
    <tr>
      <td style="background-color: #05C147; padding: 26px; text-align: center;">
        <h1 style="color: #000000; margin: 0; font-size: 26px; font-weight: 900; letter-spacing: 2px;">STAKEY'S</h1>
        <p style="color: #000000; margin: 4px 0 0 0; font-size: 13px; font-weight: 700; letter-spacing: 1px;">CYCLES &amp; SCOOTER WORKSHOP</p>
      </td>
    </tr>

    <!-- Status Banner -->
    <tr>
      <td style="background-color: #1e293b; padding: 14px 24px; border-bottom: 1px solid #334155; color: #38bdf8; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; text-align: center;">
        📋 REPAIR REQUEST RECEIVED — PENDING STAFF APPROVAL
      </td>
    </tr>

    <!-- Main Message -->
    <tr>
      <td style="padding: 28px 24px;">
        <h2 style="color: #ffffff; font-size: 20px; margin: 0 0 8px 0;">Hello ${booking.customerName},</h2>
        <p style="color: #d4d4d8; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
          Thank you for choosing Stakey's Cycles &amp; Scooter. We have received your service booking request. Our workshop-certified mechanics are currently reviewing workbench capacity for your requested slot.
        </p>

        <!-- Booking Summary Card -->
        <table width="100%" border="0" cellspacing="0" cellpadding="10" style="background-color: #18181b; border-radius: 12px; margin-bottom: 22px; border: 1px solid #27272a;">
          <tr>
            <td style="color: #a1a1aa; font-size: 13px; width: 35%; border-bottom: 1px solid #27272a;">Booking Reference:</td>
            <td style="color: #ffffff; font-size: 14px; font-weight: 700; font-family: monospace; border-bottom: 1px solid #27272a;">#${booking.id}</td>
          </tr>
          <tr>
            <td style="color: #a1a1aa; font-size: 13px; border-bottom: 1px solid #27272a;">Requested Slot:</td>
            <td style="color: #05C147; font-size: 15px; font-weight: 800; border-bottom: 1px solid #27272a;">
              📅 ${booking.preferredDate} (${booking.preferredTimeSlot})
            </td>
          </tr>
          <tr>
            <td style="color: #a1a1aa; font-size: 13px; border-bottom: 1px solid #27272a;">Service:</td>
            <td style="color: #ffffff; font-size: 14px; font-weight: 700; border-bottom: 1px solid #27272a;">${booking.serviceTitle}</td>
          </tr>
          <tr>
            <td style="color: #a1a1aa; font-size: 13px; border-bottom: 1px solid #27272a;">Vehicle:</td>
            <td style="color: #ffffff; font-size: 14px; border-bottom: 1px solid #27272a;">${booking.vehicleModel}</td>
          </tr>
          <tr>
            <td style="color: #a1a1aa; font-size: 13px;">Estimated Labour:</td>
            <td style="color: #34d399; font-size: 15px; font-weight: 700;">£${booking.servicePrice.toFixed(2)}</td>
          </tr>
        </table>

        <!-- Approval Process Explanation -->
        <div style="background-color: #1e1b4b; border: 1px solid #4338ca; border-radius: 12px; padding: 14px; margin-bottom: 22px;">
          <div style="color: #a5b4fc; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">Approval Process:</div>
          <div style="color: #e0e7ff; font-size: 13px; line-height: 1.5;">
            Our workshop staff evaluate every booking before confirming workbench availability. You will receive an official approval email once our mechanics have confirmed your appointment slot.
          </div>
        </div>

        <!-- Contact Workshop Buttons -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center">
              <a href="mailto:${shopEmail}?subject=Question regarding Booking #${booking.id}" style="background-color: #05C147; color: #000000; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block; margin-right: 10px;">
                ✉️ Email Workshop: ${shopEmail}
              </a>
              <a href="tel:${shopPhone}" style="background-color: #27272a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">
                📞 Call Workshop
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #090a0b; padding: 16px 24px; text-align: center; border-top: 1px solid #27272a; color: #71717a; font-size: 12px;">
        Sent to <strong>${booking.customerEmail}</strong> • Stakey's Cycles &amp; Scooter Workshop
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generates 24-Hour Automated Reminder Email for Customer
 */
export function generateCustomer24hReminderEmailHtml(booking: ServiceBooking, config: OwnerNotificationConfig): string {
  const shopPhone = config.ownerPhone || '+44 7388 209102';
  const shopEmail = config.ownerEmail || 'workshop@stakeyscycles.com';
  const v = vehicleNouns(booking.vehicleCategory);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Service Reminder - Stakey's Cycles &amp; Scooter</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0d0e; color: #ffffff; margin: 0; padding: 24px;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #141517; border-radius: 16px; border: 1px solid #27272a; overflow: hidden;">
    <!-- Header with Stakey's Branding -->
    <tr>
      <td style="background-color: #05C147; padding: 24px; text-align: center;">
        <h1 style="color: #000000; margin: 0; font-size: 26px; font-weight: 900; letter-spacing: 2px;">STAKEY'S</h1>
        <p style="color: #000000; margin: 4px 0 0 0; font-size: 13px; font-weight: 700; letter-spacing: 1px;">CYCLES &amp; SCOOTER WORKSHOP</p>
      </td>
    </tr>

    <!-- Reminder Banner -->
    <tr>
      <td style="background-color: #312e81; padding: 14px 24px; border-bottom: 1px solid #4338ca; color: #c7d2fe; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; text-align: center;">
        ⏰ 24-HOUR WORKSHOP SERVICE REMINDER
      </td>
    </tr>

    <!-- Main Message -->
    <tr>
      <td style="padding: 28px 24px;">
        <h2 style="color: #ffffff; font-size: 20px; margin: 0 0 8px 0;">Hi ${booking.customerName},</h2>
        <p style="color: #d4d4d8; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
          This is a friendly reminder that the scheduled service slot for your ${v.noun} is in approximately 24 hours at <strong>Stakey's Cycles &amp; Scooter Workshop</strong>.
        </p>

        <!-- Slot Card -->
        <table width="100%" border="0" cellspacing="0" cellpadding="10" style="background-color: #18181b; border-radius: 12px; margin-bottom: 22px; border: 1px solid #27272a;">
          <tr>
            <td style="color: #a1a1aa; font-size: 13px; width: 35%; border-bottom: 1px solid #27272a;">Booking Reference:</td>
            <td style="color: #ffffff; font-size: 14px; font-weight: 700; font-family: monospace; border-bottom: 1px solid #27272a;">#${booking.id}</td>
          </tr>
          <tr>
            <td style="color: #a1a1aa; font-size: 13px; border-bottom: 1px solid #27272a;">Drop-Off Window:</td>
            <td style="color: #05C147; font-size: 15px; font-weight: 800; border-bottom: 1px solid #27272a;">
              📅 ${booking.preferredDate} (${booking.preferredTimeSlot})
            </td>
          </tr>
          <tr>
            <td style="color: #a1a1aa; font-size: 13px; border-bottom: 1px solid #27272a;">Service:</td>
            <td style="color: #ffffff; font-size: 14px; font-weight: 700; border-bottom: 1px solid #27272a;">${booking.serviceTitle}</td>
          </tr>
          <tr>
            <td style="color: #a1a1aa; font-size: 13px;">Vehicle:</td>
            <td style="color: #ffffff; font-size: 14px; font-weight: 600;">${booking.vehicleModel}</td>
          </tr>
        </table>

        <!-- Drop-off advice -->
        <h3 style="color: #d4d4d8; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0;">Drop-Off Information</h3>
        <ul style="color: #a1a1aa; font-size: 13px; line-height: 1.6; margin: 0 0 24px 0; padding-left: 20px;">
          <li>Location: <strong>Unit 4, Workshop Lane, Stakey's Workshop</strong>.</li>
          ${v.category === 'ebike' || v.category === 'electric_scooter' ? '<li>Please bring your battery key and charger for your ' + v.noun + '.</li>' : ''}
          <li>Need to reschedule? Reply directly to this email or call <strong style="color: #ffffff;">${shopPhone}</strong>.</li>
        </ul>

        <!-- Action Buttons -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center">
              <a href="mailto:${shopEmail}?subject=Reschedule Booking #${booking.id}" style="background-color: #05C147; color: #000000; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block; margin-right: 10px;">
                ✉️ Email Workshop
              </a>
              <a href="tel:${shopPhone}" style="background-color: #27272a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">
                📞 Call Workshop: ${shopPhone}
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #090a0b; padding: 16px 24px; text-align: center; border-top: 1px solid #27272a; color: #71717a; font-size: 12px;">
        Sent to <strong>${booking.customerEmail}</strong> • Stakey's Cycles &amp; Scooter Automated Reminder Engine
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generates 24-Hour Reminder Email for Stakey's Cycles Workshop
 */
export function generateOwner24hReminderEmailHtml(booking: ServiceBooking, config: OwnerNotificationConfig): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Workshop Schedule Reminder - Stakey's Cycles</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0d0e; color: #ffffff; margin: 0; padding: 24px;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #141517; border-radius: 16px; border: 1px solid #27272a; overflow: hidden;">
    <tr>
      <td style="background-color: #05C147; padding: 20px; text-align: center;">
        <h1 style="color: #000000; margin: 0; font-size: 22px; font-weight: 900;">STAKEY'S WORKSHOP</h1>
      </td>
    </tr>
    <tr>
      <td style="background-color: #18181b; padding: 12px 24px; border-bottom: 1px solid #27272a; color: #34d399; font-size: 13px; font-weight: 700;">
        ⏰ 24-HOUR BENCH SCHEDULE REMINDER
      </td>
    </tr>
    <tr>
      <td style="padding: 24px;">
        <h3 style="color: #ffffff; margin: 0 0 12px 0;">Appointment Tomorrow: ${booking.customerName}</h3>
        <p style="color: #d4d4d8; font-size: 13px; margin: 0 0 16px 0;">
          <strong>Slot:</strong> ${booking.preferredDate} (${booking.preferredTimeSlot})<br/>
          <strong>Service:</strong> ${booking.serviceTitle}<br/>
          <strong>Vehicle:</strong> ${booking.vehicleModel}<br/>
          <strong>Customer Contact:</strong> ${booking.customerPhone} / ${booking.customerEmail}
        </p>
        <p style="color: #a1a1aa; font-size: 12px; margin: 0;">
          Automated customer reminder email was successfully delivered to ${booking.customerEmail}.
        </p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #090a0b; padding: 12px 24px; text-align: center; color: #71717a; font-size: 11px;">
        Recipient: ${config.ownerEmail} • Stakey's Cycles Staff Dispatch
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Creates pre-filled mailto URL for direct native email delivery
 */
export function createBookingMailtoUrl(booking: ServiceBooking, config: OwnerNotificationConfig): string {
  const subject = encodeURIComponent(
    `⚡ [STAKEYS] New Booking #${booking.id}: ${booking.serviceTitle} - ${booking.customerName}`
  );
  const body = encodeURIComponent(
    `STAKEY'S CYCLES & SCOOTER - WORKSHOP SERVICE BOOKING\n` +
    `--------------------------------------------------\n\n` +
    `Booking Reference: #${booking.id}\n` +
    `Service Requested: ${booking.serviceTitle}\n` +
    `Vehicle: ${booking.vehicleCategory.toUpperCase().replace('_', ' ')} (${booking.vehicleModel})\n` +
    `Scheduled Date: ${booking.preferredDate} (${booking.preferredTimeSlot})\n` +
    `Estimated Cost: £${booking.servicePrice.toFixed(2)}\n\n` +
    `CUSTOMER DETAILS:\n` +
    `Name: ${booking.customerName}\n` +
    `Phone: ${booking.customerPhone}\n` +
    `Email: ${booking.customerEmail}\n` +
    (booking.membershipNumber ? `Loyalty Member ID: ${booking.membershipNumber}\n` : '') +
    (booking.notes ? `Customer Notes: "${booking.notes}"\n\n` : '\n') +
    `Dispatched directly to ${config.ownerEmail}`
  );
  return `mailto:${config.ownerEmail}?subject=${subject}&body=${body}`;
}

/**
 * Creates pre-filled mailto URL to contact the customer
 */
export function createCustomerMailtoUrl(booking: ServiceBooking): string {
  const subject = encodeURIComponent(`Regarding your Stakey's Cycles Workshop Booking #${booking.id}`);
  const body = encodeURIComponent(
    `Hi ${booking.customerName},\n\nRegarding your ${booking.serviceTitle} appointment scheduled for ${booking.preferredDate} (${booking.preferredTimeSlot})...\n\nBest regards,\nStakey's Cycles Workshop Team`
  );
  return `mailto:${booking.customerEmail}?subject=${subject}&body=${body}`;
}

/**
 * Target appointment Date calculation for 24-hour reminder matching
 */
export function getBookingTargetDateTime(booking: ServiceBooking): Date {
  const dateStr = booking.preferredDate;
  if (!dateStr || !dateStr.includes('-')) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  }
  let hour = 9;
  const timeSlot = (booking.preferredTimeSlot || '').toLowerCase();
  if (timeSlot.includes('12:00') || timeSlot.includes('afternoon') || timeSlot.includes('midday')) {
    hour = 12;
  } else if (timeSlot.includes('15:00') || timeSlot.includes('late') || timeSlot.includes('evening')) {
    hour = 15;
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, hour, 0, 0);
}

/**
 * Calculates hours remaining until the booking's appointment
 */
export function getHoursUntilBooking(booking: ServiceBooking): number {
  const target = getBookingTargetDateTime(booking);
  const diffMs = target.getTime() - Date.now();
  return diffMs / (1000 * 60 * 60);
}

/**
 * Checks if a booking is due within approximately 24 hours (or scheduled for tomorrow)
 */
export function isBookingDueIn24Hours(booking: ServiceBooking): boolean {
  if (booking.status === 'completed' || booking.status === 'cancelled') {
    return false;
  }
  const hours = getHoursUntilBooking(booking);
  // Due within 36 hours and not in the past by more than 2 hours
  return hours > -2 && hours <= 36;
}

/** Normalises a partial settings object into a complete, in-range config. */
export function resolveReminderSettings(settings?: Partial<ReminderSettings> | null): ReminderSettings {
  const s = settings || {};
  const channel =
    s.channel === 'email' || s.channel === 'both' || s.channel === 'push'
      ? s.channel
      : DEFAULT_REMINDER_SETTINGS.channel;
  const recipients =
    s.recipients === 'customer' || s.recipients === 'owner' || s.recipients === 'both'
      ? s.recipients
      : DEFAULT_REMINDER_SETTINGS.recipients;
  return {
    channel,
    recipients,
    leadHours: clampNumber(s.leadHours, 1, 168, DEFAULT_REMINDER_SETTINGS.leadHours),
    repeatHours: clampNumber(s.repeatHours, 0, 168, DEFAULT_REMINDER_SETTINGS.repeatHours),
    quietStartHour: clampNumber(s.quietStartHour, 0, 23, DEFAULT_REMINDER_SETTINGS.quietStartHour),
    quietEndHour: clampNumber(s.quietEndHour, 0, 23, DEFAULT_REMINDER_SETTINGS.quietEndHour),
    quietHoursEnabled: s.quietHoursEnabled ?? DEFAULT_REMINDER_SETTINGS.quietHoursEnabled,
    ownerEmail: (s.ownerEmail ?? DEFAULT_REMINDER_SETTINGS.ownerEmail).trim(),
  };
}

/**
 * True when the local clock is inside the quiet window (no reminders are sent).
 * The window wraps midnight when start > end (e.g. 21:00–08:00).
 */
export function isWithinQuietHours(settings: ReminderSettings, now: Date = new Date()): boolean {
  if (!settings.quietHoursEnabled) return false;
  const { quietStartHour: start, quietEndHour: end } = settings;
  if (start === end) return false;
  const hour = now.getHours();
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

/** Hours since the booking's most recent reminder (Infinity if none sent). */
export function hoursSinceLastReminder(booking: ServiceBooking, now: Date = new Date()): number {
  const last = booking.reminderLastSentAt || booking.reminder24hSentAt;
  if (!last) return Infinity;
  const t = new Date(last).getTime();
  if (!Number.isFinite(t)) return Infinity;
  return (now.getTime() - t) / (1000 * 60 * 60);
}

/**
 * Decides whether a booking is due for a (further) reminder right now.
 *
 * - The first reminder goes out once the slot is within `leadHours`.
 * - With `repeatHours > 0`, further reminders repeat every `repeatHours` until
 *   the slot, so long as the booking hasn't started yet.
 * - Quiet hours suppress every send.
 */
export function isBookingDueForReminder(
  booking: ServiceBooking,
  settings?: Partial<ReminderSettings> | null,
  now: Date = new Date()
): boolean {
  if (booking.status === 'completed' || booking.status === 'cancelled') return false;
  const cfg = resolveReminderSettings(settings);
  if (isWithinQuietHours(cfg, now)) return false;

  const hoursUntil = getHoursUntilBooking(booking);
  // Never remind for a slot that is already more than 2 hours in the past.
  if (hoursUntil <= -2) return false;
  if (hoursUntil > cfg.leadHours) return false;

  const sent = booking.reminderCount ?? (booking.reminder24hSent ? 1 : 0);
  if (sent <= 0) return true;
  if (cfg.repeatHours <= 0) return false;
  return hoursSinceLastReminder(booking, now) >= cfg.repeatHours;
}

/**
 * Dispatches Email notifications exclusively for a new booking:
 * - Customer Confirmation Email confirming request details and pending approval
 * - Workshop Staff Email alert with booking details and customer contacts
 */
export async function dispatchBookingNotifications(
  booking: ServiceBooking,
  config: OwnerNotificationConfig
): Promise<DispatchResult> {
  const now = new Date();
  const sos = Boolean(booking.isSos);
  const ownerSubject = sos
    ? `🚨 [STAKEY'S WORKSHOP] SOS EMERGENCY #${booking.id}: ${booking.serviceTitle} (${booking.customerName})`
    : `⚡ [STAKEY'S WORKSHOP] New Booking #${booking.id}: ${booking.serviceTitle} (${booking.customerName})`;
  // High-importance headers so SOS mail is flagged in the workshop inbox.
  const importantHeaders: Record<string, string> | undefined = sos
    ? { 'Importance': 'high', 'X-Priority': '1', 'X-MSMail-Priority': 'High' }
    : undefined;

  // 1. Workshop Owner/Staff Email Log
  const emailLog: BookingNotificationLog = {
    id: `notif-email-owner-${Date.now()}-1`,
    type: 'email',
    recipient: config.ownerEmail,
    recipientRole: 'owner',
    category: 'booking_confirmation',
    subject: ownerSubject,
    content: generateBookingEmailHtml(booking, config),
    timestamp: now,
    status: 'delivered',
  };

  // 2. Customer Confirmation Email Log
  const customerEmailLog: BookingNotificationLog = {
    id: `notif-email-cust-${Date.now()}-2`,
    type: 'email',
    recipient: booking.customerEmail,
    recipientRole: 'customer',
    category: 'booking_confirmation',
    subject: `📋 Repair Request Received: ${booking.serviceTitle} (#${booking.id}) - Stakey's Cycles`,
    content: generateCustomerBookingEmailHtml(booking, config),
    timestamp: now,
    status: 'delivered',
  };

  // Live Email Gateway: Forward to Supabase Edge Function
  const failures: string[] = [];
  if (!config.ownerEmail || !config.emailAlertsEnabled) {
    const reason = !config.ownerEmail
      ? 'no workshop notification recipient is set'
      : 'email alerts are turned off in workshop settings';
    failures.push(`Workshop booking alert not sent: ${reason}.`);
    console.warn(`[STAKEYS EMAIL ENGINE] ⚠️ Skipped workshop alert — ${reason}.`);
  } else if (!shouldSendBookingEmail(booking.id, 'booking_confirmation')) {
    // This booking's confirmation has already been dispatched — never send twice.
    console.log(`[STAKEYS EMAIL ENGINE] ↺ Skipped duplicate confirmation for booking #${booking.id}.`);
  } else {
    try {
      const supabase = getSupabaseClient();
      const ownerSend = await supabase.functions.invoke('send-email', {
        body: {
          from: 'noreply@stakeyscycles.co.uk',
          to: config.ownerEmail,
          subject: ownerSubject,
          html: generateBookingEmailHtml(booking, config),
          ...(importantHeaders ? { headers: importantHeaders } : {}),
        },
      });

      const customerSend = await supabase.functions.invoke('send-email', {
        body: {
          from: 'noreply@stakeyscycles.co.uk',
          to: booking.customerEmail,
          subject: `📋 Repair Request Received: ${booking.serviceTitle} (#${booking.id}) - Stakey's Cycles`,
          html: generateCustomerBookingEmailHtml(booking, config),
        },
      });

      if (ownerSend.error) {
        failures.push(`Workshop booking alert failed: ${ownerSend.error.message}`);
        console.error(`[STAKEYS EMAIL ENGINE] ❌ Workshop alert email failed: ${ownerSend.error.message}`);
      } else {
        console.log(`[STAKEYS EMAIL ENGINE] ✅ Booking alert email sent to workshop (${config.ownerEmail})`);
      }
      if (customerSend.error) {
        failures.push(`Customer confirmation failed: ${customerSend.error.message}`);
        console.error(`[STAKEYS EMAIL ENGINE] ❌ Customer confirmation email failed: ${customerSend.error.message}`);
      } else {
        console.log(`[STAKEYS EMAIL ENGINE] ✅ Confirmation email sent to customer (${booking.customerEmail})`);
      }
    } catch (err) {
      failures.push(`Booking emails failed: ${(err as Error).message || String(err)}`);
      console.error('[EMAIL ENGINE] Failed to dispatch via Edge Function:', err);
    }
  }

  return {
    emailLog,
    customerEmailLog,
    timestamp: now.toISOString(),
    failures,
  };
}

/**
 * Sends a one-off test email to the configured workshop recipient so staff can
 * verify the live email gateway is wired up, without creating a booking.
 */
export async function dispatchTestEmail(
  config: OwnerNotificationConfig
): Promise<{ success: boolean; message?: string }> {
  if (!config.ownerEmail) {
    return { success: false, message: 'Set a notification recipient email first.' };
  }
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.functions.invoke('send-email', {
      body: {
        from: 'noreply@stakeyscycles.co.uk',
        to: config.ownerEmail,
        subject: "⚡ [STAKEY'S WORKSHOP] Test Notification",
        html: `<div style="font-family:sans-serif;padding:24px;background:#0c0d0e;color:#fff">
          <h2 style="color:#05C147">Stakey's Cycles — Test Alert</h2>
          <p>This is a test email confirming your workshop notification recipient is correctly configured.</p>
          <p style="color:#a1a1aa">Recipient: <strong>${config.ownerEmail}</strong></p>
          <p style="color:#a1a1aa">Sent: ${new Date().toLocaleString()}</p>
        </div>`,
      },
    });
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.warn('[EMAIL ENGINE] Test email dispatch failed:', err?.message || err);
    return { success: false, message: err?.message || 'Email gateway unavailable.' };
  }
}

/**
 * Dispatches a booking reminder. The channel (push / email / both), the
 * recipients (customer / workshop / both) and the workshop push inbox are all
 * configurable — see `ReminderSettings` and the staff app's Reminder Manager.
 * Repeat reminders are scheduled by `isBookingDueForReminder`.
 */
export async function dispatch24hReminderNotification(
  booking: ServiceBooking,
  config: OwnerNotificationConfig,
  options: {
    settings?: Partial<ReminderSettings>;
    /** Legacy shortcut: force push-only (overrides settings.channel). */
    pushOnly?: boolean;
    /** Legacy: workshop push inbox (overrides settings.ownerEmail). */
    ownerReminderEmail?: string;
    /** 1-based reminder number, recorded on the log for auditing. */
    reminderNumber?: number;
  } = {}
): Promise<{
  customerReminderLog: BookingNotificationLog;
  ownerReminderLog: BookingNotificationLog;
  updatedBooking: ServiceBooking;
}> {
  const now = new Date();
  const cfg = resolveReminderSettings(options.settings);
  // Legacy `pushOnly` flag still forces a single channel when present.
  const channel: ReminderChannel =
    options.pushOnly === true ? 'push' : options.pushOnly === false ? 'email' : cfg.channel;
  const usePush = channel === 'push' || channel === 'both';
  const useEmail = channel === 'email' || channel === 'both';
  const sendCustomer = cfg.recipients === 'customer' || cfg.recipients === 'both';
  const sendOwner = cfg.recipients === 'owner' || cfg.recipients === 'both';
  const ownerReminderEmail = (options.ownerReminderEmail || cfg.ownerEmail || config.ownerEmail || '').trim();
  const reminderNumber = options.reminderNumber ?? (booking.reminderCount ?? (booking.reminder24hSent ? 1 : 0)) + 1;

  const customerSubject = `⏰ Service Slot Reminder: Stakey's Cycles Workshop (#${booking.id})`;
  const ownerSubject = `⏰ Workshop Slot Reminder: ${booking.customerName} (${booking.preferredDate})`;
  const pushBody = `${booking.serviceTitle} for ${booking.vehicleModel} is scheduled ${booking.preferredDate} (${booking.preferredTimeSlot}).`;
  const reminderId = `${reminderNumber}-${now.getTime()}`;

  // 1. Customer reminder log
  const customerReminderLog: BookingNotificationLog = {
    id: `notif-rem-cust-${reminderId}-1`,
    type: usePush && !useEmail ? 'push' : 'email',
    recipient: booking.customerEmail,
    recipientRole: 'customer',
    category: 'reminder_24h',
    subject: customerSubject,
    content: useEmail ? generateCustomer24hReminderEmailHtml(booking, config) : pushBody,
    timestamp: now,
    status: 'delivered',
  };

  // 2. Workshop reminder log
  const ownerReminderLog: BookingNotificationLog = {
    id: `notif-rem-owner-${reminderId}-2`,
    type: usePush && !useEmail ? 'push' : 'email',
    recipient: ownerReminderEmail,
    recipientRole: 'owner',
    category: 'reminder_24h',
    subject: ownerSubject,
    content: useEmail ? generateOwner24hReminderEmailHtml(booking, config) : pushBody,
    timestamp: now,
    status: 'delivered',
  };

  const updatedBooking: ServiceBooking = {
    ...booking,
    reminder24hSent: true,
    reminder24hSentAt: now.toISOString(),
    reminder24hDeliveryStatus: 'delivered',
    reminderCount: reminderNumber,
    reminderLastSentAt: now.toISOString(),
    notifications: [...(booking.notifications || []), customerReminderLog, ownerReminderLog],
  };

  // A reminder is dispatched at most once per interval, even if several devices
  // run the background check at the same time.
  if (!shouldSendBookingEmail(booking.id, 'reminder_24h')) {
    console.log(`[REMINDER ENGINE] ↺ Skipped duplicate reminder for booking #${booking.id}.`);
    return { customerReminderLog, ownerReminderLog, updatedBooking };
  }

  const pushTasks: Promise<unknown>[] = [];
  if (usePush && sendCustomer) {
    pushTasks.push(
      sendPushToUser(booking.customerId, customerSubject, pushBody).catch((err) =>
        console.error('[REMINDER ENGINE] customer push failed:', err)
      )
    );
  }
  if (usePush && sendOwner && ownerReminderEmail) {
    pushTasks.push(
      sendPushToUser(undefined, ownerSubject, `${booking.customerName}: ${pushBody}`, undefined, {
        tag: { key: 'owner_email', value: ownerReminderEmail },
      }).catch((err) => console.error('[REMINDER ENGINE] owner push failed:', err))
    );
  }
  if (pushTasks.length) {
    await Promise.all(pushTasks);
    console.log(`[REMINDER ENGINE] 🔔 Sent reminder push #${reminderNumber} for booking #${booking.id}`);
  }

  if (useEmail) {
    const supabase = getSupabaseClient();
    const reminderHtml: Record<string, string> = {
      customer: generateCustomer24hReminderEmailHtml(booking, config),
      owner: generateOwner24hReminderEmailHtml(booking, config),
    };
    const sends = [
      ...(sendCustomer
        ? [{ to: booking.customerEmail, subject: customerReminderLog.subject, html: reminderHtml.customer, who: 'customer' }]
        : []),
      ...(sendOwner && ownerReminderEmail
        ? [{ to: ownerReminderEmail, subject: ownerReminderLog.subject, html: reminderHtml.owner, who: 'workshop' }]
        : []),
    ].filter((send): send is { to: string; subject: string; html: string; who: string } => Boolean(send.to));

    for (const send of sends) {
      try {
        const { error } = await supabase.functions.invoke('send-email', {
          body: {
            from: 'noreply@stakeyscycles.co.uk',
            to: send.to,
            subject: send.subject,
            html: send.html,
          },
        });
        if (error) {
          console.error(`[REMINDER ENGINE] ❌ ${send.who} reminder failed: ${error.message}`);
        } else {
          console.log(`[REMINDER ENGINE] ⏰ Sent reminder email to ${send.who} (${send.to})`);
        }
      } catch (err) {
        console.error(`[REMINDER ENGINE] Failed to send ${send.who} reminder:`, err);
      }
    }
  }

  return {
    customerReminderLog,
    ownerReminderLog,
    updatedBooking,
  };
}

/**
 * SOS Emergency Repair — alert the workshop owner's devices over OneSignal.
 *
 * These are deliberately owner-only pushes (tagged `owner_email`), because an
 * SOS job is a "drop everything and dispatch" event for the shop owner. The
 * push fires for each milestone: the customer requesting, staff approving, the
 * quote being sent and the rider confirming the price.
 */
export async function dispatchSosNotification(
  booking: ServiceBooking,
  config: OwnerNotificationConfig,
  stage: 'requested' | 'approved' | 'quoted' | 'confirmed',
  options: { ownerReminderEmail?: string; quotedPrice?: number } = {}
): Promise<BookingNotificationLog> {
  const now = new Date();
  const ownerEmail = (options.ownerReminderEmail || config.ownerEmail || '').trim();

  const { title, body } = sosPushCopy(stage, booking, { quotedPrice: options.quotedPrice });
  const url = bookingDeepLink(booking.id);

  const log: BookingNotificationLog = {
    id: `notif-sos-${stage}-${Date.now()}`,
    type: 'push',
    recipient: ownerEmail,
    recipientRole: 'owner',
    category: 'sos_emergency',
    subject: title,
    content: body,
    timestamp: now,
    status: 'delivered',
  };

  if (ownerEmail) {
    await sendPushToUser(
      undefined,
      title,
      body,
      url,
      { tag: { key: 'owner_email', value: ownerEmail } }
    ).catch((err) => console.error(`[SOS] owner push (${stage}) failed:`, err));
  }

  console.log(`[SOS] 🔔 Sent SOS ${stage} push to owner devices (${ownerEmail || 'no owner email set'})`);
  return log;
}

/**
 * Generates branded HTML email sent to customer when their repair booking is APPROVED
 */
export function generateBookingApprovalEmailHtml(
  booking: ServiceBooking,
  staffNote?: string,
  config?: OwnerNotificationConfig
): string {
  const shopPhone = config?.ownerPhone || '+44 7388 209102';
  const shopEmail = config?.ownerEmail || 'workshop@stakeyscycles.com';
  const v = vehicleNouns(booking.vehicleCategory);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Repair Booking Approved - Stakey's Cycles &amp; Scooter</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0d0e; color: #ffffff; margin: 0; padding: 24px;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #141517; border-radius: 16px; border: 1px solid #27272a; overflow: hidden;">
    <!-- Header with Stakey's Branding -->
    <tr>
      <td style="background-color: #05C147; padding: 26px; text-align: center;">
        <h1 style="color: #000000; margin: 0; font-size: 26px; font-weight: 900; letter-spacing: 2px;">STAKEY'S</h1>
        <p style="color: #000000; margin: 4px 0 0 0; font-size: 13px; font-weight: 700; letter-spacing: 1px;">CYCLES &amp; SCOOTER WORKSHOP</p>
      </td>
    </tr>

    <!-- Success Status Banner -->
    <tr>
      <td style="background-color: #064e3b; padding: 14px 24px; border-bottom: 1px solid #059669; color: #6ee7b7; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; text-align: center;">
        ✅ REPAIR BOOKING APPROVED BY WORKSHOP STAFF
      </td>
    </tr>

    <!-- Main Message -->
    <tr>
      <td style="padding: 28px 24px;">
        <h2 style="color: #ffffff; font-size: 20px; margin: 0 0 8px 0;">Great news, ${booking.customerName}!</h2>
        <p style="color: #d4d4d8; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
          Our workshop mechanics have reviewed your service request. Your ${v.noun} repair appointment has been <strong style="color: #05C147;">OFFICIALLY APPROVED</strong> and scheduled on our workbench.
        </p>

        <!-- Booking Summary Card -->
        <table width="100%" border="0" cellspacing="0" cellpadding="10" style="background-color: #18181b; border-radius: 12px; margin-bottom: 22px; border: 1px solid #27272a;">
          <tr>
            <td style="color: #a1a1aa; font-size: 13px; width: 35%; border-bottom: 1px solid #27272a;">Booking Ref:</td>
            <td style="color: #ffffff; font-size: 14px; font-weight: 700; font-family: monospace; border-bottom: 1px solid #27272a;">#${booking.id}</td>
          </tr>
          <tr>
            <td style="color: #a1a1aa; font-size: 13px; border-bottom: 1px solid #27272a;">Approved Drop-Off:</td>
            <td style="color: #05C147; font-size: 15px; font-weight: 800; border-bottom: 1px solid #27272a;">
              📅 ${booking.preferredDate} (${booking.preferredTimeSlot})
            </td>
          </tr>
          <tr>
            <td style="color: #a1a1aa; font-size: 13px; border-bottom: 1px solid #27272a;">Service Booked:</td>
            <td style="color: #ffffff; font-size: 14px; font-weight: 700; border-bottom: 1px solid #27272a;">${booking.serviceTitle}</td>
          </tr>
          <tr>
            <td style="color: #a1a1aa; font-size: 13px; border-bottom: 1px solid #27272a;">Vehicle:</td>
            <td style="color: #ffffff; font-size: 14px; border-bottom: 1px solid #27272a;">${booking.vehicleModel}</td>
          </tr>
          <tr>
            <td style="color: #a1a1aa; font-size: 13px;">${booking.quotedPrice != null ? 'Estimated Quote:' : 'Estimated Labour:'}</td>
            <td style="color: #34d399; font-size: 15px; font-weight: 700;">${booking.quotedPrice != null ? `£${booking.quotedPrice.toFixed(2)}` : 'Confirmed on inspection'}</td>
          </tr>
        </table>

        ${booking.quotedPrice != null ? `
        <div style="background-color: #0b3a2e; border: 1px solid #10b981; border-radius: 12px; padding: 14px; margin-bottom: 22px;">
          <div style="color: #6ee7b7; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">Your Estimated Quote</div>
          ${booking.quoteNote ? `<div style="color: #ecfdf5; font-size: 13px; line-height: 1.6;">${booking.quoteNote}</div>` : ''}
          <div style="margin-top: 8px; color: #34d399; font-size: 16px; font-weight: 800;">Estimated Total: £${booking.quotedPrice.toFixed(2)}</div>
          <div style="margin-top: 4px; color: #a7f3d0; font-size: 11px;">This is an estimate. The final price is confirmed once we have inspected your ${v.noun}.</div>
        </div>
        ` : ''}

        ${staffNote ? `
        <div style="background-color: #022c22; border: 1px solid #059669; border-radius: 12px; padding: 14px; margin-bottom: 22px;">
          <div style="color: #6ee7b7; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">Mechanic Note:</div>
          <div style="color: #ecfdf5; font-size: 13px; font-style: italic;">"${staffNote}"</div>
        </div>
        ` : ''}

        <!-- Drop-off instructions -->
        <h3 style="color: #d4d4d8; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0;">Drop-Off Instructions</h3>
        <ul style="color: #a1a1aa; font-size: 13px; line-height: 1.6; margin: 0 0 24px 0; padding-left: 20px;">
          <li>Please bring your ${v.noun} to <strong>Stakey's Workshop (Unit 4, Workshop Lane)</strong> during your booked window.</li>
          ${v.category === 'ebike' || v.category === 'electric_scooter' ? '<li>Remember to bring the battery key and charging cable for your ' + v.noun + '.</li>' : ''}
          <li>All notifications and status updates are communicated exclusively via email to <strong style="color: #ffffff;">${booking.customerEmail}</strong>.</li>
        </ul>

        <!-- Contact Buttons -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center">
              <a href="mailto:${shopEmail}?subject=Regarding Approved Booking #${booking.id}" style="background-color: #05C147; color: #000000; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 800; font-size: 14px; display: inline-block; margin-right: 10px;">
                ✉️ Email Workshop: ${shopEmail}
              </a>
              <a href="tel:${shopPhone}" style="background-color: #27272a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">
                📞 Call Workshop: ${shopPhone}
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #090a0b; padding: 16px 24px; text-align: center; border-top: 1px solid #27272a; color: #71717a; font-size: 12px;">
        Sent to <strong>${booking.customerEmail}</strong> • Stakey's Cycles &amp; Scooter Workshop
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generates branded HTML email sent to customer when their repair booking is DECLINED
 */
export function generateBookingDeclinedEmailHtml(
  booking: ServiceBooking,
  reason?: string,
  config?: OwnerNotificationConfig
): string {
  const shopPhone = config?.ownerPhone || '+44 7388 209102';
  const shopEmail = config?.ownerEmail || 'workshop@stakeyscycles.com';
  const v = vehicleNouns(booking.vehicleCategory);
  const declineExplanation = reason || 'Our workshop workbench is currently at maximum capacity for the requested date and time.';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Repair Booking Update - Stakey's Cycles &amp; Scooter</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0d0e; color: #ffffff; margin: 0; padding: 24px;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #141517; border-radius: 16px; border: 1px solid #27272a; overflow: hidden;">
    <!-- Header with Stakey's Branding -->
    <tr>
      <td style="background-color: #18181b; padding: 26px; text-align: center; border-bottom: 2px solid #ef4444;">
        <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 900; letter-spacing: 2px;">STAKEY'S</h1>
        <p style="color: #a1a1aa; margin: 4px 0 0 0; font-size: 13px; font-weight: 700; letter-spacing: 1px;">CYCLES &amp; SCOOTER WORKSHOP</p>
      </td>
    </tr>

    <!-- Decline Notice Banner -->
    <tr>
      <td style="background-color: #450a0a; padding: 14px 24px; border-bottom: 1px solid #991b1b; color: #fca5a5; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; text-align: center;">
        ⚠️ WORKSHOP BOOKING REQUEST UPDATE
      </td>
    </tr>

    <!-- Main Message -->
    <tr>
      <td style="padding: 28px 24px;">
        <h2 style="color: #ffffff; font-size: 20px; margin: 0 0 8px 0;">Hello ${booking.customerName},</h2>
        <p style="color: #d4d4d8; font-size: 14px; line-height: 1.6; margin: 0 0 18px 0;">
          Thank you for reaching out to Stakey's Cycles &amp; Scooter. Our mechanics have reviewed your repair request for <strong style="color: #ffffff;">${booking.serviceTitle}</strong> on <strong style="color: #ffffff;">${booking.preferredDate}</strong>.
        </p>
        <p style="color: #d4d4d8; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
          Unfortunately, we are <strong style="color: #ef4444;">unable to approve your requested slot at this time</strong>.
        </p>

        <!-- Reason Card -->
        <div style="background-color: #27272a; border-left: 4px solid #ef4444; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <div style="color: #fca5a5; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 6px;">Reason from Mechanic:</div>
          <div style="color: #ffffff; font-size: 14px; line-height: 1.5;">${declineExplanation}</div>
        </div>

        <!-- Next Steps -->
        <h3 style="color: #d4d4d8; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0;">How We Can Still Help You</h3>
        <p style="color: #a1a1aa; font-size: 13px; line-height: 1.6; margin: 0 0 20px 0;">
          We would love to get your ${v.noun} repaired as soon as possible. Please reply directly to this email or call our workshop to choose an alternative date. We often have walk-in emergency slots or dates later in the week!
        </p>

        <!-- Action Buttons -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center">
              <a href="mailto:${shopEmail}?subject=Alternative Slot for Booking #${booking.id}" style="background-color: #05C147; color: #000000; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block; margin-right: 10px;">
                ✉️ Email Workshop: ${shopEmail}
              </a>
              <a href="tel:${shopPhone}" style="background-color: #27272a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">
                📞 Call Workshop: ${shopPhone}
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #090a0b; padding: 16px 24px; text-align: center; border-top: 1px solid #27272a; color: #71717a; font-size: 12px;">
        Sent to <strong>${booking.customerEmail}</strong> • Booking Ref #${booking.id}
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Dispatches Approval notification exclusively via Email
 */
export async function dispatchBookingApprovalNotification(
  booking: ServiceBooking,
  staffNote: string | undefined,
  config: OwnerNotificationConfig
): Promise<{ emailLog: BookingNotificationLog; sent: boolean; error?: string }> {
  const now = new Date();

  const emailLog: BookingNotificationLog = {
    id: `notif-email-appr-${Date.now()}`,
    type: 'email',
    recipient: booking.customerEmail,
    recipientRole: 'customer',
    category: 'booking_approved',
    subject: `✅ APPROVED: Stakey's Workshop Repair Booking #${booking.id} (${booking.preferredDate})`,
    content: generateBookingApprovalEmailHtml(booking, staffNote, config),
    timestamp: now,
    status: 'delivered',
  };

  // Approving the same booking twice must not email the customer twice.
  if (!shouldSendBookingEmail(booking.id, 'booking_approved')) {
    console.log(`[APPROVAL NOTIFICATION] ↺ Skipped duplicate approval email for booking #${booking.id}.`);
    return { emailLog, sent: true };
  }

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.functions.invoke('send-email', {
      body: {
        from: 'noreply@stakeyscycles.co.uk',
        to: booking.customerEmail,
        subject: emailLog.subject,
        html: emailLog.content,
      },
    });
    if (error) {
      console.error(`[APPROVAL NOTIFICATION] ❌ Approval email failed: ${error.message}`);
      return { emailLog, sent: false, error: error.message };
    }
  } catch (err: any) {
    console.error('[APPROVAL NOTIFICATION] Failed to send via Edge Function:', err);
    return { emailLog, sent: false, error: err?.message || 'Email delivery failed' };
  }

  console.log(`[APPROVAL NOTIFICATION] ✅ Sent Approval Email to ${booking.customerEmail}`);

  return { emailLog, sent: true };
}

/**
 * Dispatches Decline notification exclusively via Email
 */
export async function dispatchBookingDeclinedNotification(
  booking: ServiceBooking,
  reason: string | undefined,
  config: OwnerNotificationConfig
): Promise<{ emailLog: BookingNotificationLog }> {
  const now = new Date();

  const emailLog: BookingNotificationLog = {
    id: `notif-email-decl-${Date.now()}`,
    type: 'email',
    recipient: booking.customerEmail,
    recipientRole: 'customer',
    category: 'booking_declined',
    subject: `⚠️ UPDATE: Your Stakey's Repair Booking #${booking.id} could not be approved`,
    content: generateBookingDeclinedEmailHtml(booking, reason, config),
    timestamp: now,
    status: 'delivered',
  };

  // Declining the same booking twice must not email the customer twice.
  if (!shouldSendBookingEmail(booking.id, 'booking_declined')) {
    console.log(`[DECLINE NOTIFICATION] ↺ Skipped duplicate decline email for booking #${booking.id}.`);
    return { emailLog };
  }

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.functions.invoke('send-email', {
      body: {
        from: 'noreply@stakeyscycles.co.uk',
        to: booking.customerEmail,
        subject: emailLog.subject,
        html: emailLog.content,
      },
    });
    if (error) {
      console.error(`[DECLINE NOTIFICATION] ❌ Declined email failed: ${error.message}`);
      return { emailLog };
    }
  } catch (err) {
    console.error('[DECLINE NOTIFICATION] Failed to send via Edge Function:', err);
    return { emailLog };
  }

  console.log(`[DECLINE NOTIFICATION] ✅ Sent Declined Email to ${booking.customerEmail}`);

  return { emailLog };
}
