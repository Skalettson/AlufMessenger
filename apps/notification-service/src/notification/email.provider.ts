import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export type EmailTemplate =
  | 'otp'
  | 'magic_link'
  | 'login_alert'
  | 'welcome'
  | 'generic';

export interface EmailOptions {
  to: string;
  subject: string;
  template?: EmailTemplate;
  data?: Record<string, string>;
  html?: string;
}

@Injectable()
export class EmailProvider {
  private transporter: nodemailer.Transporter | null = null;
  private fromAddress: string;

  constructor() {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT || '587';
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    this.fromAddress = process.env.SMTP_FROM || 'Aluf <noreply@example.com>';

    if (smtpHost && smtpUser && smtpPass) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort, 10),
        secure: smtpPort === '465', // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        tls: {
          rejectUnauthorized: false, // For self-signed certificates
        },
      });

      // Verify connection
      this.transporter.verify((error, _success) => {
        if (error) {
          console.error('[SMTP] Connection failed:', error.message);
        } else {
          console.log('[SMTP] Server ready to send emails');
        }
      });
    } else {
      console.warn('[SMTP] Not configured: SMTP_HOST, SMTP_USER, SMTP_PASS required');
    }
  }

  async sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
    if (!this.transporter) {
      return { success: false, error: 'Email not configured' };
    }

    let html = options.html;
    if (!html && options.template) {
      html = this.renderTemplate(options.template, options.data ?? {});
    }
    if (!html) {
      html = '<p>No content</p>';
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.fromAddress,
        to: options.to,
        subject: options.subject,
        html,
      });

      console.log('[SMTP] Email sent:', info.messageId);
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[SMTP] Send failed:', msg);
      return { success: false, error: msg };
    }
  }

  private renderTemplate(
    template: EmailTemplate,
    data: Record<string, string>,
  ): string {
    switch (template) {
      case 'otp':
        return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body{font-family:sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px}.code{font-size:28px;font-weight:bold;letter-spacing:8px;padding:16px;background:#f0f0f0;border-radius:8px;text-align:center;margin:24px 0}</style></head>
<body>
  <h2>Your verification code</h2>
  <p>Use this code to sign in to Aluf:</p>
  <div class="code">${data.code ?? '------'}</div>
  <p>This code expires in 5 minutes. Never share it with anyone.</p>
  <p>If you didn't request this, you can safely ignore this email.</p>
</body>
</html>`;

      case 'magic_link':
        return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body{font-family:sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px}a{color:#0066cc;text-decoration:none}.btn{display:inline-block;padding:12px 24px;background:#0066cc;color:#fff!important;border-radius:6px;margin:16px 0}</style></head>
<body>
  <h2>Sign in to Aluf</h2>
  <p>Click the button below to sign in. No password needed.</p>
  <p><a href="${data.url ?? '#'}" class="btn">Sign in to Aluf</a></p>
  <p>This link expires in 10 minutes. If you didn't request this, ignore this email.</p>
</body>
</html>`;

      case 'login_alert':
        return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body{font-family:sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px}.info{background:#fff3cd;padding:12px;border-radius:6px;margin:16px 0}</style></head>
<body>
  <h2>New sign-in to your account</h2>
  <p>Someone signed in to your Aluf account.</p>
  <div class="info">
    <strong>Time:</strong> ${data.time ?? 'Unknown'}<br>
    <strong>Device:</strong> ${data.device ?? 'Unknown'}<br>
    <strong>Location:</strong> ${data.location ?? 'Unknown'}
  </div>
  <p>If this wasn't you, secure your account immediately by changing your password.</p>
</body>
</html>`;

      case 'welcome':
        return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body{font-family:sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px}h1{color:#0066cc}</style></head>
<body>
  <h1>Welcome to Aluf!</h1>
  <p>Hi ${data.name ?? 'there'},</p>
  <p>Thanks for signing up. You're all set to start messaging.</p>
  <p>Download our apps or use the web version to get started.</p>
</body>
</html>`;

      default:
        return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body{font-family:sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px}</style></head>
<body>
  <p>${data.body ?? 'You have a new notification.'}</p>
</body>
</html>`;
    }
  }

  isConfigured(): boolean {
    return this.transporter !== null;
  }
}
