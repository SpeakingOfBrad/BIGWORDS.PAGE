# Security

## Reporting a vulnerability

Report vulnerabilities privately through GitHub: on this repository's **Security** tab, choose **Report a vulnerability**. Please don't open a public issue for one. You'll get a reply within a week, and a fix ships in a new release with credit to you, unless you'd rather not be named.

Only the latest release gets fixes.

## What counts

BIGWORDS.PAGE is static files: a display's text and settings live in the link, and the server stores nothing. Things worth reporting include:

- a link that runs script, loads anything the Content-Security-Policy should block, or escapes the display in some other way
- a link that changes what the editor or the docs do for whoever opens it
- a weakness in the Docker image or the `Caddyfile` as shipped

## What doesn't

- **What people put in links.** Anyone can make a display that says anything, on any site that hosts BIGWORDS.PAGE. That's how the project works, and nothing is stored to take down. To report a link used for phishing, scams or impersonation, contact whoever runs the site it's on; their contact details may be at the end of that site's `/docs` page.
- **Image hosts seeing viewers.** A display with an image loads it from the image's host, which sees the viewer's IP address, as with any image on the web. The [reference](docs/REFERENCE.md#image) documents this.
