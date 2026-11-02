# Race Center design system

The interface uses original slash marks, restrained diagonal panels and technical labels to suggest racing. It does not reproduce the official F1 logo or a broadcast graphic. Existing verified driver, car and historical photographs remain attributed source material.

## Tokens

| Role | Value | Use |
| --- | --- | --- |
| Canvas | `#101114` | Main workspace |
| Surface | `#191b20` | Cards and panels |
| Raised surface | `#202329` | Controls and selected areas |
| Divider | `#34373f` | Panel and table boundaries |
| Primary text | `#f4f4f6` | Headings and values |
| Secondary text | `#b2b5bf` | Labels and metadata |
| Racing red | `#e10600` | Primary actions and structural accents |
| Accessible red text | `#ff817a` | Red words and status information |
| Confirmed status | `#85d8ba` | Published, matching race results |
| Pending/unknown status | `#e8c388` | Unconfirmed events and stale data |
| Focus | `#f4d680` | Three-pixel keyboard outlines |

Team colors are read from the existing season-scoped metadata and constrained to six-digit hex colors. They are decorative lines/bars; labels, names, positions and points remain readable without distinguishing colors. Unknown team color falls back to neutral gray.

## Typography and numbers

Self-hosted Titillium Web Latin WOFF2, weights 400, 600 and 700; 400/700 preload once. Display italics use the same family. There are no remote font CSS requests, secondary font downloads or icon libraries. System monospace is used for aligned timing data. Numeric statistics use tabular numerals.

Desktop headings scale from 29–43px and the next-race display to 63px. Supporting copy is 13–16px. Technical eyebrows use spaced uppercase text; the smallest are decorative context while associated headings and values carry the information. Data tables retain semantic headers and captions.

## Layout and spacing

Base rhythm: 4px; usual panel padding 20–28px and gaps 20–24px. Corners use a restrained 4–6px radius. A fixed 228px sidebar becomes 206px on smaller desktops, then an accessible drawer below 1024px. The main workspace has a capped width, an unfixed top bar and a normal-flow footer. Safe-area padding protects lower controls.

Dashboard: asymmetric event/result panels, a season context strip and two championship tables. Driver and champion cards use three columns at ordinary desktop sizes, two on medium screens, one on mobile and four on large screens. Constructors use two columns on desktop. Race cards become a vertical event timeline on mobile. Wide results tables scroll within a labeled focusable region; the document itself remains within the viewport.

Only Bootstrap 6's Sass container, grid and form-label foundations are compiled, with `@use`. Its responsive grid syntax uses `xl:col-7` / `xl:col-5`. Custom tokens and Vue components define the visual identity. No Bootstrap JavaScript, popover library, date picker, state-management package or chart library is shipped.

## Interaction standards

Search and filters update reactive results and the URL without reloads. Driver selection has a visible count and a two-driver limit. Native `details` controls expose profile/history/attribution information. Session/panel controls use explicit selected states; unavailable sessions never imply that a session occurred. Race selection links into the Race Center.

Buttons and form controls are at least 44px tall. Navigation uses `aria-current`; comparison/panel buttons use `aria-pressed`. The mobile drawer exposes modal semantics, moves initial focus, traps Tab/Shift+Tab, closes with Escape and restores the opener. Main content is inert while the drawer is open. Route changes orient keyboard focus to the new heading. Retry failures restore focus to the retry control. A skip link reaches the main landmark.

Cards move at most 3px on hover. Transitions affect transform/background/border over about 160–180ms. There are no continuous decorative animations, made-up gauges or interpolated race charts. Reduced motion disables meaningful transitions. The countdown changes from the actual scheduled timestamp; the application updates clock-derived status every 30 seconds and on tab visibility changes, with no live-session inference.

## Data states and visualization

Loading is a static reserved panel, empty is a distinct explanatory state and failure includes a retry control. Global freshness distinguishes network publication, cached data, stale fallback and partial failure. Race results also show their own timestamp/source. A neutral silhouette explicitly labels unavailable portraits, while original source credits remain available.

Comparison bars use absolute verified values, textual names, numbers and units. Native text is always visible; an expandable semantic table provides an alternative. The championship position chart explicitly explains that a smaller position is better. Season points/wins/positions and archive titles through 2025 are separated. Missing data is written as unavailable, never synthesized into a result or telemetry trace.

Automated and keyboard checks are documented in the report. These standards and zero axe findings do not establish formal WCAG conformance.
