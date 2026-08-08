const nodemailer = require('nodemailer');

class EmailServiceError extends Error {
  constructor(message, { cause, code, smtpResponse } = {}) {
    super(message);
    this.name = 'EmailServiceError';
    this.code = code || 'EMAIL_SEND_FAILED';
    this.cause = cause || null;
    this.smtpResponse = smtpResponse || null;
  }
}

let transporter = null;
let initLogged = false;

const logSMTP = (level, message, meta = {}) => {
  const ts = new Date().toISOString();
  const prefix = `[EmailService:${level}] ${ts}`;
  if (level === 'ERROR' || level === 'WARN') {
    console.error(prefix, message, Object.keys(meta).length ? JSON.stringify(meta) : '');
  } else {
    console.log(prefix, message, Object.keys(meta).length ? JSON.stringify(meta) : '');
  }
};

const resolveSMTPConfig = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL, FROM_NAME } = process.env;

  const port = parseInt(SMTP_PORT || '587', 10);
  const secure = port === 465;

  const missing = [];
  if (!SMTP_HOST) missing.push('SMTP_HOST');
  if (!SMTP_USER) missing.push('SMTP_USER');
  if (!SMTP_PASS) missing.push('SMTP_PASS');
  if (!FROM_EMAIL) missing.push('FROM_EMAIL');

  return {
    host: SMTP_HOST,
    port,
    secure,
    user: SMTP_USER,
    pass: SMTP_PASS,
    fromEmail: FROM_EMAIL,
    fromName: FROM_NAME || 'Lost & Found Platform',
    missing,
  };
};

const createTransporter = (forceRecreate = false) => {
  if (transporter && !forceRecreate) return transporter;

  const cfg = resolveSMTPConfig();
  if (cfg.missing.length > 0) {
    if (!initLogged) {
      logSMTP('WARN', `SMTP configuration incomplete — missing env vars: ${cfg.missing.join(', ')}`);
      initLogged = true;
    }
    return null;
  }

  transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });

  if (!initLogged) {
    logSMTP('INFO', `Nodemailer transporter initialized via Brevo SMTP (host=${cfg.host}, port=${cfg.port}, secure=${cfg.secure}, from=${cfg.fromEmail})`);
    initLogged = true;
  }

  return transporter;
};

const verifySMTPConnection = async () => {
  const t = createTransporter();
  if (!t) {
    return { ok: false, reason: 'SMTP_NOT_CONFIGURED' };
  }
  try {
    await t.verify();
    logSMTP('INFO', 'SMTP connection verified successfully');
    return { ok: true };
  } catch (err) {
    logSMTP('ERROR', 'SMTP connection verification failed', {
      code: err.code,
      message: err.message,
      response: err.response,
      responseCode: err.responseCode,
    });
    return { ok: false, reason: 'SMTP_VERIFY_FAILED', error: err.message, code: err.code, responseCode: err.responseCode };
  }
};

