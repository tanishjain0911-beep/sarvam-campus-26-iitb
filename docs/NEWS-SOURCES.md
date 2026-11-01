# News sources

Suno combines public RSS headlines with clear publisher labels and original article links. It does not scrape full articles.

| Edition | Publishers |
| --- | --- |
| India | The Indian Express, The Hindu, Hindustan Times |
| World | The Indian Express, The Hindu, BBC News |
| Technology | The Indian Express, The Hindu, BBC News |
| Science & environment | The Indian Express, The Hindu, BBC News |
| Business | The Indian Express, The Hindu, BBC News |

India is the default for new visitors. Existing visitors retain their selected topic. Each response contains up to five ranked stories selected from up to 30 candidates per publisher. Recency, publisher placement, public-interest topic signals and cross-publisher coverage contribute to selection. Similar headlines are grouped; additional publisher links are retained. Stories older than 72 hours are excluded. Unknown dates are preserved. Publisher and topic diversity are preferred among comparably ranked stories. This heuristic does not establish objective importance, accuracy or complete coverage.

Feeds are requested concurrently with bounded timeouts. A failed or slow publisher does not suppress healthy feeds. The page reports when some publishers are unavailable. Feeds are cached for 60 seconds and checked every minute while the news view is visible. Publisher schedules determine when new stories appear.

Links are validated against the specific publisher's allowlisted domains to prevent incorrect attribution and arbitrary external destinations. RSS redirects are not followed automatically. Translation and narration use English-language feed excerpts as input and the listener's chosen output language.

Official feed directories: [The Indian Express](https://indianexpress.com/rss/), [The Hindu](https://www.thehindu.com/rssfeeds/), [Hindustan Times](https://www.hindustantimes.com/rss). Exact feed URLs are maintained in `lib/news.mjs` and the hosted shared-module copies. Publisher terms and source rights continue to apply; feed availability is not a syndication license.

Live checks before deployment returned usable RSS from the configured Indian publishers. Regression tests cover mixed attribution, source diversity, partial outages, timeout recovery, caching, redirects and domain validation.

Public-host verification displayed The Hindu and Hindustan Times in India headlines. The Indian Express was temporarily unavailable from the host at that check, although its feed worked in the local live check. Unavailable publishers are skipped and reported by the UI.

## City preferences

The India edition optionally mixes three national stories with up to two local stories. Available cities: Mumbai, Pune, Delhi, Bengaluru, Chennai, Hyderabad, Kolkata, Lucknow and Chandigarh. Choose **National only** to disable local mixing. The city control is shown only for India; other topics retain their existing selection behavior. A previous city choice is remembered when returning to India.

Local feeds use Hindustan Times for Mumbai, Pune, Delhi, Bengaluru, Kolkata, Lucknow and Chandigarh, and The Hindu for Chennai and Hyderabad. Exact URLs are allowlisted in `CITY_FEEDS` in `lib/news.mjs` and the hosted copies. Feed addresses were checked live before implementation.

Local candidates use the same ranking and recency filtering as national stories. They are labeled with the city. Identical URLs or sufficiently similar stories already selected nationally are skipped. Missing or stale local coverage falls back to national stories and the interface reports the missing coverage. A national-source outage can leave a shorter, local-only edition; the counts remain explicit.

The city is a manual preference stored locally. It is sent to Suno's API to select the fixed city feed. There is no GPS request or automatic location detection. Arbitrary city URLs and city requests outside the India topic are rejected before any upstream fetch. Cache keys include the city to keep editions separate.
