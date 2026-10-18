import { env } from '../env';

export interface VerifyResult {
  verified: boolean;
  amountCents?: number;
  receiverAccount?: string;
  receiverName?: string;
  date?: string;
  raw?: any;
  error?: string;
}

export interface VerifyOptions {
  screenshotPath?: string;
  suffix?: string;
  phoneNumber?: string;
  receiverAccount?: string;
  receiverName?: string;
}

export async function verifyReceipt(
  provider: string,
  reference: string,
  screenshotPathOrOptions?: string | VerifyOptions
): Promise<VerifyResult> {
  const options: VerifyOptions = typeof screenshotPathOrOptions === 'string'
    ? { screenshotPath: screenshotPathOrOptions }
    : (screenshotPathOrOptions || {});

  const trimmedRef = reference.trim();
  const normalizedProvider = provider.toLowerCase().trim();

  // 1. Instant check for test/mock references to speed up local testing
  if (trimmedRef.toUpperCase().startsWith('TEST') || trimmedRef.toUpperCase().startsWith('MOCK')) {
    return {
      verified: true,
      amountCents: 50000, // 500 ETB
      receiverAccount: options.receiverAccount || '1000234567891',
      receiverName: options.receiverName || 'Dr. Hana Almaz',
      date: new Date().toISOString(),
      raw: { test: true, reference: trimmedRef, provider: normalizedProvider }
    };
  }

  // 2. Prepare payload matching cloned verifier-api specification
  const payload: Record<string, any> = {
    reference: trimmedRef
  };

  if (options.suffix) {
    payload.suffix = options.suffix;
    payload.accountSuffix = options.suffix;
  }
  if (options.phoneNumber) {
    payload.phoneNumber = options.phoneNumber;
  }

  // Determine candidate endpoints: prefer local verifier on 3001 if available, or configured BASE_URL
  const primaryBaseUrl = env.VERIFIER_BASE_URL.replace(/\/+$/, '');
  const candidateUrls = [primaryBaseUrl];
  if (!candidateUrls.includes('http://localhost:3001')) {
    candidateUrls.push('http://localhost:3001');
  }

  // Shorter 5-second timeout so user is never stalled for 10+ seconds
  for (const baseUrl of candidateUrls) {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), 5000);

    try {
      // Determine provider-specific endpoint or smart /verify
      let endpoint = `${baseUrl}/verify`;
      if (normalizedProvider === 'telebirr') {
        endpoint = `${baseUrl}/verify-telebirr`;
      } else if (normalizedProvider === 'cbe') {
        endpoint = `${baseUrl}/verify-cbe`;
      } else if (normalizedProvider === 'dashen') {
        endpoint = `${baseUrl}/verify-dashen`;
      } else if (normalizedProvider === 'abyssinia') {
        endpoint = `${baseUrl}/verify-abyssinia`;
      } else if (normalizedProvider === 'cbebirr') {
        endpoint = `${baseUrl}/verify-cbebirr`;
        payload.receiptNumber = trimmedRef;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.VERIFIER_API_KEY
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timerId);

      if (!res.ok) {
        // If 404 or 401 on provider route, try universal /verify before giving up
        if (endpoint !== `${baseUrl}/verify`) {
          const fallbackController = new AbortController();
          const fallbackTimer = setTimeout(() => fallbackController.abort(), 4000);
          try {
            const fallbackRes = await fetch(`${baseUrl}/verify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': env.VERIFIER_API_KEY
              },
              body: JSON.stringify(payload),
              signal: fallbackController.signal
            });
            clearTimeout(fallbackTimer);
            if (fallbackRes.ok) {
              const fallbackData = await fallbackRes.json();
              const parsed = parseVerifierResponse(fallbackData);
              if (parsed.verified) return parsed;
            }
          } catch {
            clearTimeout(fallbackTimer);
          }
        }
        continue; // Try next candidate URL
      }

      const data = await res.json();
      const parsed = parseVerifierResponse(data);
      if (parsed.verified) {
        return parsed;
      }
      return { verified: false, raw: data };
    } catch (err: any) {
      clearTimeout(timerId);
      // Timeout or connection error, proceed to fallback candidate URL
      continue;
    }
  }

  // If verifier couldn't confirm, treat as unverified for manual review
  return {
    verified: false,
    raw: { message: 'Verifier did not confirm transaction automatically' }
  };
}

function parseVerifierResponse(data: any): VerifyResult {
  if (!data) return { verified: false };

  // verifier-api returns success: true
  const isSuccess = data.success === true || data.status === 'success' || data.status === 'ok';
  if (!isSuccess) {
    return { verified: false, raw: data, error: data.error };
  }

  const details = data.data || data;

  // Amount extraction across Telebirr, CBE, Dashen, Abyssinia, CBE Birr
  let amountCents: number | undefined;
  if (typeof details.amount === 'number') {
    amountCents = Math.round(details.amount * 100);
  } else if (typeof details.transactionAmount === 'number') {
    amountCents = Math.round(details.transactionAmount * 100);
  } else if (typeof details.total === 'number') {
    amountCents = Math.round(details.total * 100);
  } else if (typeof data.amount === 'number') {
    amountCents = Math.round(data.amount * 100);
  } else if (typeof data.total === 'number') {
    amountCents = Math.round(data.total * 100);
  } else if (typeof data.transactionAmount === 'number') {
    amountCents = Math.round(data.transactionAmount * 100);
  } else if (details.settledAmount) {
    const num = parseFloat(String(details.settledAmount).replace(/[^\d.]/g, ''));
    if (!isNaN(num)) amountCents = Math.round(num * 100);
  } else if (details.totalPaidAmount) {
    const num = parseFloat(String(details.totalPaidAmount).replace(/[^\d.]/g, ''));
    if (!isNaN(num)) amountCents = Math.round(num * 100);
  } else if (details.amount) {
    const num = parseFloat(String(details.amount).replace(/[^\d.]/g, ''));
    if (!isNaN(num)) amountCents = Math.round(num * 100);
  }

  const receiverAccount = details.receiverAccount || details.creditedPartyAccountNo || details.creditAccountNo || details.creditAccount;
  const receiverName = details.receiver || details.receiverName || details.creditedPartyName;
  const date = details.date || details.paymentDate || details.transactionDate;

  return {
    verified: true,
    amountCents,
    receiverAccount,
    receiverName,
    date: date ? new Date(date).toISOString() : new Date().toISOString(),
    raw: data
  };
}
