import { createHash } from 'node:crypto';

export const NEWS_FEEDS = Object.freeze({
  world: 'https://feeds.bbci.co.uk/news/world/rss.xml',
  technology: 'https://feeds.bbci.co.uk/news/technology/rss.xml',
  science: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
  business: 'https://feeds.bbci.co.uk/news/business/rss.xml'
});

const caches = new WeakMap();
const TTL_MS = 60_000;
const TIMEOUT_MS = 8_000;

export class NewsError extends Error {
  constructor(message, code = 'NEWS_UNAVAILABLE') {
    super(message);
    this.name = 'NewsError';
    this.code = code;
  }
}

function plainText(value = '') {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (whole, entity) => {
      if (!entity.startsWith('#')) return entities[entity.toLowerCase()] ?? whole;
      const number = entity[1].toLowerCase() === 'x'
        ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff)
        ? String.fromCodePoint(number) : '\ufffd';
    })
    .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function field(xml, tag) {
  return plainText(xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'))?.[1] ?? '');
}

export function parseNewsFeed(xml) {
  if (typeof xml !== 'string' || xml.length > 2_000_000 || !/<rss\b/i.test(xml)) {
    throw new NewsError('The news source returned an unreadable feed.');
  }
  const items = [];
  const seen = new Set();
  for (const match of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const title = field(match[1], 'title');
    const link = field(match[1], 'link');
    let url;
    try {
      url = new URL(link);
      if (url.protocol !== 'https:' || !['bbc.com', 'www.bbc.com', 'bbc.co.uk', 'www.bbc.co.uk'].includes(url.hostname)) continue;
    } catch { continue; }
    if (!title || seen.has(url.href)) continue;
    seen.add(url.href);
    const date = Date.parse(field(match[1], 'pubDate'));
    items.push({
      id: createHash('sha256').update(url.href).digest('hex').slice(0, 16),
      title: [...title].slice(0, 300).join(''),
      description: [...field(match[1], 'description')].slice(0, 500).join(''),
      url: url.href,
      source: 'BBC News',
      publishedAt: Number.isFinite(date) ? new Date(date).toISOString() : null
    });
    if (items.length === 5) break;
  }
  if (!items.length) throw new NewsError('The news source did not return usable headlines. Please try another topic.');
  return items;
}

export async function getNews({ topic = 'world', fetchImpl = fetch, now = Date.now, timeoutMs = TIMEOUT_MS } = {}) {
  if (!Object.hasOwn(NEWS_FEEDS, topic)) throw new NewsError('Choose world, technology, science or business.', 'BAD_TOPIC');
  const timestamp = typeof now === 'function' ? now() : now;
  if (!Number.isFinite(timestamp)) throw new NewsError('News clock is unavailable.');
  let cache = caches.get(fetchImpl);
  if (!cache) { cache = new Map(); caches.set(fetchImpl, cache); }
  const prior = cache.get(topic);
  if (prior && timestamp >= prior.time && timestamp - prior.time < TTL_MS) {
    return structuredClone(prior.result);
  }
  const controller = new AbortController();
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new NewsError('The news source took too long to respond. Please try again.', 'NEWS_TIMEOUT'));
    }, timeoutMs);
  });
  try {
    const result = await Promise.race([(async () => {
      const response = await fetchImpl(NEWS_FEEDS[topic], {
        signal: controller.signal,
        headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
        redirect: 'error'
      });
      if (!response?.ok) throw new NewsError('The news source is temporarily unavailable. Please try again.');
      const items = parseNewsFeed(await response.text());
      return { items, fetchedAt: new Date(timestamp).toISOString(), topic };
    })(), deadline]);
    cache.set(topic, { time: timestamp, result });
    return structuredClone(result);
  } catch (error) {
    if (error instanceof NewsError) throw error;
    throw new NewsError('Could not reach the news source. Check your connection and try again.');
  } finally { clearTimeout(timer); }
}