const wrapHTML = (bodyHTML) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>Lost &amp; Found Platform</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f9fafb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9fafb;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:600px;" cellpadding="0" cellspacing="0" border="0">
            ${bodyHTML}
            <tr>
              <td style="padding:20px 28px;text-align:center;font-size:12px;color:#9ca3af;line-height:1.5;">
                &copy; ${new Date().getFullYear()} Lost &amp; Found Platform. All rights reserved.<br />
                If you did not request this email, you can safely ignore it.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const sendEmail = async ({ to, subject, html, text, category = 'general' }) => {
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    const err = new EmailServiceError('Invalid or missing recipient email address', { code: 'INVALID_RECIPIENT' });
    logSMTP('ERROR', err.message, { to, category });
    throw err;
  }

  if (!subject || !subject.trim()) {
    const err = new EmailServiceError('Email subject is required', { code: 'EMPTY_SUBJECT' });
    logSMTP('ERROR', err.message, { to, category });
    throw err;
  }

  if (!html && !text) {
    const err = new EmailServiceError('Email body (html or text) is required', { code: 'EMPTY_BODY' });
    logSMTP('ERROR', err.message, { to, category });
    throw err;
  }

  const mailTransporter = createTransporter();

  if (!mailTransporter) {
    const err = new EmailServiceError(
      'Email service is not configured. Please set Brevo SMTP environment variables and try again.',
      { code: 'SMTP_NOT_CONFIGURED' }
    );
    logSMTP('ERROR', `Cannot send ${category} email — SMTP not configured`, { to, category });
    throw err;
  }

  const cfg = resolveSMTPConfig();
  const fromHeader = `"${cfg.fromName}" <${cfg.fromEmail}>`;

  const mailOptions = {
    from: fromHeader,
    to,
    subject: subject.trim(),
    ...(text ? { text } : {}),
    ...(html ? { html } : {}),
    headers: {
      'X-PM-Message-Stream': 'outbound',
      'X-Mail-Category': category,
    },
  };

  const sendStart = Date.now();
  logSMTP('DEBUG', `Sending ${category} email`, { to, category, subject: subject.trim() });

  try {
    const info = await mailTransporter.sendMail(mailOptions);
    const elapsed = Date.now() - sendStart;
    logSMTP('INFO', `${category} email sent successfully`, {
      to,
      category,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
      elapsedMs: elapsed,
    });
    return {
      success: true,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      smtpResponse: info.response,
      elapsedMs: elapsed,
    };
  } catch (error) {
    const elapsed = Date.now() - sendStart;
    const debugInfo = {
      to,
      category,
      elapsedMs: elapsed,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      name: error.name,
    };
    logSMTP('ERROR', `Failed to send ${category} email to ${to}`, debugInfo);
    logSMTP('ERROR', `Raw error stack for ${category} email failure:`, { stack: error.stack });

    throw new EmailServiceError(
      'Failed to send email. Please try again later or contact support if the problem persists.',
      {
        cause: error,
        code: error.code || 'SMTP_SEND_FAILURE',
        smtpResponse: error.response || null,
      }
    );
  }
};

const buildForgotPasswordOTPEmail = ({ name, otp, expiryMinutes }) => {
  const greeting = name ? `Hi ${name},` : 'Hi there,';
  const bodyHTML = `
    <tr>
      <td style="background:#facc15;padding:20px 28px;border-radius:12px 12px 0 0;">
        <h2 style="margin:0;color:#111827;font-size:22px;font-weight:800;">Lost &amp; Found Platform</h2>
      </td>
    </tr>
    <tr>
      <td style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:32px 28px;">
        <h3 style="margin:0 0 16px 0;font-size:20px;color:#111827;font-weight:700;">Reset Your Password</h3>
        <p style="margin:0 0 16px 0;color:#374151;font-size:14px;line-height:1.6;">${greeting}</p>
        <p style="margin:0 0 20px 0;color:#374151;font-size:14px;line-height:1.6;">
          You requested a password reset. Use the OTP below to continue. It is valid for
          <strong>${expiryMinutes} minutes</strong>.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;">
          <tr>
            <td align="center">
              <div style="background:#fef9c3;border:2px solid #facc15;border-radius:10px;padding:18px 24px;display:inline-block;">
                <span style="font-size:36px;font-weight:800;letter-spacing:8px;color:#111827;font-family:'Courier New',Courier,monospace;">${otp}</span>
              </div>
            </td>
          </tr>
        </table>
        <p style="color:#6b7280;font-size:13px;margin:0 0 8px 0;line-height:1.5;">
          If you did not request this, please ignore this email. Your account is safe.
        </p>
        <p style="color:#6b7280;font-size:13px;margin:0;line-height:1.5;">
          Do not share this OTP with anyone.
        </p>
      </td>
    </tr>`;

  const subject = 'Reset Your Password - Lost & Found Platform';
  const text =
    `Reset Your Password\n\n${greeting}\n\nYou requested a password reset. Use the OTP below to continue. ` +
    `It is valid for ${expiryMinutes} minutes.\n\nOTP: ${otp}\n\n` +
    `If you did not request this, please ignore this email. Your account is safe.\n\nDo not share this OTP with anyone.`;

  return { html: wrapHTML(bodyHTML), text, subject };
};

const sendForgotPasswordOTPEmail = async ({ email, name, otp, expiryMinutes }) => {
  const { subject, html, text } = buildForgotPasswordOTPEmail({ name, otp, expiryMinutes });
  return sendEmail({ to: email, subject, html, text, category: 'forgot-password-otp' });
};

