/**
 * FlowPact Web Application Configuration
 */

export function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.trim()) {
    return process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://localhost:3000';
}

export function getPaymentUrl(contractId: string): string {
  return `${getAppBaseUrl()}/pay/${contractId}`;
}

export function getVerificationUrl(signature: string): string {
  return `${getAppBaseUrl()}/verify/${signature}`;
}
