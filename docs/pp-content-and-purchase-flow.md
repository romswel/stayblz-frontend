# Thoroughbred PP content and purchase flow

Updated 2026-11-05. This pass is local UI and navigation work, not a production release or a provider/payment integration.

## Implemented screens

Premium, Basic, Lifetime, TrackMaster Platinum and Daily Racing Form now have separate report destinations. Pricing/track selection is the entry screen for card products; Lifetime starts with horse search. Each has Features, Sample or Free Race, and How to read. Premium, Basic and Platinum also have a subscription information page. The reference catalogue names identify formats, not Stayblz-owned products or authorised offers.

The PP section dropdowns stay compact. Report-local page links sit below them. Breadcrumbs include the report parent, and direct child-page entry has a Back-to-report fallback. Thoroughbred navigation is limited to the five supplied report pages. EquiGraphix and Plus Pro have been removed from the catalogue, navigation and valid destinations. Harness pages remain for later work.

Pricing and tracks: choose a date from real published entries, select tracks or a day-pass interest, and add the selection to the preview cart. No source tracks are copied into the application. Empty dated records produce an empty state. Race entries do not establish report availability. The current overview API is bounded, so these are not a complete provider catalogue.

Lifetime: search published horse names. Year and dam inputs show the intended provider-search flow, but clearly report that registry search is unavailable. No guessed birth years, pedigree matches or lifetime records are produced.

Cart: selections are scoped to the signed-in account in sessionStorage for the current browser tab, bounded to 40 entries, validated on load and deduplicated by product/type/date/track/horse. The header opens a review dialog, and /pps/cart provides a full review page. Remove and clear work. No prices, totals, orders, payments, entitlements or paid files exist. This browser store must never establish a price or authorise a download.

## Content scope and sources

Primary design/content scope: the user's 12 screenshots, supplied on 2026-11-05. Explanations are rewritten in short, original English. The useful structures are report features, reading help, date/track selection, single-card/day-pass/subscription distinctions, Lifetime horse search, sample/free-race areas and related report links. Marketing paragraphs, advertisements, racing examples, horse data, images, QR codes and PDFs were not copied into the product.

Official references checked:

- https://tvg.equibase.com/newsite2/PremiumPP.cfm - Premium report fields and the distinction between charts/replays/ratings.
- https://www.trackmaster.com/products/tpp - official product listing found in search; direct access returned 403.
- https://www1.drf.com/Equibase/Products.do - DRF's page identifies other providers' products as distributed options.
- https://www.jockeyclub.com/default.asp?archives=show&area=10&section=Resources&story=163 - a historical 2004 announcement identifies the equineline relationship for Lifetime reports; not evidence of current commercial terms.
- https://www.dmtc.com/media/news/equibase-the-keeper-of-racings-treasure-trove-of-information-2658 - track entry files, chart collection and distribution context.

The main equibase.com site and attempted terms page returned 403. No access controls were bypassed and no bulk extraction was performed. The actual 50201, 50316 and 50208 PDF attachments were not available in the workspace; screenshots show their viewers, not reusable source files. No sample PDFs are bundled or hotlinked.

## What makes a PP file

The published racing explanation describes track entries being combined with historical starts and race charts. A report service can assemble those structured records into a PDF layout. The research does not reveal Equibase's private implementation or establish that Stayblz can reuse its output. Provider-defined figures and analysis remain distinct from general race fields.

For Stayblz, the later implementation can either deliver provider-supplied files under an approved arrangement, or generate Stayblz PDFs on the server from data we may use. Sample availability does not establish redistribution or resale rights. Record source, permitted use and attribution per dataset/file before using it. Do not copy speed-figure algorithms, branded reports, editorial picks, private data or advertising into the app.

## Later checkout and delivery

An authoritative catalogue must define real products, prices/currency, dates, track coverage, plan limits and approved files. The server then validates selections, creates a pending order and payment session, verifies the payment provider's signed webhook, grants account entitlements and provides authorised downloads from private storage. Payment completion must not rely on a browser redirect or editable cart state. Define refunds, cancellations and subscription renewals before offering plans. This is a future design, not implemented checkout.

Related-product cards are ordinary internal navigation, not ads. Provider promotions in the reference are not copied. External partnerships/ads can be designed later with clear labels and agreed destinations.
