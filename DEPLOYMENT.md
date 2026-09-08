# Deploying the Digital Catapult

Most people who need the simulator will not have Node or npm, and should not
have to. This describes how to get it to them.

---

## The short version

**`standalone/digital-catapult.html` is the whole application in one 35 kB
file.** No installer, no server, no dependencies, no internet connection. Send
it to someone and they double-click it.

Everything below is about *where to put that file*.

| Situation | Do this |
|---|---|
| You have any internal web server | Host the file, share the URL. Best experience. |
| You have no web server | Distribute the file itself — Teams, email, network share, OneDrive. Users download and double-click. |
| You must use SharePoint | Use it as the file store. Rendering HTML apps inline is blocked by default; see below. |
| You must use Confluence | Attach the file to a page for download. Cloud cannot render it inline without a marketplace app. |

---

## Building the file

Only one person needs npm, once per release:

```bash
npm install
npm run build:standalone
# -> standalone/digital-catapult.html
```

The build inlines the CSS and JavaScript and verifies that nothing external
survived; it fails loudly rather than producing a page that silently does
nothing. A copy is committed to the repository, so if the version there is
current you can skip this entirely and just download it.

> **Why not just use `npm run build`?** That produces a `dist/` folder whose
> `index.html` loads a separate ES module. Browsers treat module scripts loaded
> over `file://` as cross-origin and block them, so a double-clicked page would
> show an empty screen. The standalone build emits a classic (IIFE) script and
> inlines it. Use `dist/` when serving over HTTP, `standalone/` everywhere else.

---

## Option A — Any static web host (recommended)

One file, no build step on the server, no application runtime. All of these
work:

- IIS: drop it in a virtual directory or `wwwroot`
- Apache / nginx: drop it in the document root
- GitHub Pages, GitLab Pages, Azure Static Web Apps, S3 or Azure Blob static hosting
- An existing intranet site — most teams already have somewhere to put a page
- Artifactory / Nexus generic repository

Rename it to `index.html` if you want a clean folder URL.

This is the best option because people get a link. Links can be bookmarked, put
in a calendar invite, embedded in Confluence or SharePoint as an iframe, and
added to Teams as a **Website** tab. Updating is one file copy, and everyone
gets the new version immediately.

---

## Option B — No infrastructure at all

The file works from disk. Any of these are fine:

- **Microsoft Teams** — upload to a channel's *Files* tab. Members download and open.
- **Email** — 35 kB, well under any attachment limit. Some gateways strip or
  rename `.html` attachments; if yours does, zip it first.
- **Network share / shared drive** — put it in a folder and send the path.
  Opening directly from a UNC path (`\\server\share\file.html`) usually works;
  if the browser refuses, copy it to the desktop first.
- **OneDrive / SharePoint document library** — as a *download*, not an inline
  app. See the SharePoint notes below.

Tell users explicitly: **download it first, then open it.** Opening from a
preview pane inside a web app is what fails, not the file.

---

## Option C — SharePoint

SharePoint Online will store and distribute the file happily. Getting it to
*run inline* is a different matter.

**What works reliably.** Upload `digital-catapult.html` to a document library.
Create a page that explains what it is and links to the file. Users click the
link, the browser downloads the file, they open it. Done.

**Why inline rendering usually fails.** Modern SharePoint Online sites have
custom scripting disabled by default, and HTML files served from document
libraries are returned as downloads rather than rendered — deliberately, to
stop stored cross-site scripting. This is a tenant/site policy, not something
the file can work around.

**If you want it to render inline**, you need your SharePoint administrator to:

1. Allow custom script on that specific site — in the SharePoint admin centre
   under the site's settings, or with PnP/SPO PowerShell
   (`Set-SPOSite -Identity <site-url> -DenyAddAndCustomizePages $false`).
2. Add the hosting domain to **HTML Field Security** for the site if you intend
   to embed it in a page with the **Embed** web part, which only accepts iframes
   from allow-listed domains.

Both weaken the site's security posture, and many organisations will decline —
reasonably. If your admin says no, Option A or B is the answer, and the security
notes below will help you make the case for hosting it somewhere ordinary.

