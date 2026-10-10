# Publishing promotions to Facebook & Instagram

The Performance tab's **Promote to Social** panel publishes a shop promotion to
your Facebook Page and its linked Instagram business account. It uses the same
server-side credential as the Growth insights — `META_SYSTEM_USER_TOKEN` — so
there is no Facebook login and no token in the browser.

## How it works

1. The browser POSTs `{ target, message, imageUrl }` to `/api/meta/publish`.
2. The server resolves the Page (and its linked Instagram account) from
   `META_SYSTEM_USER_TOKEN` via `GET /me/accounts?fields=…,access_token,instagram_business_account`.
3. Facebook: `POST /{page-id}/feed` (text) or `/{page-id}/photos` (with image).
   Instagram: `POST /{ig-id}/media` then `/{ig-id}/media_publish` (two-step
   container flow — Instagram requires a **publicly reachable image URL**; it
   cannot accept an upload).

Recent posts are listed from `GET /api/meta/posts` (`/{page-id}/published_posts`).

## Environment

| Variable | Purpose |
|---|---|
| `META_SYSTEM_USER_TOKEN` | Business Manager **system-user** token. Must carry `pages_manage_posts`, `publish_video`, `instagram_content_publish` (plus `read_insights` for the stats). Never sent to the browser. |

## ⚠️ App Review is required before posts are public

A Facebook app in **Development mode** can only publish to Pages/Instagram
accounts whose admins hold a role on the app, and **posts are not visible to the
public** until the app passes App Review.

To make posting public:

1. **Business verification** — Meta Business Suite → Business Settings →
   Security Center → Start verification (required for `pages_manage_posts`).
2. **App Review** (developers.facebook.com → your app → App Review →
   Permissions and Features) — request **Advanced Access** for:
   - `pages_manage_posts`
   - `instagram_content_publish`
   - `pages_read_engagement`
   - `read_insights`
   Recent Meta policy requires **Business Verification + Tech Provider/Advanced
   Access screening** for Ads-related permissions; organic posting is lighter.
3. **Provide use-case descriptions + a screencast** showing the composer and the
   resulting post. The reviewer must be able to reproduce the flow.
4. Switch the app to **Live mode** once approved.

Until then, use the panel to draft and test — posts will only be visible to
app admins/testers.

## Boosting / paid promotion (not yet enabled)

`me/adaccounts` currently returns **empty** for this token — there is no Ad
Account linked to the Business Portfolio. To enable paid boosting:

1. Meta Business Suite → Business Settings → **Ad Accounts** → Add.
2. Grant the system user access to it (`ads_management`, `ads_read`).
3. Send the `act_<id>` account id so the "Boost" path can be wired to
   `POST /{ad-account}/campaigns` / `adsets` / `ads`.

## Rotating the token

If `META_SYSTEM_USER_TOKEN` ever leaks, generate a new system-user token in
Business Settings and update the value in Vercel → Project → Settings →
Environment Variables, then redeploy.
