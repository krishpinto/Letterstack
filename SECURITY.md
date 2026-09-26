# Security Policy

## Reporting a vulnerability

Please do not open a public issue.

Report vulnerabilities through GitHub's private advisory form:
[Report a vulnerability](https://github.com/krishpinto/Letterstack/security/advisories/new)

Include what you found, how to reproduce it, and what an attacker could do with
it. You'll get an acknowledgement within a few days.

This is a small project without a bug bounty, but credit is given in the
advisory unless you'd rather stay anonymous.

## Scope

Most relevant to a self-hosted deployment:

- Authentication and session handling
- Workspace isolation — one organisation reading another's campaigns,
  contacts or analytics
- The unauthenticated endpoints: signup, password reset, public subscribe
  forms, the unsubscribe route and the SES webhook
- Anything allowing mail to be sent as another workspace's verified domain

## Running LetterStack safely

- Set `ADMIN_EMAILS` to a short allowlist. It gates the admin console, which can
  read any workspace's sent campaigns.
- Keep `MAILBOX_ENCRYPTION_KEY` secret and back it up. Connected Gmail OAuth
  tokens are encrypted with it.
- Set `CONTACT_INBOX` to your own address. Unset, the contact form refuses to
  send rather than defaulting anywhere.
- The SES webhook endpoint is public by necessity. It should only ever be
  subscribed to your own SNS topic.
