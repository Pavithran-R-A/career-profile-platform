export interface DotCvConfig {
  enabled: boolean;
  purchaseEnabled: boolean;
  apiBaseUrl: string;
  apiKey: string;
}

export interface DotCvQuote {
  domain: string;
  pricePaise: number | null;
  currency: string;
  available: boolean | null;
  source: 'provider' | 'unavailable';
}

export interface DotCvPurchaseResult {
  reference: string;
  domain: string;
  status: string;
}

export function isDotCvEnabled(config: Partial<DotCvConfig>): boolean {
  return Boolean(config.enabled && config.apiBaseUrl && config.apiKey);
}

export function isDotCvPurchaseEnabled(config: Partial<DotCvConfig>): boolean {
  return isDotCvEnabled(config) && Boolean(config.purchaseEnabled);
}

export async function quoteDotCvDomain(
  config: DotCvConfig,
  fqdn: string,
  fetchImpl: typeof fetch = fetch
): Promise<DotCvQuote> {
  if (!isDotCvEnabled(config)) {
    return {
      domain: fqdn,
      pricePaise: null,
      currency: 'INR',
      available: null,
      source: 'unavailable',
    };
  }

  try {
    const response = await fetchImpl(
      `${config.apiBaseUrl.replace(/\/$/, '')}/domains/quote?name=${encodeURIComponent(fqdn)}`,
      {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      return {
        domain: fqdn,
        pricePaise: null,
        currency: 'INR',
        available: null,
        source: 'unavailable',
      };
    }

    const data = (await response.json()) as {
      available?: boolean;
      price?: number;
      pricePaise?: number;
      currency?: string;
    };

    const pricePaise =
      typeof data.pricePaise === 'number'
        ? data.pricePaise
        : typeof data.price === 'number'
          ? Math.round(data.price * 100)
          : null;

    return {
      domain: fqdn,
      pricePaise,
      currency: data.currency ?? 'INR',
      available: typeof data.available === 'boolean' ? data.available : null,
      source: 'provider',
    };
  } catch {
    return {
      domain: fqdn,
      pricePaise: null,
      currency: 'INR',
      available: null,
      source: 'unavailable',
    };
  }
}

export async function purchaseDotCvDomain(
  config: DotCvConfig,
  input: { fqdn: string; contactEmail: string; quotePricePaise: number },
  fetchImpl: typeof fetch = fetch
): Promise<DotCvPurchaseResult> {
  if (!isDotCvEnabled(config)) {
    throw new Error('DOTCV_DISABLED');
  }
  if (!isDotCvPurchaseEnabled(config)) {
    throw new Error('DOTCV_PURCHASE_DISABLED');
  }
  if (input.quotePricePaise <= 0) {
    throw new Error('DOTCV_QUOTE_REQUIRED');
  }

  const response = await fetchImpl(`${config.apiBaseUrl.replace(/\/$/, '')}/domains/register`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      domain: input.fqdn,
      contact_email: input.contactEmail,
      price_paise: input.quotePricePaise,
    }),
  });

  if (!response.ok) {
    throw new Error(`DOTCV_PURCHASE_FAILED_${response.status}`);
  }

  const data = (await response.json()) as {
    reference?: string;
    domain?: string;
    status?: string;
  };

  if (!data.reference) {
    throw new Error('DOTCV_PURCHASE_INVALID_RESPONSE');
  }

  return {
    reference: data.reference,
    domain: data.domain ?? input.fqdn,
    status: data.status ?? 'pending',
  };
}
