# GitHub App Setup Guide

This guide walks through creating and configuring a GitHub App for the Career Profile Platform.

## Prerequisites

- A GitHub account
- Admin access to an organization (or personal account)
- A deployed backend (Cloudflare Worker) for receiving webhooks

## Step 1: Create the GitHub App

1. Go to **GitHub Settings > Developer settings > GitHub Apps > New GitHub App**
2. Fill in:
   - **GitHub App name**: `Career Profile App` (must be unique)
   - **Homepage URL**: `https://your-domain.com`
   - **Webhook URL**: `https://your-worker.your-subdomain.workers.dev/github/webhook`
   - **Webhook secret**: Generate a secure random string and save it

## Step 2: Set Permissions

### Repository permissions

| Permission      | Access    | Reason                                |
| --------------- | --------- | ------------------------------------- |
| Contents        | Read-only | Read commit history and file content  |
| Metadata        | Read-only | Basic repo info (always available)    |
| Pull requests   | Read-only | Read PR titles, descriptions, stats   |
| Issues          | Read-only | Read issues for contribution evidence |
| Releases        | Read-only | Read release info                     |
| Commit statuses | Read-only | Check CI/CD verification              |

### Account permissions

| Permission      | Access    | Reason              |
| --------------- | --------- | ------------------- |
| Email addresses | Read-only | User identification |

### Subscribe to events

- `installation` — Track app installs/uninstalls
- `push` — Real-time commit sync
- `pull_request` — Real-time PR sync
- `release` — Real-time release sync

## Step 3: Generate Private Key

1. On the app's settings page, scroll to **Private keys**
2. Click **Generate a private key**
3. Save the `.pem` file securely — it cannot be downloaded again

## Step 4: Environment Variables

Set these in your Cloudflare Worker environment:

```
GITHUB_APP_ID=<number>
GITHUB_APP_PRIVATE_KEY=<PEM content, escaped>
GITHUB_APP_CLIENT_ID=<string>
GITHUB_APP_CLIENT_SECRET=<string>
GITHUB_APP_WEBHOOK_SECRET=<string>
GITHUB_STATE_SECRET=<random string for signed install state>
GITHUB_APP_SLUG=<your app's URL slug, e.g. career-profile-app>
```

`GITHUB_APP_SLUG` is public-safe (it is just the app's URL name) and drives
the dashboard's Install button and the `not configured` state: when the
slug or the signing identity is absent, the dashboard truthfully says
"GitHub integration is not configured" instead of showing a dead button.
The install callback verifies the `installation_id` against the OAuth-
authorized GitHub account before persisting — GitHub warns that a setup
URL's installation id can be spoofed, so it is never trusted from the
query alone.

### For local development

Create a `.env` file (never commit this):

```
GITHUB_APP_ID=12345
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_APP_CLIENT_ID=Iv1.abc123def456
GITHUB_APP_CLIENT_SECRET=secret123abc456def789
GITHUB_APP_WEBHOOK_SECRET=whsec_abcdef1234567890
```

## Step 5: Install the App

1. Go to the app's public page: `https://github.com/apps/<your-app-name>`
2. Click **Install**
3. Select the account or organization
4. Choose which repositories to grant access to (all or selected)

## Step 6: Verify the Installation

After installation, the app receives a webhook with:

```json
{
  "action": "installed",
  "installation": {
    "id": 12345,
    "account": { "login": "username", ... }
  }
}
```

The platform stores this in the `github_connections` table.

## Webhook Payload Verification

The platform verifies webhook signatures using HMAC-SHA256:

```
expected = HMAC-SHA256(webhook_secret, request_body)
actual = request.headers["X-Hub-Signature-256"]
```

Timing-safe comparison is used to prevent timing attacks.

## Troubleshooting

### "GitHub App credentials are not configured"

Ensure `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY` are set in your environment.

### "Failed to create installation token"

- Verify the private key matches the app
- Check that the app is installed on the account
- Ensure the installation is not suspended

### "GitHub API 403 Forbidden"

- The app may not have the required permissions
- The installation may not have access to the repository
- Rate limiting may be in effect (check `X-RateLimit-Remaining` header)

### Webhook not received

- Verify the webhook URL is correct and accessible
- Check the webhook delivery log in GitHub App settings
- Ensure the webhook secret matches your environment variable
