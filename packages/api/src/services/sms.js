/**
 * SMS Service — Twilio stub
 * Logs messages to console. Wire up Twilio credentials to send real SMS.
 */

export async function sendSMS(to, message) {
  console.log(`[SMS STUB] To: ${to}`);
  console.log(`[SMS STUB] Message: ${message}`);
  console.log(`[SMS STUB] ---`);

  // Twilio integration (uncomment when credentials are available):
  // import twilio from 'twilio';
  // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  // await client.messages.create({
  //   body: message,
  //   from: process.env.TWILIO_FROM_PHONE,
  //   to,
  // });

  return { success: true, stub: true };
}

export async function sendCaregiverAlert(caregiverPhone, caregiverName, patientName, alertType, details) {
  if (!caregiverPhone) {
    console.log('[SMS STUB] No caregiver phone — skipping alert');
    return;
  }

  let message;
  switch (alertType) {
    case 'consecutive_failure_2':
      message = `Hi ${caregiverName || 'Caregiver'}, ${patientName || 'Your patient'} has missed 2 consecutive medicine doses. Please check in with them. — MedRem`;
      break;
    case 'consecutive_failure_5':
      message = `URGENT: Hi ${caregiverName || 'Caregiver'}, ${patientName || 'Your patient'} has missed 5 consecutive doses. Details: ${details}. Immediate attention may be needed. — MedRem`;
      break;
    case 'partial_success':
      message = `Hi ${caregiverName || 'Caregiver'}, ${patientName || 'Your patient'} manually confirmed a dose (no photo verification). Please check in if needed. — MedRem`;
      break;
    default:
      message = `MedRem Alert for ${patientName || 'your patient'}: ${details}`;
  }

  return sendSMS(caregiverPhone, message);
}