const buildFoundItemReportedEmail = ({ userEmail, userName, itemTitle, itemId, itemLocation, date }) => {
  const bodyHTML = `
    <tr>
      <td style="background:#facc15;padding:20px 28px;border-radius:12px 12px 0 0;">
        <h2 style="margin:0;color:#111827;font-size:22px;font-weight:800;">Found Item Reported</h2>
      </td>
    </tr>
    <tr>
      <td style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:32px 28px;">
        <p style="margin:0 0 16px 0;color:#374151;font-size:14px;line-height:1.6;">Hi ${userName || 'there'},</p>
        <p style="margin:0 0 16px 0;color:#374151;font-size:14px;line-height:1.6;">
          Thanks for reporting a found item! We will use AI matching to try to reunite it with its owner.
        </p>
        <table role="presentation" cellspacing="0" cellpadding="8" border="0" style="background:#f9fafb;border-radius:8px;padding:16px;width:100%;margin:8px 0 16px 0;">
          <tr><td style="font-weight:700;color:#111827;width:130px;">Item</td><td style="color:#374151;">${itemTitle}</td></tr>
          ${itemLocation ? `<tr><td style="font-weight:700;color:#111827;">Location</td><td style="color:#374151;">${itemLocation}</td></tr>` : ''}
          ${date ? `<tr><td style="font-weight:700;color:#111827;">Date Found</td><td style="color:#374151;">${date}</td></tr>` : ''}
          <tr><td style="font-weight:700;color:#111827;">Item ID</td><td style="color:#374151;font-family:monospace;">${itemId}</td></tr>
        </table>
        <p style="color:#6b7280;font-size:13px;margin:0;line-height:1.5;">
          You will be notified if a match is found with a lost item. Keep up the great work helping your community!
        </p>
      </td>
    </tr>`;

  return {
    subject: `Thanks for reporting "${itemTitle}" - Lost & Found Platform`,
    html: wrapHTML(bodyHTML),
    text:
      `Thanks for reporting a found item!\n\nItem: ${itemTitle}\n` +
      `${itemLocation ? `Location: ${itemLocation}\n` : ''}${date ? `Date Found: ${date}\n` : ''}` +
      `Item ID: ${itemId}\n\nYou will be notified if a match is found with a lost item.`,
  };
};

const sendFoundItemReportedEmail = async ({ userEmail, userName, itemTitle, itemId, itemLocation, date }) => {
  const { subject, html, text } = buildFoundItemReportedEmail({ userEmail, userName, itemTitle, itemId, itemLocation, date });
  return sendEmail({ to: userEmail, subject, html, text, category: 'found-item-reported' });
};

const buildClaimStatusEmail = ({ userEmail, userName, itemTitle, claimStatus, statusMessage }) => {
  const statusColor =
    claimStatus === 'approved' ? '#16a34a' : claimStatus === 'rejected' ? '#dc2626' : '#2563eb';
  const statusLabel =
    claimStatus === 'approved' ? 'Approved ✅' : claimStatus === 'rejected' ? 'Rejected ❌' : 'Pending ⏳';

  const bodyHTML = `
    <tr>
      <td style="background:#facc15;padding:20px 28px;border-radius:12px 12px 0 0;">
        <h2 style="margin:0;color:#111827;font-size:22px;font-weight:800;">Claim Update</h2>
      </td>
    </tr>
    <tr>
      <td style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:32px 28px;">
        <p style="margin:0 0 16px 0;color:#374151;font-size:14px;line-height:1.6;">Hi ${userName || 'there'},</p>
        <p style="margin:0 0 20px 0;color:#374151;font-size:14px;line-height:1.6;">Your claim on the item below has been updated.</p>
        <table role="presentation" cellspacing="0" cellpadding="8" border="0" style="background:#f9fafb;border-radius:8px;padding:16px;width:100%;margin:0 0 16px 0;">
          <tr><td style="font-weight:700;color:#111827;width:130px;">Item</td><td style="color:#374151;">${itemTitle}</td></tr>
          <tr><td style="font-weight:700;color:#111827;">Status</td><td style="color:${statusColor};font-weight:700;">${statusLabel}</td></tr>
        </table>
        ${
          statusMessage
            ? `<p style="margin:0 0 8px 0;color:#374151;font-size:14px;line-height:1.6;"><strong>Note:</strong> ${statusMessage}</p>`
            : ''
        }
        <p style="color:#6b7280;font-size:13px;margin:0;line-height:1.5;">
          Log in to your dashboard to view full details.
        </p>
      </td>
    </tr>`;

  return {
    subject: `Claim ${claimStatus.toUpperCase()} for "${itemTitle}" - Lost & Found Platform`,
    html: wrapHTML(bodyHTML),
    text:
      `Claim Update\n\nHi ${userName || 'there'},\n\nYour claim on "${itemTitle}" is now: ${statusLabel}.\n` +
      `${statusMessage ? `\nNote: ${statusMessage}\n` : ''}\nLog in to your dashboard to view full details.`,
  };
};