**A middle path that often gets approved:** host the file on a normal internal
web server (Option A) and embed *that* URL in a SharePoint page with the Embed
web part, once the domain is allow-listed. SharePoint then hosts the page, not
the application.

---

## Option D — Confluence

**Confluence Cloud.** There is no built-in HTML macro — it was removed for
security reasons and is not coming back. HTML attachments are served as
downloads, so an attached copy will not render inline either. Two workable
approaches:

- *Attach and link.* Attach `digital-catapult.html` to a page, and write the lab
  instructions around it. Users download and open. This needs no admin
  involvement and is what most teams end up doing.
- *Host and embed.* Put the file on a static host (Option A) and use the
  **Iframe** macro from a Marketplace app, or the built-in **Embed**/smart-link
  behaviour, pointing at the URL. Requires the app to be installed and, usually,
  the domain to be permitted.

**Confluence Data Center / Server.** The **HTML** and **HTML Include** macros
exist but are disabled by default. If your admin enables the HTML macro, you can
paste the entire contents of the file into it and the simulator will render
directly in the page. Ask specifically about the `confluence-html-macros`
system app. If they decline, attach-and-link works exactly as on Cloud.

Either way, Confluence is an excellent home for the **course material** —
`course/student-workbook.md` and `course/instructor-guide.md` paste in as
ordinary pages, with the simulator linked or embedded alongside.

---

## Browser requirements

Any current browser: Chrome, Edge, Firefox or Safari from roughly 2021 onward.
The application uses standard ES2020 JavaScript and a `<canvas>` element.

**Internet Explorer 11 will not work** and cannot be made to. If IE11 is still
mandated somewhere in your organisation, those users need Edge — which is
installed alongside it on every supported Windows build.

Nothing else is required: no plugins, no Java, no Flash, no extensions, no
administrator rights to run it.

---

## Notes for a security review

If IT needs to sign off, these are the facts, and they are easy to verify by
opening the file in a text editor:

- **No network activity of any kind.** No `fetch`, no `XMLHttpRequest`, no
  WebSocket, no beacons, no analytics, no telemetry. The file makes zero
  requests after it loads.
- **No external references.** No CDN, no remote scripts, fonts, stylesheets or
  images. Everything is inline; there are no `http://` or `https://` URLs in the
  file at all.
- **No stored data.** No cookies, no `localStorage`, no `sessionStorage`, no
  IndexedDB. Closing the tab discards everything.
- **No user data collected or transmitted.** The only data that leaves the page
  does so because the user pressed *Export CSV* or *Copy to Clipboard*.
- **Readable source.** 35 kB, and the unminified source is in this repository.

To verify the first two claims yourself:

```bash
grep -c 'fetch(\|XMLHttpRequest\|WebSocket\|sendBeacon' standalone/digital-catapult.html   # 0
grep -c 'http://\|https://'                              standalone/digital-catapult.html   # 0
```

---

## Versioning and updates

The file carries no auto-update mechanism, which is the trade-off for having no
server. When you publish a new version:

- **Hosted (Option A):** replace the file. Tell users to hard-refresh
  (Ctrl+F5) if they see the old one.
- **Distributed (Option B, C, D):** put the date or a version in the filename —
  `digital-catapult-2026-09.html` — so people can tell copies apart. Copies
  already on desktops will not update themselves.

For a course, this matters less than it looks: the seeded data sets mean any
given version reproduces the same numbers, and the workbook's answers are tied
to the physics rather than to a build date. But if you change the physics,
regenerate the course data (`node doe/run-study.mjs --write`) and reissue both
together.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Blank page, nothing renders | Opened a `dist/` build from `file://`, not the standalone file | Use `standalone/digital-catapult.html` |
| Page opens as text, or downloads instead of running | Served with the wrong content type, or previewed inside a web app | Save it to disk and open it from there |
| Nothing happens on *Run* | Very old browser | Use Chrome, Edge, Firefox or Safari |
| *Copy to Clipboard* reports it was blocked | Managed browser policy denies clipboard access | Use *Export CSV* — same data, as a file |
| Numbers differ from the workbook | Seed empty, or rows entered in a different order | Use *Load DOE design*, and set the seed the lab specifies |
| Canvas is blurry | Browser zoom set to a fractional level | Reset zoom to 100% |
