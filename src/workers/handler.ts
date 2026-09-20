interface Env {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  BHARATCODE_API_KEY?: string;
  BHARATCODE_BASE_URL?: string;
  BHARATCODE_MODEL?: string;
}

function getEnvValue(env: Env, key: keyof Env): string {
  return env[key] || '';
}

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function json(data: unknown, status = 200, origin?: string | null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin ?? null),
    },
  });
}

async function verifyAuth(request: Request, env: Env): Promise<{ userId: string } | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  const supabaseUrl = getEnvValue(env, 'SUPABASE_URL');
  const publishableKey = getEnvValue(env, 'SUPABASE_PUBLISHABLE_KEY');

  if (!supabaseUrl || !publishableKey) {
    return null;
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: publishableKey,
    },
  });

  if (!response.ok) {
    return null;
  }

  const user = (await response.json()) as { id: string };
  return { userId: user.id };
}

async function handleResumeExtract(
  request: Request,
  origin: string | null,
  env: Env
): Promise<Response> {
  const auth = await verifyAuth(request, env);
  if (!auth) {
    return json({ error: 'Unauthorized' }, 401, origin);
  }

  try {
    const body = (await request.json()) as { storagePath?: string };
    const { storagePath } = body;

    if (!storagePath) {
      return json({ error: 'storagePath is required' }, 400, origin);
    }

    const supabaseUrl = getEnvValue(env, 'SUPABASE_URL');
    const serviceKey = getEnvValue(env, 'SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceKey) {
      return json({ error: 'Server configuration error' }, 500, origin);
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('resumes')
      .download(storagePath);

    if (downloadError || !fileData) {
      return json({ error: 'Failed to download resume' }, 500, origin);
    }

    const buffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);

    const decoder = new TextDecoder('utf-8', { fatal: false });
    const fullText = decoder.decode(uint8Array);

    const textChunks: string[] = [];
    const streamMatches = fullText.match(/stream\r?\n([\s\S]*?)\r?\nendstream/g);
    if (streamMatches) {
      for (const match of streamMatches) {
        const streamContent = match.replace(/^stream\r?\n/, '').replace(/\r?\nendstream$/, '');
        const cleaned = streamContent
          .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (cleaned.length > 10) {
          textChunks.push(cleaned);
        }
      }
    }

    const extractedText = textChunks.join('\n\n');

    if (extractedText.trim().length < 50) {
      return json(
        { error: 'This PDF appears to be scanned or contains too little readable text.' },
        422,
        origin
      );
    }

    const bharatcodeKey = getEnvValue(env, 'BHARATCODE_API_KEY');

    if (!bharatcodeKey) {
      return json({ error: 'AI extraction is not configured' }, 503, origin);
    }

    const aiResponse = await fetch(
      `${getEnvValue(env, 'BHARATCODE_BASE_URL') || 'https://bharatcode.ai/api/model/v1'}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bharatcodeKey}`,
        },
        body: JSON.stringify({
          model: getEnvValue(env, 'BHARATCODE_MODEL') || 'deepseek-v4.1-flash',
          messages: [
            {
              role: 'system',
              content: 'You are a precise resume extraction assistant. Return only valid JSON.',
            },
            {
              role: 'user',
              content: `Extract structured information from this resume text. Return JSON with keys: identity, experience, education, projects, skills, links, warnings.\n\nRESUME TEXT:\n${extractedText}`,
            },
          ],
          temperature: 0.1,
          max_tokens: 4000,
        }),
      }
    );

    if (!aiResponse.ok) {
      return json({ error: 'AI provider error' }, 502, origin);
    }

    const aiData = (await aiResponse.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      return json({ error: 'AI provider returned empty response' }, 502, origin);
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return json({ error: 'AI response does not contain valid JSON' }, 502, origin);
    }

    const extraction = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    return json(extraction, 200, origin);
  } catch (err) {
    console.error('Resume extraction failed:', err);
    return json({ error: 'Extraction failed' }, 500, origin);
  }
}

export async function handleRequest(
  request: Request,
  env: Env,
  _ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (url.pathname === '/api/health') {
    return json({ status: 'ok', timestamp: new Date().toISOString() }, 200, origin);
  }

  if (url.pathname === '/api/resume/extract' && request.method === 'POST') {
    return handleResumeExtract(request, origin, env);
  }

  return json({ error: 'Not Found' }, 404, origin);
}
