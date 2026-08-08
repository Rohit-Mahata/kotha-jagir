const { Resend } = require('resend');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

/**
 * Safely masks credential strings.
 * @param {string} val - The credential to mask
 * @returns {string} The masked credential
 */
function maskCredential(val) {
  if (!val) return 'undefined';
  if (val.length <= 8) return '********';
  return `${val.slice(0, 4)}****${val.slice(-4)}`;
}

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Sends a password reset OTP email to an administrator.
 * @param {string} toEmail - Recipient email address
 * @param {string} code - The 6-digit OTP code
 * @returns {Promise<any>} Response from the Resend API
 */
async function sendOtpEmail(toEmail, code) {
  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: 'Password Reset OTP - Kotha Jagir Solution',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #c49a6c; margin-top: 0;">Kotha Jagir Solution Private Limited</h2>
          <p>Hello,</p>
          <p>You requested a password reset code for your administrator account.</p>
          <p>Your OTP verification code is:</p>
          <div style="font-size: 28px; font-weight: bold; background-color: #f9f7f4; border: 1px dashed #c49a6c; color: #333; padding: 12px 24px; border-radius: 6px; display: inline-block; letter-spacing: 4px; margin: 15px 0;">
            ${code}
          </div>
          <p>This code is valid for 5 minutes. If you did not request this, please secure your account immediately.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 25px 0;"/>
          <p style="font-size: 11px; color: #888; text-align: center;">© 2026 Kotha Jagir Solution Private Limited. Kathmandu, Nepal.</p>
        </div>
      `,
    });

    if (error) {
      throw error;
    }
    return data;
  } catch (err) {
    console.error(`❌ Failed to send OTP email to ${toEmail}:`, err.message);
    throw err;
  }
}

/**
 * Tests connection to the Resend API.
 * @returns {Promise<boolean>} True if connection check succeeds, false otherwise
 */
async function checkResendConnection() {
  try {
    const { error } = await resend.domains.list();
    if (error) {
      throw error;
    }
    return true;
  } catch (err) {
    const maskedKey = maskCredential(process.env.RESEND_API_KEY);
    console.error(`❌ Resend API connection error (API Key: ${maskedKey}):`, err.message);
    return false;
  }
}

module.exports = {
  resend,
  sendOtpEmail,
  checkResendConnection,
};
