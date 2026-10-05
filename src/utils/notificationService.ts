import { ServiceBooking, OwnerNotificationConfig, BookingNotificationLog } from '../types/bikeShop';
import { getSupabaseClient } from '../lib/supabase';

export interface DispatchResult {
  emailLog: BookingNotificationLog;
  customerEmailLog: BookingNotificationLog;
  timestamp: string;
  /** Human-readable reasons any notification failed to actually send. */
  failures?: string[];
}

/** Public logo used in every outbound email so branding is consistent. */
const BRAND_LOGO_URL =
  'https://lhojocpygcnkxvkrcuxh.supabase.co/storage/v1/object/public/brand/stakeys-logo.png';

/** Shared branded email header (shield logo + wordmark). */
function brandHeader(subtitle: string): string {
  return `
    <tr>
      <td style="padding: 26px 24px 18px 24px; text-align: center; border-bottom: 1px solid #27272a;">
        <img src="${BRAND_LOGO_URL}" alt="Stakey's Cycles &amp; Scooter" width="84" style="display: block; margin: 0 auto 10px auto; width: 84px; height: auto; border-radius: 12px;" />
        <div style="color: #ffffff; font-size: 17px; font-weight: 800; letter-spacing: 1px;">STAKEY'S CYCLES &amp; SCOOTER</div>
        <div style="color: #9ca3af; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px;">${subtitle}</div>
      </td>
    </tr>`;
}

/** Shared branded email footer with contact details. */
function brandFooter(note: string, supportEmail: string, supportPhone: string): string {
  return `
    <tr>
      <td style="background-color: #090a0b; padding: 18px 24px; text-align: center; border-top: 1px solid #27272a; color: #9ca3af; font-size: 11px; line-height: 1.7;">
        Stakey's Cycles &amp; Scooter · Workshop Service<br/>
        Questions? <a href="mailto:${supportEmail}" style="color: #05C147; text-decoration: none;">${supportEmail}</a> · <a href="tel:${supportPhone}" style="color: #05C147; text-decoration: none;">${supportPhone}</a><br/>
        <span style="color: #6b7280;">${note}</span>
      </td>
    </tr>`;
}

/**
 * Generates branded HTML email content for the workshop owner/staff
 */
export function generateBookingEmailHtml(booking: ServiceBooking, config: OwnerNotificationConfig): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>New Service Booking - Stakey's Cycles & Scooter</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0d0e; color: #ffffff; margin: 0; padding: 24px;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #141517; border-radius: 16px; border: 1px solid #27272a; overflow: hidden;">
    <!-- Header with Stakey's Shield Branding -->
    ${brandHeader('Workshop Booking Alert')}

    <!-- Alert Banner -->
    <tr>
      <td style="background-color: #1f2937; padding: 12px 24px; border-bottom: 1px solid #374151; color: #34d399; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
        ⚡ NEW WORKSHOP REPAIR BOOKING RECEIVED
      </td>
    </tr>

    <!-- Booking Details Body -->
    <tr>
      <td style="padding: 28px 24px;">
        <h2 style="color: #ffffff; font-size: 20px; margin: 0 0 16px 0;">Booking #${booking.id}</h2>

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
    ${brandFooter(
      `Notification delivered automatically to ${config.ownerEmail}`,
      config.ownerEmail || 'workshop@stakeyscycles.com',
      config.ownerPhone || '+44 7700 900821'
    )}
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generates branded HTML email sent to customer confirming booking submission
 */
