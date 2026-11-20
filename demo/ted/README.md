# TED design system files

The demo page takes the TED look from these files, copied unchanged from the TED design system
(`design-system/` in [ted-web-style-guide](https://sdlc.webcloud.ec.europa.eu/ted/ted-code/ted-web-style-guide),
commit `533a76f9db74a30b21018b7dc6d32712e7e14dc3`), at the same relative paths:

- `tokens.css` and the token files in `tokens/` that the page needs;
- `fonts/Phosphor.woff2`, the icon font, and its licence;
- `assets/`, the EU and Publications Office logos that the header and footer show.

The page leaves out `tokens/fonts.css` (Inter, for application screens, loaded from Google Fonts) and the
eUI files, which it does not use.

The markup of the header and footer in `../index.html` is that of the design system's `SiteHeader` and
`SiteFooter` components at the same commit, rendered to static HTML. Do not edit these files: to update
them, copy them again from a newer commit and note it here.
