/**
 * Shop WhatsApp helper. A single place for the workshop number and for building
 * a pre-filled "request a quote" link, so customers can send bespoke job details
 * straight to the workshop instead of being told to "ask for a quote".
 */
export const SHOP_WHATSAPP_NUMBER = '447911882910';

/** Builds a wa.me link with the given message, URL-encoded for the chat body. */
export function buildWhatsAppUrl(message: string, number: string = SHOP_WHATSAPP_NUMBER): string {
  const digits = number.replace(/[^0-9]/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** Builds the pre-filled custom-quote message for a booking enquiry. */
export function buildBookingQuoteMessage(details: {
  vehicle?: string;
  service?: string;
  preferredDate?: string;
  preferredTimeSlot?: string;
}): string {
  const lines = ["Hi Stakey's Cycles, I'd like a quote for a custom job:"];
  if (details.vehicle) lines.push(`• Vehicle: ${details.vehicle}`);
  if (details.service) lines.push(`• Service: ${details.service}`);
  if (details.preferredDate) {
    lines.push(
      `• Preferred drop-off: ${details.preferredDate}${
        details.preferredTimeSlot ? ` (${details.preferredTimeSlot})` : ''
      }`
    );
  }
  lines.push('• Details/photos: ');
  return lines.join('\n');
}
