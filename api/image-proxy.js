export const config = { runtime: 'edge' };

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

function isValidImageUrl(value) {
	try {
		const url = new URL(value);
		return ALLOWED_PROTOCOLS.has(url.protocol);
	} catch {
		return false;
	}
}

export default async function handler(req) {
	const { searchParams } = new URL(req.url);
	const targetUrl = searchParams.get('url');

	if (!targetUrl || !isValidImageUrl(targetUrl)) {
		return new Response(JSON.stringify({ error: 'Invalid or missing url parameter' }), {
			status: 400,
			headers: {
				'content-type': 'application/json',
				'access-control-allow-origin': '*',
			},
		});
	}

	try {
		const upstream = await fetch(targetUrl, {
			headers: {
				'user-agent': 'DealWithIt/1.0 (+https://github.com/kevintraver/deal-with-it)',
			},
		});

		if (!upstream.ok) {
			return new Response(
				JSON.stringify({ error: 'Upstream fetch failed', status: upstream.status }),
				{
					status: 502,
					headers: {
						'content-type': 'application/json',
						'access-control-allow-origin': '*',
					},
				}
			);
		}

		const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
		if (!contentType.startsWith('image/')) {
			return new Response(
				JSON.stringify({ error: 'URL is not an image', contentType }),
				{
					status: 400,
					headers: {
						'content-type': 'application/json',
						'access-control-allow-origin': '*',
					},
				}
			);
		}

		const headers = new Headers();
		headers.set('content-type', contentType);
		headers.set('access-control-allow-origin', '*');
		const contentLength = upstream.headers.get('content-length');
		if (contentLength) headers.set('content-length', contentLength);
		const cacheControl = upstream.headers.get('cache-control') || 'public, max-age=300';
		headers.set('cache-control', cacheControl);

		return new Response(upstream.body, { status: 200, headers });
	} catch (err) {
		return new Response(JSON.stringify({ error: 'Fetch error' }), {
			status: 500,
			headers: {
				'content-type': 'application/json',
				'access-control-allow-origin': '*',
			},
		});
	}
}

