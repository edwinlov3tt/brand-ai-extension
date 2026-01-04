/**
 * CORS Configuration for Brand AI API
 * Following CLAUDE.md API configuration rules
 */

const ALLOWED_ORIGINS = [
  'http://localhost:5173',      // Vite dev (default)
  'http://localhost:5174',      // Vite dev (alternate port)
  'http://localhost:4173',      // Vite preview
  'http://localhost:3000',      // Extension chat UI dev
  'https://brand-ai.pages.dev', // Cloudflare Pages preview
  'https://brandai.app',        // Production (future)
  // Chrome extension origins
  'chrome-extension://',
];

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin) {
  if (!origin) return true; // Allow requests without origin (same-origin, curl, etc.)

  // Check exact matches
  if (ALLOWED_ORIGINS.includes(origin)) return true;

  // Check chrome extension prefix
  if (origin.startsWith('chrome-extension://')) return true;

  // Check Cloudflare Pages preview URLs
  if (origin.endsWith('.pages.dev')) return true;

  return false;
}

/**
 * Get CORS headers for a request
 */
export function getCorsHeaders(request) {
  const origin = request.headers.get('Origin');
  const allowedOrigin = isOriginAllowed(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Handle OPTIONS preflight request
 */
export function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request)
  });
}

/**
 * Add CORS headers to an existing response
 */
export function withCors(response, request) {
  const corsHeaders = getCorsHeaders(request);
  const newHeaders = new Headers(response.headers);

  Object.entries(corsHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/**
 * Create a JSON response with CORS headers
 */
export function jsonResponse(data, request, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(request),
    },
  });
}

/**
 * Create an error response with CORS headers
 */
export function errorResponse(message, request, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(request),
    },
  });
}
