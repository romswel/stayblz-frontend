# Stayblz feature check — 2026-11-03

This compares the current application with the supplied mock and Equibase screenshots. A page or database table does not mean an official racing feed is connected. The production racing API currently returns eight empty lists.

## From the mock

| Feature | Current status | Where to find it |
| --- | --- | --- |
| Account, profile and login | Available; signup and recovery still depend on provider email settings | Header account button |
| Messages | Saved personal conversations and invitations | Messages |
| Horse inventory and horse details | Saved records; owners and managers can add and edit | Stable workspace → Inventory |
| Horse condition and training | Saved tracking records | Stable workspace → Horse Tracker |
| Stable feed | Saved team updates | Stable workspace → Workspace overview |
| Stable counts | Calculated from the selected stable's records | Workspace overview |
| Upcoming races for stable horses | Shown from manually entered next-race details; not an official entry feed | Workspace overview and Horse Tracker |
| Team messages | Saved conversations restricted to current stable members who participate | Stable workspace → Team messages |
| Followed horses | Saved per account; expanded to jockeys and trainers | Following & notebook |
| Betting, wallet and deposits | The mock used simulated credits. No real betting or payment service is connected | No active betting controls |
| Unread counts, read receipts and live message updates | Not implemented; refresh conversations to check replies | Messages and Team messages |

Stable tools are optional. Customers can create or join a stable. Platform superadmin status does not grant access to another team's private conversations.

## From the Equibase screenshot

| Feature | Current status |
| --- | --- |
| Race entries, results and workouts | Basic published-record pages exist. No official feed, runner-level race program, full result chart, fractional times or replay service is connected. |
| Graded stakes entries and results | Basic stakes schedule exists. Grade, purse, starters, past-performance downloads and dedicated stakes-result records are missing. The Results tab currently shows general results. |
| Horse, jockey and trainer leaderboards | Basic starts, wins and stored horse speed figures are supported. Earnings tables, season/track rankings, owner/sire rankings and full history are missing. No speed-figure calculation service exists. |
| Daily insights | Current page only compares stored speed figures. Stride, class, breeding and other detailed analysis from the reference are missing. |
| Virtual Stable | Saved follows are available. Automatic entry/workout/result alerts and email delivery are not connected. |
| News and featured stories | Published news storage and views exist. No external news service or publishing interface is connected. |
| Race-day changes, scratches and cancellations | No dedicated structured service; general published news is not a replacement. |
| Free daily reports, selections and replays | Missing; needs an authorized content source. |
| Weekly featured race and broadcast schedule | Missing. |
| Carryovers, payouts and betting pools | Missing. |
| Race Lens and handicapping tools | Missing. |
| Owner spotlight | Missing. |
| Paid products, subscriptions, cart and checkout | Five Thoroughbred report flows and an account-scoped browser-tab cart preview are available locally. Prices, payments, orders and licensed file delivery are not connected. |
| Industry links, about/contact and policy pages | Help/FAQ exists. Business contact details, policies and partner links still need approved content. |

## Later data and service work

Continue the page designs and navigation first. The items below are later integration work.

1. Choose an authorized racing data source and a way to add and update records. This is the main reason the dashboard is empty.
2. Add full race details, runner entries, scratches, changes and complete result charts.
3. Add historical horse/connection profiles and leaderboards with track and year filters.
4. Connect saved follows to automatic alerts; add message updates and unread state.
5. Add approved news, reports, replays and other products once their sources and terms are settled.

Keep sample or paid data out of production until its source and use are approved. Do not describe any item above as completed based only on its heading or design.


## 2026-11-04: page design and flow first

The user clarified that data integration can follow later. Continue building each requested reference page and its actual navigation flow with honest empty/unavailable states. Do not make feed setup a blocker for the UI work. The current PP pass adds an expandable sidebar group, a seven-card Thoroughbred/Harness overview at /pps, eight product-detail destinations including Lifetime PPs, comparison, track browsing, day-pass and store pages. Report pictures are code-built layout previews. Catalogue prices, downloads, provider connections and payments remain unavailable; no reference prices are copied as current offers. Other Equibase menu groups will be handled page by page, not claimed complete by this PP pass.

2026-11-05: Premium, Basic, Lifetime, Platinum and Daily Racing Form now have Features, Sample/Free Race and reading-guide pages, with subscription information where applicable. Track/date and horse selections connect to a preview cart using real published records. No vendor PDF files, current vendor prices, ads, editorial picks or proprietary ratings were copied. See pp-content-and-purchase-flow.md for sources and later integration work.
