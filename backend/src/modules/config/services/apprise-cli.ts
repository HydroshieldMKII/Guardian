import { Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import { errorMessage } from '@/common/utils/error-types';

export const APPRISE_TIMEOUT_MS = 20000;

export interface AppriseNotificationData {
  title: string;
  body: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}

export interface AppriseResult {
  success: boolean;
  message: string;
}

const LOG_PREFIX = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3} - ERROR - /;

export function describeAppriseFailure(output: string): string {
  if (output.includes('Unsupported URL')) {
    const invalidUrl = /Unsupported URL: (\S+)/.exec(output)?.[1] ?? 'unknown';
    return `Invalid service URL: "${invalidUrl}". Please check your Apprise service URLs and ensure they follow the correct format.`;
  }

  if (output.includes('You must specify at least one server URL')) {
    return 'No valid service URLs found. Please configure at least one valid Apprise service URL.';
  }

  if (output.includes('ERROR') && output.includes('HTTP Error')) {
    return 'Failed to connect to notification service. Please check your service URLs and network connection.';
  }

  if (output.includes('Permission denied') || output.includes('Forbidden')) {
    return 'Permission denied when sending notification. Please check your service credentials and permissions.';
  }

  return `Notification failed: ${output.replace(LOG_PREFIX, '').trim()}`;
}

export function runApprise(
  urls: string[],
  data: AppriseNotificationData,
  logger: Logger,
): Promise<AppriseResult> {
  return new Promise((resolve) => {
    const args = ['-vv', '--title', data.title, '--body', data.body, ...urls];

    logger.debug(`Executing apprise with args: ${args.join(' ')}`);

    const appriseProcess = spawn('apprise', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    appriseProcess.stdout?.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    appriseProcess.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    const timeout = setTimeout(() => {
      appriseProcess.kill();
      resolve({
        success: false,
        message: `Apprise process timed out after ${APPRISE_TIMEOUT_MS / 1000} seconds`,
      });
    }, APPRISE_TIMEOUT_MS);

    appriseProcess.on('close', (code) => {
      clearTimeout(timeout);
      logger.debug(`Apprise process exited with code ${code}`);
      logger.debug(`Apprise stdout: ${stdout}`);

      if (stderr) {
        logger.debug(`Apprise stderr: ${stderr}`);
      }

      resolve(
        code === 0
          ? { success: true, message: 'Notification sent successfully' }
          : {
              success: false,
              message: describeAppriseFailure(stderr || stdout),
            },
      );
    });

    appriseProcess.on('error', (error) => {
      clearTimeout(timeout);
      logger.error('Apprise process error:', error);
      resolve({
        success: false,
        message: `Failed to spawn apprise process: ${errorMessage(error)}`,
      });
    });
  });
}
