# Public Voting Data API

Public, read-only REST API over the tier-list voting data, for power users who
want more than the leaderboard. Replaces the SQL editor proposed in
[#53](https://github.com/syrianzone/syrianzone/issues/53), per review feedback.

Base URL: `/api/v1`

## Privacy

Voter-identifying data is never returned:

- `ballots.voter_key`, `ballots.ip_hash`, `ballots.user_agent` are never
  selected at the query level.
- `polls.user_id` (poll owner) is never selected.
- Defense in depth: `Poll::$hidden = ['user_id']`, so even legacy public poll reads (`GET /api/polls*`) cannot leak the owner id.
- Ballots come back anonymized: ballot UUID, vote day, creation timestamp, and
  tier assignments only.

When extending `VotingDataController`, keep column selection explicit. Never
return full model rows.

## Rate limiting & paging

- 60 requests per minute per IP (429 beyond that).
- `scores` and `ballots` are paginated: `?page=` and `?per_page=` (default
  100, max 1000), standard Laravel paginator envelope (`data`, `per_page`,
  `total`, ...).

## Endpoints

| Endpoint | Returns | Query params |
|---|---|---|
| `GET /polls` | active polls | |
| `GET /polls/{idOrSlug}` | poll + groups + candidates | |
| `GET /polls/{idOrSlug}/candidates` | candidates | `status` (`active`\|`archived`\|`all`, default `all`) |
| `GET /polls/{idOrSlug}/scores` | daily per-candidate `votes`/`score` rows | `from`, `to`, `candidate_id`, paging |
| `GET /polls/{idOrSlug}/ballots` | anonymized ballots + `items` (`candidate_id`, `tier` S..F, `position`) | `from`, `to` (on `vote_day`), paging |

Date bounds are inclusive, e.g. `2026-08-01`. Polls resolve by UUID or slug.

## Examples

```sh
# top candidates: aggregate scores client-side
curl 'https://syrian.zone/api/v1/polls/best-ministers/scores?per_page=1000'

# daily trend for one candidate
curl 'https://syrian.zone/api/v1/polls/best-ministers/scores?candidate_id=<uuid>&from=2026-07-01'

# raw ballots for a single day
curl 'https://syrian.zone/api/v1/polls/best-ministers/ballots?from=2026-08-01&to=2026-08-01'
```