const sendClaimStatusEmail = async ({ userEmail, userName, itemTitle, claimStatus, statusMessage }) => {
  const { subject, html, text } = buildClaimStatusEmail({ userEmail, userName, itemTitle, claimStatus, statusMessage });
  return sendEmail({ to: userEmail, subject, html, text, category: 'claim-status-update' });
};

const buildRewardEarnedEmail = ({ userEmail, userName, rewardType, pointsEarned, rewardLevel }) => {
  const bodyHTML = `
    <tr>
      <td style="background:#facc15;padding:20px 28px;border-radius:12px 12px 0 0;">
        <h2 style="margin:0;color:#111827;font-size:22px;font-weight:800;">🎉 Reward Earned!</h2>
      </td>
    </tr>
    <tr>
      <td style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:32px 28px;">
        <p style="margin:0 0 16px 0;color:#374151;font-size:14px;line-height:1.6;">Hi ${userName || 'there'},</p>
        <p style="margin:0 0 20px 0;color:#374151;font-size:14px;line-height:1.6;">
          Great news! You earned reward points for your recent contribution.
        </p>
        <table role="presentation" cellspacing="0" cellpadding="8" border="0" style="background:#fef9c3;border-radius:8px;padding:16px;width:100%;margin:0 0 16px 0;">
          <tr><td style="font-weight:700;color:#111827;width:130px;">Reason</td><td style="color:#111827;font-weight:600;">${rewardType}</td></tr>
          <tr><td style="font-weight:700;color:#111827;">Points Earned</td><td style="color:#ca8a04;font-size:20px;font-weight:800;">+${pointsEarned}</td></tr>
          <tr><td style="font-weight:700;color:#111827;">Your Level</td><td style="color:#111827;">${rewardLevel || 'Bronze Helper'}</td></tr>
        </table>
        <p style="color:#6b7280;font-size:13px;margin:0;line-height:1.5;">
          Visit the Rewards dashboard to see your leaderboard position and redeem awesome rewards.
        </p>
      </td>
    </tr>`;

  return {
    subject: `🎉 You earned ${pointsEarned} reward points! - Lost & Found Platform`,
    html: wrapHTML(bodyHTML),
    text:
      `Reward Earned!\n\nHi ${userName || 'there'},\n\nGreat news! You earned +${pointsEarned} reward points for: ${rewardType}.\n` +
      `Current Level: ${rewardLevel || 'Bronze Helper'}\n\nVisit the Rewards dashboard to redeem rewards.`,
  };
};

const sendRewardEarnedEmail = async ({ userEmail, userName, rewardType, pointsEarned, rewardLevel }) => {
  const { subject, html, text } = buildRewardEarnedEmail({ userEmail, userName, rewardType, pointsEarned, rewardLevel });
  return sendEmail({ to: userEmail, subject, html, text, category: 'reward-earned' });
};

module.exports = {
  EmailServiceError,
  createTransporter,
  verifySMTPConnection,
  resolveSMTPConfig,
  sendEmail,
  sendForgotPasswordOTPEmail,
  sendFoundItemReportedEmail,
  sendClaimStatusEmail,
  sendRewardEarnedEmail,
  buildForgotPasswordOTPEmail,
  buildFoundItemReportedEmail,
  buildClaimStatusEmail,
  buildRewardEarnedEmail,
};