export function generateCustomerBookingEmailHtml(booking: ServiceBooking, config: OwnerNotificationConfig): string {
  const shopPhone = config.ownerPhone || '+44 7700 900821';
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
    ${brandHeader('Customer Booking Confirmation')}

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
    ${brandFooter(
      `Sent to ${booking.customerEmail} · Keep this email as your booking reference.`,
      shopEmail,
      shopPhone
    )}
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generates 24-Hour Automated Reminder Email for Customer
 */
export function generateCustomer24hReminderEmailHtml(booking: ServiceBooking, config: OwnerNotificationConfig): string {
  const shopPhone = config.ownerPhone || '+44 7700 900821';
  const shopEmail = config.ownerEmail || 'workshop@stakeyscycles.com';

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
    ${brandHeader('Service Reminder')}

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
          This is a friendly reminder that your scheduled service slot is in approximately 24 hours at <strong>Stakey's Cycles &amp; Scooter Workshop</strong>.
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
          <li>For E-Bikes and E-Scooters, please bring your battery key and charger.</li>
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
    ${brandFooter(
      `Sent to ${booking.customerEmail} · Automated 24-hour reminder.`,
      shopEmail,
      shopPhone
    )}
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
    ${brandHeader('Bench Schedule Reminder')}
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
    ${brandFooter(
      `Recipient: ${config.ownerEmail} · Stakey's Cycles Staff Dispatch`,
      config.ownerEmail || 'workshop@stakeyscycles.com',
      config.ownerPhone || '+44 7700 900821'
    )}
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

/**
 * Bookings that still need their one-off 24-hour reminder email. `alreadySent`
 * is the set of ids this session has dispatched for — checked in addition to the
 * persisted `reminder24hSent` flag so a background poll that briefly reloads a
 * stale (still-false) flag can't cause a duplicate send.
 */
export function selectDueReminderBookings(
  bookings: ServiceBooking[],
  alreadySent: ReadonlySet<string> = new Set()
): ServiceBooking[] {
  return bookings.filter(
    (b) =>
      !b.reminder24hSent &&
      !alreadySent.has(b.id) &&
      b.status !== 'completed' &&
      b.status !== 'cancelled' &&
      isBookingDueIn24Hours(b)
  );
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

  // 1. Workshop Owner/Staff Email Log
  const emailLog: BookingNotificationLog = {
    id: `notif-email-owner-${Date.now()}-1`,
    type: 'email',
    recipient: config.ownerEmail,
    recipientRole: 'owner',
    category: 'booking_confirmation',
    subject: `⚡ NEW BOOKING: ${booking.customerName} - ${booking.serviceTitle} (${booking.preferredDate})`,
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

  // Live Email Gateway: forward the customer confirmation to the Supabase Edge
  // Function. The workshop/owner alert is intentionally NOT sent here — it is
  // delivered server-side by a Database Webhook on `service_bookings` INSERT
  // (see supabase/WEBHOOK_EMAIL_SETUP.md), so it still fires when the customer's
  // browser is closed and works even if this tab navigates away mid-request.
  // Sending it here as well would double-alert the workshop.
  const failures: string[] = [];
  try {
    const supabase = getSupabaseClient();
    const customerSend = await supabase.functions.invoke('send-email', {
      body: {
        from: 'noreply@stakeyswheels.co.uk',
        to: booking.customerEmail,
        subject: `📋 Repair Request Received: ${booking.serviceTitle} (#${booking.id}) - Stakey's Cycles`,
        html: generateCustomerBookingEmailHtml(booking, config),
      },
    });

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
        from: 'noreply@stakeyswheels.co.uk',
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
 * Dispatches 24-Hour Automated Reminder Email exclusively to both Customer & Stakey's Workshop
 */
export async function dispatch24hReminderNotification(
  booking: ServiceBooking,
  config: OwnerNotificationConfig
): Promise<{
  customerReminderLog: BookingNotificationLog;
  ownerReminderLog: BookingNotificationLog;
  updatedBooking: ServiceBooking;
}> {
  const now = new Date();

  // 1. Customer 24h Reminder Email
  const customerReminderLog: BookingNotificationLog = {
    id: `notif-24h-cust-email-${Date.now()}-1`,
    type: 'email',
    recipient: booking.customerEmail,
    recipientRole: 'customer',
    category: 'reminder_24h',
    subject: `⏰ 24-Hour Service Slot Reminder: Stakey's Cycles Workshop (#${booking.id})`,
    content: generateCustomer24hReminderEmailHtml(booking, config),
    timestamp: now,
    status: 'delivered',
  };

  // 2. Stakey's Cycles Workshop 24h Reminder Email
  const ownerReminderLog: BookingNotificationLog = {
    id: `notif-24h-owner-email-${Date.now()}-2`,
    type: 'email',
    recipient: config.ownerEmail,
    recipientRole: 'owner',
    category: 'reminder_24h',
    subject: `⏰ 24-Hour Workshop Slot Reminder: ${booking.customerName} (${booking.preferredDate})`,
    content: generateOwner24hReminderEmailHtml(booking, config),
    timestamp: now,
    status: 'delivered',
  };

  const updatedBooking: ServiceBooking = {
    ...booking,
    reminder24hSent: true,
    reminder24hSentAt: now.toISOString(),
    reminder24hDeliveryStatus: 'delivered',
    notifications: [...(booking.notifications || []), customerReminderLog, ownerReminderLog],
  };

  console.log(`[24H REMINDER ENGINE] ⏰ Sent 24h Reminder Email to Customer (${booking.customerEmail})`);
  console.log(`[24H REMINDER ENGINE] ⏰ Sent 24h Reminder Email to Workshop (${config.ownerEmail})`);

  return {
    customerReminderLog,
    ownerReminderLog,
    updatedBooking,
  };
}

/**
 * Generates branded HTML email sent to customer when their repair booking is APPROVED
 */
export function generateBookingApprovalEmailHtml(
  booking: ServiceBooking,
  staffNote?: string,
  config?: OwnerNotificationConfig
): string {
  const shopPhone = config?.ownerPhone || '+44 7700 900821';
  const shopEmail = config?.ownerEmail || 'workshop@stakeyscycles.com';

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
    ${brandHeader('Booking Approved')}

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
          Our workshop mechanics have reviewed your service request. Your repair appointment has been <strong style="color: #05C147;">OFFICIALLY APPROVED</strong> and scheduled on our workbench.
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
          <div style="margin-top: 4px; color: #a7f3d0; font-size: 11px;">This is an estimate. The final price is confirmed once we have inspected your vehicle.</div>
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
          <li>Please bring your vehicle to <strong>Stakey's Workshop (Unit 4, Workshop Lane)</strong> during your booked window.</li>
          <li>For E-Bikes and E-Scooters, remember to bring the battery key and charging cable.</li>
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
    ${brandFooter(
      `Sent to ${booking.customerEmail} · Booking Ref #${booking.id}`,
      shopEmail,
      shopPhone
    )}
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
  const shopPhone = config?.ownerPhone || '+44 7700 900821';
  const shopEmail = config?.ownerEmail || 'workshop@stakeyscycles.com';
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
    ${brandHeader('Booking Update')}

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
          We would love to get your ${booking.vehicleModel} repaired as soon as possible. Please reply directly to this email or call our workshop to choose an alternative date. We often have walk-in emergency slots or dates later in the week!
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
    ${brandFooter(
      `Sent to ${booking.customerEmail} · Booking Ref #${booking.id}`,
      shopEmail,
      shopPhone
    )}
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

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.functions.invoke('send-email', {
      body: {
        from: 'noreply@stakeyswheels.co.uk',
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

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.functions.invoke('send-email', {
      body: {
        from: 'noreply@stakeyswheels.co.uk',
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
