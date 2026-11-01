# News sources

Suno combines public RSS headlines with clear publisher labels and original article links. It does not scrape full articles.

| Edition | Publishers |
| --- | --- |
| India | The Indian Express, The Hindu, Hindustan Times |
| World | The Indian Express, The Hindu, BBC News |
| Technology | The Indian Express, The Hindu, BBC News |
| Science & environment | The Indian Express, The Hindu, BBC News |
| Business | The Indian Express, The Hindu, BBC News |

India is the default for new visitors. Existing visitors retain their selected topic. Each response contains up to five stories, interleaved across available publishers rather than filled by one busy feed. Feed order is retained within each publisher; the result is not a ranking of importance or a guarantee of freshness.

Feeds are requested concurrently with bounded timeouts. A failed or slow publisher does not suppress healthy feeds. The page reports when some publishers are unavailable. Feeds are cached for 60 seconds and checked every minute while the news view is visible. Publisher schedules determine when new stories appear.

Links are validated against the specific publisher's allowlisted domains to prevent incorrect attribution and arbitrary external destinations. RSS redirects are not followed automatically. Translation and narration use English-language feed excerpts as input and the listener's chosen output language.

Official feed directories: [The Indian Express](https://indianexpress.com/rss/), [The Hindu](https://www.thehindu.com/rssfeeds/), [Hindustan Times](https://www.hindustantimes.com/rss). Exact feed URLs are maintained in `lib/news.mjs` and the hosted shared-module copies. Publisher terms and source rights continue to apply; feed availability is not a syndication license.

Live checks before deployment returned usable RSS from the configured Indian publishers. Regression tests cover mixed attribution, source diversity, partial outages, timeout recovery, caching, redirects and domain validation.

Public-host verification displayed The Hindu and Hindustan Times in India headlines. The Indian Express was temporarily unavailable from the host at that check, although its feed worked in the local live check. Unavailable publishers are skipped and reported by the UI.
