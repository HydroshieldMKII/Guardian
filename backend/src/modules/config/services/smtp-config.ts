import * as nodemailer from 'nodemailer';
import { SettingValues } from '@/modules/config/settings.catalog';
import { HttpError } from '@/common/utils/error-types';

export interface SMTPConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  fromEmail: string;
  fromName?: string;
  useTLS: boolean;
  toEmails: string[];
}

export type SmtpSettings = Pick<
  SettingValues,
  | 'SMTP_ENABLED'
  | 'SMTP_HOST'
  | 'SMTP_PORT'
  | 'SMTP_USER'
  | 'SMTP_PASSWORD'
  | 'SMTP_FROM_EMAIL'
  | 'SMTP_FROM_NAME'
  | 'SMTP_USE_TLS'
  | 'SMTP_TO_EMAILS'
>;

const EMAIL_PATTERN = /^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const SMTP_TIMEOUT_MS = 15000;
const IMPLICIT_TLS_PORT = 465;
const TLS_PORTS = [IMPLICIT_TLS_PORT, 587];

const ERROR_CODE_MESSAGES: Record<string, string> = {
  EAUTH: 'Authentication failed. Please check your username and password.',
  ECONNECTION:
    'Failed to connect to SMTP server. Please check the host and port.',
  ETIMEDOUT: 'Connection timed out. Please check your email settings.',
  ENOTFOUND: 'SMTP server not found. Please check the hostname.',
};

const RESPONSE_CODE_MESSAGES: Record<number, string> = {
  535: 'Authentication failed. Please verify your credentials.',
  550: 'Email rejected by server. Please check recipient addresses.',
};

export const toSmtpConfig = (settings: SmtpSettings): SMTPConfig => ({
  host: settings.SMTP_HOST,
  port: settings.SMTP_PORT,
  user: settings.SMTP_USER,
  password: settings.SMTP_PASSWORD,
  fromEmail: settings.SMTP_FROM_EMAIL,
  fromName: settings.SMTP_FROM_NAME,
  useTLS: settings.SMTP_USE_TLS,
  toEmails: settings.SMTP_TO_EMAILS.split(/[,;\n]/)
    .map((email) => email.trim())
    .filter((email) => email.length > 0),
});

export const validateSmtpConfig = (config: SMTPConfig): string | null => {
  if (
    !config.host ||
    !config.port ||
    !config.user ||
    !config.password ||
    !config.fromEmail
  ) {
    return 'Missing required SMTP configuration (host, port, user, password, or from email)';
  }

  if (config.useTLS && !TLS_PORTS.includes(config.port)) {
    return 'TLS is not supported on this port. Please use port 465 or 587.';
  }

  if (config.toEmails.length === 0) {
    return 'No recipient email addresses configured. Please provide at least one recipient.';
  }

  const invalidEmails = config.toEmails.filter(
    (email) => !EMAIL_PATTERN.test(email),
  );
  if (invalidEmails.length > 0) {
    return `Invalid email format(s): ${invalidEmails.join(', ')}`;
  }

  return null;
};

export const senderAddress = (config: SMTPConfig): string =>
  config.fromName
    ? `${config.fromName} <${config.fromEmail}>`
    : config.fromEmail;

export const createSmtpTransport = (config: SMTPConfig) =>
  nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.useTLS && config.port === IMPLICIT_TLS_PORT,
    auth: {
      user: config.user,
      pass: config.password,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  });

export const smtpErrorMessage = (error: HttpError): string =>
  (error.code && ERROR_CODE_MESSAGES[error.code]) ||
  (error.responseCode && RESPONSE_CODE_MESSAGES[error.responseCode]) ||
  `SMTP error: ${error.message}`;
