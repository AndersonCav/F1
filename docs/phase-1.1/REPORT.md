# Phase 1.1 — Historical Champion Images Recovery & Reliability

Validation date: 1 November 2026 (America/Sao_Paulo). Browser: Chrome 156.0.8078.80. Repository: https://github.com/AndersonCav/F1. Validation used ephemeral local HTTP servers at the root and under /F1/; no deployment.

## 1. Phase Status

PHASE_1_1_COMPLETE

All 33 existing champion photographs have approved provenance/licensing and decode in actual Chrome on desktop and mobile. No placeholder is included in the recovery count. All existing Phase 1 checks and the new regression tests pass.

## 2. Root Cause Analysis

All 33 original configured URLs returned HTTP 400 with Content-Type text/html; these were error documents, not photographs. The existing CSP already permitted upload.wikimedia.org. The previously observed ERR_BLOCKED_BY_ORB is consistent with Chrome blocking those non-image error responses in an image request; expanding CSP alone could not recover them.

There were two independent defects. First, every URL manually requested a nonstandard 512px thumbnail. Wikimedia now restricts direct thumbnail requests to its supported size steps; see [MediaWiki common thumbnail sizes](https://www.mediawiki.org/wiki/Common_thumbnail_sizes). Second, the Commons API found 28 exact original file titles missing and four other files at different canonical paths or renamed titles. Only Max Verstappen's original path worked at a supported 250px size. A diagnostic 250px probe of the original paths returned 32 HTTP 404 responses and one HTTP 200, demonstrating why an arbitrary size substitution was insufficient. Missing titles do not establish whether those files were deleted or never existed.

Replacement URLs came from the official [Imageinfo API](https://www.mediawiki.org/wiki/API:Imageinfo), requesting url, extmetadata, size, mime and sha1 with iiurlwidth=250. The API returned 32 supported thumbnails on thumb.wikimedia.org and Hawthorn's smaller original on upload.wikimedia.org. The latter actually decodes at 217×308 although the API's requested presentation dimensions say 250×355; the audit records decoded dimensions. No hand-built file hashes or arbitrary resizing paths are used in production.

**Decision: A — validated external URLs.** The supported thumbnails are small enough for the existing 100px portraits, openly licensed, and verified in Chrome. Keeping them external avoids copying/maintaining 33 derivative assets and increasing the mandatory offline payload. [Commons permits hotlinking subject to the same license obligations](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia/technical). Local hosting would provide more control if provider reliability later proves inadequate, but was not justified by the successful canonical-source audit. There are no production photo downloads into the repository; the PNGs are browser validation evidence.

Only the exact new image origin thumb.wikimedia.org was added through scripts/sync-csp.mjs, then all six generated HTML policies were synchronized. No wildcard, unsafe-inline/eval, connect-src expansion, inline handler or remote script was introduced. Commons metadata is gathered during maintenance, never queried by the application at runtime.

## 3. Image Recovery Results

| Measure | Final result |
| --- | ---: |
| Existing champions inspected | 33 |
| Original configured photo URLs failing | 33 / 33 |
| Original HTTP error responses that were images | 0 |
| Canonical replacement resources verified HTTP 200 + JPEG content + pinned SHA-256 | 33 / 33 |
| Unique genuine photographs decoded in desktop Chrome | 33 / 33 |
| Genuine photographs decoded in mobile Chrome | 33 / 33 |
| Remaining normal-network photograph failures | 0 |
| Normal-network placeholder fallbacks | 0 |
| Unresolved image licensing/attribution concerns | 0 |

Identity review combined the named champion article lead image or named archive/file description, Commons filename/categories and source credits, plus visual inspection of every labeled photograph in [the contact sheet](browser/identity-contact-sheet.png). Phil Hill's cropped file was checked against the description distinguishing him from Jackie Stewart. Hawthorn and Surtees use explicitly named archive photographs. Rosberg uses a tighter, separately reviewed portrait to fit the existing square crop. Automated hashes preserve these reviewed associations; they are not face recognition and do not independently prove a new image's identity.

The three public-domain grants are documented individually: Ascari uses PD-AR-Photo plus PD-1996 (Argentina); Scheckter is an official U.S. Navy photograph (PD-USGov-Military); Jones was released by its photographer (PD-release, original upload by Lutz H). Six photographs use CC0. The others use CC BY, CC BY-SA or OGL 3. Hamilton's credit includes the OGL public-sector information notice. Every displayed credit links the source file and the applicable license/grant; derivative creators are retained where supplied. The source-file title is available on the credit link, and the displayed crop is identified as a framed thumbnail. Full provenance and grant evidence are preserved in [image-audit.json](image-audit.json). The contact sheet's source credits and licenses are the same as those below.

All original sources are Wikimedia Commons delivery URLs. Original response Content-Type was text/html; all final delivered resources are image/jpeg. Every final browser result below means a real approved photograph, successful decoding and nonzero natural dimensions, with zero placeholder substitution.

| Champion | Original photo URL | Original HTTP / content | Failure root cause | Replacement source and photo URL | Replacement HTTP / content | License / attribution | Final browser-loading result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Juan Manuel Fangio | [Original 512px URL](<https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Juan_Manuel_Fangio_1957.jpg/512px-Juan_Manuel_Fangio_1957.jpg>) | 400; text/html | Unsupported 512px thumbnail; Commons file title missing | [File:Fangio in 1955 (cropped).jpg](<https://commons.wikimedia.org/wiki/File:Fangio_in_1955_(cropped).jpg>); [delivered JPEG](<https://thumb.wikimedia.org/wikipedia/commons/thumb/2/20/Fangio_in_1955_%28cropped%29.jpg/250px-Fangio_in_1955_%28cropped%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail>) | 200; image/jpeg | [CC BY 4.0](<https://creativecommons.org/licenses/by/4.0>) — Bjørn Fjørtoft / Riksarkivet | Desktop + mobile: decoded 250×333; genuine; no fallback |
| Alberto Ascari | [Original 512px URL](<https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Alberto_Ascari_circa_1950s.jpg/512px-Alberto_Ascari_circa_1950s.jpg>) | 400; text/html | Unsupported 512px thumbnail; Commons file title missing | [File:Ascari last photo in car.jpg](<https://commons.wikimedia.org/wiki/File:Ascari_last_photo_in_car.jpg>); [delivered JPEG](<https://thumb.wikimedia.org/wikipedia/commons/thumb/6/69/Ascari_last_photo_in_car.jpg/250px-Ascari_last_photo_in_car.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail>) | 200; image/jpeg | [Public domain](<https://commons.wikimedia.org/wiki/File:Ascari_last_photo_in_car.jpg#Licensing>) — Autor desconhecido / El Gráfico | Desktop + mobile: decoded 250×384; genuine; no fallback |
| Mike Hawthorn | [Original 512px URL](<https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Mike_Hawthorn_1958.jpg/512px-Mike_Hawthorn_1958.jpg>) | 400; text/html | Unsupported 512px thumbnail; Commons file title missing | [File:Mike Hawthorn, autocoureur verongelukt, Bestanddeelnr 910-1117.jpg](<https://commons.wikimedia.org/wiki/File:Mike_Hawthorn,_autocoureur_verongelukt,_Bestanddeelnr_910-1117.jpg>); [delivered JPEG](<https://upload.wikimedia.org/wikipedia/commons/2/2a/Mike_Hawthorn%2C_autocoureur_verongelukt%2C_Bestanddeelnr_910-1117.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail_unscaled>) | 200; image/jpeg | [CC0](<https://creativecommons.org/publicdomain/zero/1.0/deed.en>) — Herbert Behrens / Anefo | Desktop + mobile: decoded 217×308; genuine; no fallback |
| Jack Brabham | [Original 512px URL](<https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Jack_Brabham_1966.jpg/512px-Jack_Brabham_1966.jpg>) | 400; text/html | Unsupported 512px thumbnail; Commons file title missing | [File:BrabhamJack1966B.jpg](<https://commons.wikimedia.org/wiki/File:BrabhamJack1966B.jpg>); [delivered JPEG](<https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e7/BrabhamJack1966B.jpg/250px-BrabhamJack1966B.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail>) | 200; image/jpeg | [CC BY-SA 2.0 de](<https://creativecommons.org/licenses/by-sa/2.0/de/deed.en>) — Lothar Spurzem | Desktop + mobile: decoded 250×352; genuine; no fallback |
| Phil Hill | [Original 512px URL](<https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Phil_Hill_1962.jpg/512px-Phil_Hill_1962.jpg>) | 400; text/html | Unsupported 512px thumbnail; Commons file title missing | [File:Phil Hill 1991 USA (cropped).jpg](<https://commons.wikimedia.org/wiki/File:Phil_Hill_1991_USA_(cropped).jpg>); [delivered JPEG](<https://thumb.wikimedia.org/wikipedia/commons/thumb/8/84/Phil_Hill_1991_USA_%28cropped%29.jpg/250px-Phil_Hill_1991_USA_%28cropped%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail>) | 200; image/jpeg | [CC BY 2.0](<https://creativecommons.org/licenses/by/2.0>) — Stuart Seeger | Desktop + mobile: decoded 250×388; genuine; no fallback |
| Graham Hill | [Original 512px URL](<https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Graham_Hill_1969.jpg/512px-Graham_Hill_1969.jpg>) | 400; text/html | Unsupported 512px thumbnail; Commons file title missing | [File:Graham Hill Bestanddeelnr 924-6564.jpg](<https://commons.wikimedia.org/wiki/File:Graham_Hill_Bestanddeelnr_924-6564.jpg>); [delivered JPEG](<https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fc/Graham_Hill_Bestanddeelnr_924-6564.jpg/250px-Graham_Hill_Bestanddeelnr_924-6564.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail>) | 200; image/jpeg | [CC0](<https://creativecommons.org/publicdomain/zero/1.0/deed.en>) — Anefo / Nationaal Archief | Desktop + mobile: decoded 250×313; genuine; no fallback |
| Jim Clark | [Original 512px URL](<https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Jim_Clark_1965.jpg/512px-Jim_Clark_1965.jpg>) | 400; text/html | Unsupported 512px thumbnail; incorrect storage path (or renamed file) | [File:Jim Clark in 1963 (cropped).JPG](<https://commons.wikimedia.org/wiki/File:Jim_Clark_in_1963_(cropped).JPG>); [delivered JPEG](<https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4f/Jim_Clark_in_1963_%28cropped%29.JPG/250px-Jim_Clark_in_1963_%28cropped%29.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail>) | 200; image/jpeg | [CC0](<https://creativecommons.org/publicdomain/zero/1.0/deed.en>) — Joop van Bilsen / Anefo | Desktop + mobile: decoded 250×333; genuine; no fallback |
| John Surtees | [Original 512px URL](<https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/John_Surtees_1964.jpg/512px-John_Surtees_1964.jpg>) | 400; text/html | Unsupported 512px thumbnail; Commons file title missing | [File:Training Grand Prix te Zandvoort, John Surtees bij zijn nieuwe wagen, Bestanddeelnr 916-4625 (cropped).jpg](<https://commons.wikimedia.org/wiki/File:Training_Grand_Prix_te_Zandvoort,_John_Surtees_bij_zijn_nieuwe_wagen,_Bestanddeelnr_916-4625_(cropped).jpg>); [delivered JPEG](<https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3c/Training_Grand_Prix_te_Zandvoort%2C_John_Surtees_bij_zijn_nieuwe_wagen%2C_Bestanddeelnr_916-4625_%28cropped%29.jpg/250px-Training_Grand_Prix_te_Zandvoort%2C_John_Surtees_bij_zijn_nieuwe_wagen%2C_Bestanddeelnr_916-4625_%28cropped%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail>) | 200; image/jpeg | [CC0](<https://creativecommons.org/publicdomain/zero/1.0/deed.en>) — Harry Pot / Anefo | Desktop + mobile: decoded 250×325; genuine; no fallback |
| Denny Hulme | [Original 512px URL](<https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Denny_Hulme_1967.jpg/512px-Denny_Hulme_1967.jpg>) | 400; text/html | Unsupported 512px thumbnail; Commons file title missing | [File:HulmeDenis196508 (cropped).jpg](<https://commons.wikimedia.org/wiki/File:HulmeDenis196508_(cropped).jpg>); [delivered JPEG](<https://thumb.wikimedia.org/wikipedia/commons/thumb/9/92/HulmeDenis196508_%28cropped%29.jpg/250px-HulmeDenis196508_%28cropped%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail>) | 200; image/jpeg | [CC BY-SA 2.0 de](<https://creativecommons.org/licenses/by-sa/2.0/de/deed.en>) — Lothar Spurzem | Desktop + mobile: decoded 250×249; genuine; no fallback |
| Jackie Stewart | [Original 512px URL](<https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/Jackie_Stewart_1973.jpg/512px-Jackie_Stewart_1973.jpg>) | 400; text/html | Unsupported 512px thumbnail; Commons file title missing | [File:Jackie Stewart at the 2014 WEC Silverstone round.jpg](<https://commons.wikimedia.org/wiki/File:Jackie_Stewart_at_the_2014_WEC_Silverstone_round.jpg>); [delivered JPEG](<https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4b/Jackie_Stewart_at_the_2014_WEC_Silverstone_round.jpg/250px-Jackie_Stewart_at_the_2014_WEC_Silverstone_round.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail>) | 200; image/jpeg | [CC BY 2.0](<https://creativecommons.org/licenses/by/2.0>) — David Merrett | Desktop + mobile: decoded 250×376; genuine; no fallback |
| Jochen Rindt | [Original 512px URL](<https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Jochen_Rindt_1970.jpg/512px-Jochen_Rindt_1970.jpg>) | 400; text/html | Unsupported 512px thumbnail; Commons file title missing | [File:Rindt at 1970 Dutch Grand Prix (2C).jpg](<https://commons.wikimedia.org/wiki/File:Rindt_at_1970_Dutch_Grand_Prix_(2C).jpg>); [delivered JPEG](<https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cb/Rindt_at_1970_Dutch_Grand_Prix_%282C%29.jpg/250px-Rindt_at_1970_Dutch_Grand_Prix_%282C%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail>) | 200; image/jpeg | [CC BY-SA 3.0 nl](<https://creativecommons.org/licenses/by-sa/3.0/nl/deed.en>) — Joost Evers / Anefo | Desktop + mobile: decoded 250×334; genuine; no fallback |
| Emerson Fittipaldi | [Original 512px URL](<https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Emerson_Fittipaldi_1974.jpg/512px-Emerson_Fittipaldi_1974.jpg>) | 400; text/html | Unsupported 512px thumbnail; Commons file title missing | [File:Emerson Fittipaldi in 2020 (cropped).JPG](<https://commons.wikimedia.org/wiki/File:Emerson_Fittipaldi_in_2020_(cropped).JPG>); [delivered JPEG](<https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5e/Emerson_Fittipaldi_in_2020_%28cropped%29.JPG/250px-Emerson_Fittipaldi_in_2020_%28cropped%29.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail>) | 200; image/jpeg | [CC BY 2.0](<https://creativecommons.org/licenses/by/2.0>) — Alan Santos / PR / Palácio do Planalto | Desktop + mobile: decoded 250×351; genuine; no fallback |
| Niki Lauda | [Original 512px URL](<https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Niki_Lauda_1984.jpg/512px-Niki_Lauda_1984.jpg>) | 400; text/html | Unsupported 512px thumbnail; Commons file title missing | [File:Lauda at 1982 Dutch Grand Prix.jpg](<https://commons.wikimedia.org/wiki/File:Lauda_at_1982_Dutch_Grand_Prix.jpg>); [delivered JPEG](<https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2d/Lauda_at_1982_Dutch_Grand_Prix.jpg/250px-Lauda_at_1982_Dutch_Grand_Prix.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail>) | 200; image/jpeg | [CC0](<https://creativecommons.org/publicdomain/zero/1.0/deed.en>) — Hans van Dijk / Anefo | Desktop + mobile: decoded 250×343; genuine; no fallback |
| James Hunt | [Original 512px URL](<https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/James_Hunt_1977.jpg/512px-James_Hunt_1977.jpg>) | 400; text/html | Unsupported 512px thumbnail; Commons file title missing | [File:J. Hunt in 1977 (cropped).jpg](<https://commons.wikimedia.org/wiki/File:J._Hunt_in_1977_(cropped).jpg>); [delivered JPEG](<https://thumb.wikimedia.org/wikipedia/commons/thumb/1/12/J._Hunt_in_1977_%28cropped%29.jpg/250px-J._Hunt_in_1977_%28cropped%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail>) | 200; image/jpeg | [CC BY-SA 3.0](<https://creativecommons.org/licenses/by-sa/3.0>) — Father of Mr.choppers; digitization and alterations: Mr.choppers | Desktop + mobile: decoded 250×335; genuine; no fallback |
| Mario Andretti | [Original 512px URL](<https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Mario_Andretti_1978.jpg/512px-Mario_Andretti_1978.jpg>) | 400; text/html | Unsupported 512px thumbnail; Commons file title missing | [File:Mario Andretti Goodwood Festival of Speed 2021 (cropped).jpg](<https://commons.wikimedia.org/wiki/File:Mario_Andretti_Goodwood_Festival_of_Speed_2021_(cropped).jpg>); [delivered JPEG](<https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c3/Mario_Andretti_Goodwood_Festival_of_Speed_2021_%28cropped%29.jpg/250px-Mario_Andretti_Goodwood_Festival_of_Speed_2021_%28cropped%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail>) | 200; image/jpeg | [CC BY-SA 2.0](<https://creativecommons.org/licenses/by-sa/2.0>) — United Autosports | Desktop + mobile: decoded 250×334; genuine; no fallback |
| Jody Scheckter | [Original 512px URL](<https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Jody_Scheckter_1979.jpg/512px-Jody_Scheckter_1979.jpg>) | 400; text/html | Unsupported 512px thumbnail; Commons file title missing | [File:Jody Scheckter during the 1979 Monaco Grand Prix.jpg](<https://commons.wikimedia.org/wiki/File:Jody_Scheckter_during_the_1979_Monaco_Grand_Prix.jpg>); [delivered JPEG](<https://thumb.wikimedia.org/wikipedia/commons/thumb/d/dc/Jody_Scheckter_during_the_1979_Monaco_Grand_Prix.jpg/250px-Jody_Scheckter_during_the_1979_Monaco_Grand_Prix.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail>) | 200; image/jpeg | [Public domain](<https://commons.wikimedia.org/wiki/File:Jody_Scheckter_during_the_1979_Monaco_Grand_Prix.jpg#Licensing>) — PH1 John Lucas / U.S. Navy | Desktop + mobile: decoded 250×356; genuine; no fallback |
| Alan Jones | [Original 512px URL](<https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Alan_Jones_1980.jpg/512px-Alan_Jones_1980.jpg>) | 400; text/html | Unsupported 512px thumbnail; incorrect storage path (or renamed file) | [File:Jones alan.JPG](<https://commons.wikimedia.org/wiki/File:Jones_alan.JPG>); [delivered JPEG](<https://thumb.wikimedia.org/wikipedia/commons/thumb/c/ce/Jones_alan.JPG/250px-Jones_alan.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail>) | 200; image/jpeg | [Public domain](<https://commons.wikimedia.org/wiki/File:Jones_alan.JPG#Licensing>) — Lutz H | Desktop + mobile: decoded 250×334; genuine; no fallback |
| Nelson Piquet | [Original 512px URL](<https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Nelson_Piquet_1983.jpg/512px-Nelson_Piquet_1983.jpg>) | 400; text/html | Unsupported 512px thumbnail; Commons file title missing | [File:Cerimonia de entrega da medalha Brasília 60 anos - 16.jpg](<https://commons.wikimedia.org/wiki/File:Cerimonia_de_entrega_da_medalha_Bras%C3%ADlia_60_anos_-_16.jpg>); [delivered JPEG](<https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5b/Cerimonia_de_entrega_da_medalha_Bras%C3%ADlia_60_anos_-_16.jpg/250px-Cerimonia_de_entrega_da_medalha_Bras%C3%ADlia_60_anos_-_16.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail>) | 200; image/jpeg | [CC BY 2.0](<https://creativecommons.org/licenses/by/2.0>) — Agência Brasília | Desktop + mobile: decoded 250×333; genuine; no fallback |
| Keke Rosberg | [Original 512px URL](<https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Keke_Rosberg_1982.jpg/512px-Keke_Rosberg_1982.jpg>) | 400; text/html | Unsupported 512px thumbnail; Commons file title missing | [File:Anefo 932-2378 Keke Rosberg, Zandvoort, 03-07-1982 - Restoration.jpg](<https://commons.wikimedia.org/wiki/File:Anefo_932-2378_Keke_Rosberg,_Zandvoort,_03-07-1982_-_Restoration.jpg>); [delivered JPEG](<https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3c/Anefo_932-2378_Keke_Rosberg%2C_Zandvoort%2C_03-07-1982_-_Restoration.jpg/250px-Anefo_932-2378_Keke_Rosberg%2C_Zandvoort%2C_03-07-1982_-_Restoration.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail>) | 200; image/jpeg | [CC0](<https://creativecommons.org/publicdomain/zero/1.0/deed.en>) — Hans van Dijk / Anefo; restoration: Adam Cuerden | Desktop + mobile: decoded 250×377; genuine; no fallback |
| Alain Prost | [Original 512px URL](<https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Alain_Prost_1988.jpg/512px-Alain_Prost_1988.jpg>) | 400; text/html | Unsupported 512px thumbnail; Commons file title missing | [File:Festival automobile international 2015 - Photocall - 065 (cropped3).jpg](<https://commons.wikimedia.org/wiki/File:Festival_automobile_international_2015_-_Photocall_-_065_(cropped3).jpg>); [delivered JPEG](<https://thumb.wikimedia.org/wikipedia/commons/thumb/7/74/Festival_automobile_international_2015_-_Photocall_-_065_%28cropped3%29.jpg/250px-Festival_automobile_international_2015_-_Photocall_-_065_%28cropped3%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail>) | 200; image/jpeg | [CC BY-SA 4.0](<https://creativecommons.org/licenses/by-sa/4.0>) — Thesupermat | Desktop + mobile: decoded 250×312; genuine; no fallback |
| Ayrton Senna | [Original 512px URL](<https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Ayrton_Senna_1991.jpg/512px-Ayrton_Senna_1991.jpg>) | 400; text/html | Unsupported 512px thumbnail; Commons file title missing | [File:Ayrton Senna Pesawat RC Cropped.jpg](<https://commons.wikimedia.org/wiki/File:Ayrton_Senna_Pesawat_RC_Cropped.jpg>); [delivered JPEG](<https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9f/Ayrton_Senna_Pesawat_RC_Cropped.jpg/250px-Ayrton_Senna_Pesawat_RC_Cropped.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail>) | 200; image/jpeg | [CC BY 2.0](<https://creativecommons.org/licenses/by/2.0>) — Instituto Ayrton Senna; derivative: F1fans | Desktop + mobile: decoded 250×318; genuine; no fallback |
| Nigel Mansell | [Original 512px URL](<https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Nigel_Mansell_1988.jpg/512px-Nigel_Mansell_1988.jpg>) | 400; text/html | Unsupported 512px thumbnail; Commons file title missing | [File:Nigel Mansell - Mexican Grand Prix 01 (cropped).jpeg](<https://commons.wikimedia.org/wiki/File:Nigel_Mansell_-_Mexican_Grand_Prix_01_(cropped).jpeg>); [delivered JPEG](<https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e4/Nigel_Mansell_-_Mexican_Grand_Prix_01_%28cropped%29.jpeg/250px-Nigel_Mansell_-_Mexican_Grand_Prix_01_%28cropped%29.jpeg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail>) | 200; image/jpeg | [CC BY-SA 4.0](<https://creativecommons.org/licenses/by-sa/4.0>) — ProtoplasmaKid | Desktop + mobile: decoded 250×353; genuine; no fallback |
| Michael Schumacher | [Original 512px URL](<https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Michael_Schumacher_2010.jpg/512px-Michael_Schumacher_2010.jpg>) | 400; text/html | Unsupported 512px thumbnail; Commons file title missing | [File:Michael Schumacher, September 2005.jpg](<https://commons.wikimedia.org/wiki/File:Michael_Schumacher,_September_2005.jpg>); [delivered JPEG](<https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c2/Michael_Schumacher%2C_September_2005.jpg/250px-Michael_Schumacher%2C_September_2005.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail>) | 200; image/jpeg | [CC BY 2.0](<https://creativecommons.org/licenses/by/2.0>) — Aécio Neves – Wellington Pedro / Imprensa MG; derivatives: F1fans, FMSky | Desktop + mobile: decoded 250×342; genuine; no fallback |
| Damon Hill | [Original 512px URL](<https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Damon_Hill_1995.jpg/512px-Damon_Hill_1995.jpg>) | 400; text/html | Unsupported 512px thumbnail; incorrect storage path (or renamed file) | [File:Damon Hill at the Atlassian Williams Racing Fan Zone of 2026 (028A8241).jpg](<https://commons.wikimedia.org/wiki/File:Damon_Hill_at_the_Atlassian_Williams_Racing_Fan_Zone_of_2026_(028A8241).jpg>); [delivered JPEG](<https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cf/Damon_Hill_at_the_Atlassian_Williams_Racing_Fan_Zone_of_2026_%28028A8241%29.jpg/250px-Damon_Hill_at_the_Atlassian_Williams_Racing_Fan_Zone_of_2026_%28028A8241%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail>) | 200; image/jpeg | [CC BY-SA 4.0](<https://creativecommons.org/licenses/by-sa/4.0>) — Yu Chu Chin | Desktop + mobile: decoded 250×375; genuine; no fallback |
| Jacques Villeneuve | [Original 512px URL](<https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Jacques_Villeneuve_1996.jpg/512px-Jacques_Villeneuve_1996.jpg>) | 400; text/html | Unsupported 512px thumbnail; incorrect storage path (or renamed file) | [File:Jacques Villeneuve Peugeot 208 T16 Lydden Hill 2014 006 (cropped2).jpg](<https://commons.wikimedia.org/wiki/File:Jacques_Villeneuve_Peugeot_208_T16_Lydden_Hill_2014_006_(cropped2).jpg>); [delivered JPEG](<https://thumb.wikimedia.org/wikipedia/commons/thumb/a/aa/Jacques_Villeneuve_Peugeot_208_T16_Lydden_Hill_2014_006_%28cropped2%29.jpg/250px-Jacques_Villeneuve_Peugeot_208_T16_Lydden_Hill_2014_006_%28cropped2%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail>) | 200; image/jpeg | [CC BY-SA 2.0](<https://creativecommons.org/licenses/by-sa/2.0>) — Smudge 9000 | Desktop + mobile: decoded 250×314; genuine; no fallback |
| Mika Hakkinen | [Original 512px URL](<https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Mika_Hakkinen_1999.jpg/512px-Mika_Hakkinen_1999.jpg>) | 400; text/html | Unsupported 512px thumbnail; Commons file title missing | [File:Mika Häkkinen Champions for Charity 2016-07-27.jpg](<https://commons.wikimedia.org/wiki/File:Mika_H%C3%A4kkinen_Champions_for_Charity_2016-07-27.jpg>); [delivered JPEG](<https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a6/Mika_H%C3%A4kkinen_Champions_for_Charity_2016-07-27.jpg/250px-Mika_H%C3%A4kkinen_Champions_for_Charity_2016-07-27.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail>) | 200; image/jpeg | [CC BY-SA 4.0](<https://creativecommons.org/licenses/by-sa/4.0>) — Sven Mandel | Desktop + mobile: decoded 250×375; genuine; no fallback |
| Fernando Alonso | [Original 512px URL](<https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Fernando_Alonso_2018_Malaysia.jpg/512px-Fernando_Alonso_2018_Malaysia.jpg>) | 400; text/html | Unsupported 512px thumbnail; Commons file title missing | [File:Alonso-68 (24710447098).jpg](<https://commons.wikimedia.org/wiki/File:Alonso-68_(24710447098).jpg>); [delivered JPEG](<https://thumb.wikimedia.org/wikipedia/commons/thumb/9/97/Alonso-68_%2824710447098%29.jpg/250px-Alonso-68_%2824710447098%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail>) | 200; image/jpeg | [CC BY-SA 2.0](<https://creativecommons.org/licenses/by-sa/2.0>) — United Autosports | Desktop + mobile: decoded 250×375; genuine; no fallback |
| Kimi Raikkonen | [Original 512px URL](<https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Kimi_Raikkonen_2018_Malaysia.jpg/512px-Kimi_Raikkonen_2018_Malaysia.jpg>) | 400; text/html | Unsupported 512px thumbnail; Commons file title missing | [File:F12019 Schloss Gabelhofen (22) (cropped).jpg](<https://commons.wikimedia.org/wiki/File:F12019_Schloss_Gabelhofen_(22)_(cropped).jpg>); [delivered JPEG](<https://thumb.wikimedia.org/wikipedia/commons/thumb/f/ff/F12019_Schloss_Gabelhofen_%2822%29_%28cropped%29.jpg/250px-F12019_Schloss_Gabelhofen_%2822%29_%28cropped%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail>) | 200; image/jpeg | [CC BY-SA 4.0](<https://creativecommons.org/licenses/by-sa/4.0>) — XaviYuahanda | Desktop + mobile: decoded 250×318; genuine; no fallback |
| Lewis Hamilton | [Original 512px URL](<https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/Lewis_Hamilton_2022_Paris.jpg/512px-Lewis_Hamilton_2022_Paris.jpg>) | 400; text/html | Unsupported 512px thumbnail; Commons file title missing | [File:Prime Minister Keir Starmer meets Sir Lewis Hamilton (54566928382) (cropped).jpg](<https://commons.wikimedia.org/wiki/File:Prime_Minister_Keir_Starmer_meets_Sir_Lewis_Hamilton_(54566928382)_(cropped).jpg>); [delivered JPEG](<https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d3/Prime_Minister_Keir_Starmer_meets_Sir_Lewis_Hamilton_%2854566928382%29_%28cropped%29.jpg/250px-Prime_Minister_Keir_Starmer_meets_Sir_Lewis_Hamilton_%2854566928382%29_%28cropped%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail>) | 200; image/jpeg | [OGL 3](<https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>) — Picture by Lauren Hurley / No 10 Downing Street. Contains public sector information licensed under the Open Government Licence v3.0 | Desktop + mobile: decoded 250×333; genuine; no fallback |
| Jenson Button | [Original 512px URL](<https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Jenson_Button_2014.jpg/512px-Jenson_Button_2014.jpg>) | 400; text/html | Unsupported 512px thumbnail; Commons file title missing | [File:Jenson Button 2024 WEC Fuji.jpg](<https://commons.wikimedia.org/wiki/File:Jenson_Button_2024_WEC_Fuji.jpg>); [delivered JPEG](<https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0c/Jenson_Button_2024_WEC_Fuji.jpg/250px-Jenson_Button_2024_WEC_Fuji.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail>) | 200; image/jpeg | [CC BY-SA 4.0](<https://creativecommons.org/licenses/by-sa/4.0>) — Morio | Desktop + mobile: decoded 250×375; genuine; no fallback |
| Sebastian Vettel | [Original 512px URL](<https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Sebastian_Vettel_2018.jpg/512px-Sebastian_Vettel_2018.jpg>) | 400; text/html | Unsupported 512px thumbnail; Commons file title missing | [File:Sebastian Vettel at the 2026 Italian Grand Prix.jpg](<https://commons.wikimedia.org/wiki/File:Sebastian_Vettel_at_the_2026_Italian_Grand_Prix.jpg>); [delivered JPEG](<https://thumb.wikimedia.org/wikipedia/commons/thumb/a/af/Sebastian_Vettel_at_the_2026_Italian_Grand_Prix.jpg/250px-Sebastian_Vettel_at_the_2026_Italian_Grand_Prix.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail>) | 200; image/jpeg | [CC BY 4.0](<https://creativecommons.org/licenses/by/4.0>) — Andrea Diodato | Desktop + mobile: decoded 250×438; genuine; no fallback |
| Nico Rosberg | [Original 512px URL](<https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Nico_Rosberg_2016_Malaysia_3.jpg/512px-Nico_Rosberg_2016_Malaysia_3.jpg>) | 400; text/html | Unsupported 512px thumbnail; Commons file title missing | [File:Nico Rosberg 2016.jpg](<https://commons.wikimedia.org/wiki/File:Nico_Rosberg_2016.jpg>); [delivered JPEG](<https://thumb.wikimedia.org/wikipedia/commons/thumb/3/31/Nico_Rosberg_2016.jpg/250px-Nico_Rosberg_2016.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail>) | 200; image/jpeg | [CC BY-SA 4.0](<https://creativecommons.org/licenses/by-sa/4.0>) — Sven Mandel | Desktop + mobile: decoded 250×374; genuine; no fallback |
| Max Verstappen | [Original 512px URL](<https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Max_Verstappen_2017_Malaysia_3.jpg/512px-Max_Verstappen_2017_Malaysia_3.jpg>) | 400; text/html | Unsupported 512px thumbnail size; source file and storage path valid | [File:2024-08-25 Motorsport, Formel 1, Großer Preis der Niederlande 2024 STP 3973 by Stepro (medium crop).jpg](<https://commons.wikimedia.org/wiki/File:2024-08-25_Motorsport,_Formel_1,_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3973_by_Stepro_(medium_crop).jpg>); [delivered JPEG](<https://thumb.wikimedia.org/wikipedia/commons/thumb/5/52/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3973_by_Stepro_%28medium_crop%29.jpg/250px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3973_by_Stepro_%28medium_crop%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail>) | 200; image/jpeg | [CC BY-SA 4.0](<https://creativecommons.org/licenses/by-sa/4.0>) — Steffen Prößdorf | Desktop + mobile: decoded 250×330; genuine; no fallback |

## 4. Files Changed

The initial working tree was clean; the Phase 1 implementation was already present in HEAD. No pre-existing uncommitted changes were overwritten. Modified historical fields are limited to photograph data; names, order, nationality, wins, teams and title years are protected by a baseline fingerprint test. ui-utils.js, the idempotent fallback helper, API implementation, animation rules and precache list remain intact.

| State | File | Change |
| --- | --- | --- |
| Modified | `404.html` | Generated CSP: add only the API-returned Wikimedia thumbnail host. |
| Modified | `README.md` | Document image provenance, approved-byte review, optional live audit and shell v4. |
| Modified | `assets/css/styles-v7.css` | Small wrapping photo credits using the existing typography and colors. |
| Modified | `assets/js/champions.js` | Render accessible source/license credits; declare portrait dimensions and async decoding; retain lazy loading and fallback. |
| Modified | `assets/js/static-data.js` | Replace the 33 image URLs and add four-field photoCredit metadata; historical fields unchanged. |
| Modified | `calendar.html` | Generated CSP synchronization only. |
| Modified | `champions.html` | Generated CSP synchronization only. |
| Modified | `drivers.html` | Generated CSP synchronization only. |
| Modified | `index.html` | Generated CSP synchronization only. |
| Modified | `package.json` | Add controlled champion tests and an optional live image audit command; no dependencies. |
| Modified | `scripts/sync-csp.mjs` | Centralized exact thumb.wikimedia.org img-src permission. |
| Modified | `sw.js` | Bump v3 to v4 for updated shell resources; no caching algorithm or precache-list changes. |
| Modified | `teams.html` | Generated CSP synchronization only. |
| Modified | `tests/browser/live.browser.mjs` | Require 33 genuine decoded photographs and zero placeholders instead of counting fallback success. |
| Modified | `tests/browser/phase1.browser.mjs` | Mock the newly required thumbnail host and expect shell v4; preserve all original scenarios. |
| Modified | `tests/helpers/http-server.js` | Serve the immutable Phase 1 Git snapshot for the v3-to-v4 upgrade regression. |
| Modified | `tests/site-integrity.test.js` | Check the exact centrally generated CSP origin list. |
| New | `docs/phase-1.1/REPORT.md` | This technical report and complete per-champion audit table. |
| New | `docs/phase-1.1/browser/desktop-first.png` | Updated actual gallery screenshot, first/middle/final section at the indicated viewport. |
| New | `docs/phase-1.1/browser/desktop-last.png` | Updated actual gallery screenshot, first/middle/final section at the indicated viewport. |
| New | `docs/phase-1.1/browser/desktop-middle.png` | Updated actual gallery screenshot, first/middle/final section at the indicated viewport. |
| New | `docs/phase-1.1/browser/identity-contact-sheet.png` | Labeled visual review of all 33 actual photographs; attribution is in the audit table and image-audit.json. |
| New | `docs/phase-1.1/browser/mobile-first.png` | Updated actual gallery screenshot, first/middle/final section at the indicated viewport. |
| New | `docs/phase-1.1/browser/mobile-last.png` | Updated actual gallery screenshot, first/middle/final section at the indicated viewport. |
| New | `docs/phase-1.1/browser/mobile-middle.png` | Updated actual gallery screenshot, first/middle/final section at the indicated viewport. |
| New | `docs/phase-1.1/browser/results.json` | Final Chrome response/decoding evidence, expected failure observations, console messages, CSP violations and exceptions. |
| New | `docs/phase-1.1/image-audit.json` | Approved canonical filenames, original probes, identity/license evidence, dimensions and SHA-256 fingerprints. |
| New | `docs/phase-1.1/validation/controlled-chrome.txt` | Final controlled Chrome test output. |
| New | `docs/phase-1.1/validation/csp.txt` | Final centralized CSP validation output. |
| New | `docs/phase-1.1/validation/git-status.txt` | Final branch, HEAD and complete staged/unstaged/untracked status. |
| New | `docs/phase-1.1/validation/git-whitespace.txt` | Final Git whitespace validation result; line-ending conversion notices are informational. |
| New | `docs/phase-1.1/validation/live-images.txt` | Final dedicated image audit output. |
| New | `docs/phase-1.1/validation/live-pages.txt` | Final six-page real-network test output. |
| New | `docs/phase-1.1/validation/node-tests.txt` | Final native Node test output. |
| New | `docs/phase-1.1/validation/syntax.txt` | Final JavaScript syntax-check count. |
| New | `tests/browser/champion-images.browser.mjs` | Four controlled scenarios: metadata/filter associations, source failure, offline shell, and real v3-to-v4 upgrade. |
| New | `tests/browser/champion-images.live.mjs` | Four real-network scenarios plus independent JPEG/HTTP/hash/decode checks and screenshots. |
| New | `tests/champion-images.test.js` | 37 deterministic tests: per-person approved provenance, license/attribution, historical-field fingerprint, unique images and shell/fallback integrity. |
| New | `tests/helpers/champion-browser.js` | Reusable Chrome launcher, image observations, decode-state collection and CSP/exception assertions. |

## 5. Test Results

These are the final runs, after correcting the new checks for CSS-rendered versus declared image dimensions, Hawthorn's unscaled original dimensions, and the browser lifecycle race when reopening a client before the waiting worker activates. No production fallback or existing test was weakened.

| Command / check | Passed | Failed | Skipped | Evidence |
| --- | ---: | ---: | ---: | --- |
| npm test | 84 | 0 | 0 | [Node output](validation/node-tests.txt) |
| npm run test:browser | 17 | 0 | 0 | [Controlled Chrome](validation/controlled-chrome.txt) |
| npm run test:browser:live | 7 | 0 | 0 | [Live pages](validation/live-pages.txt) |
| npm run audit:images:live | 5 | 0 | 0 | [Live image audit](validation/live-images.txt) |
| Node test-runner total | 113 | 0 | 0 | Includes 4 parent wrapper tests |
| node --check for all JavaScript modules/scripts | 22 | 0 | 0 | [Syntax](validation/syntax.txt) |
| npm run check:csp | 1 | 0 | 0 | [CSP](validation/csp.txt) |
| git diff --check | 1 | 0 | 0 | [Whitespace](validation/git-whitespace.txt) |

The 113 Node results contain 109 individual cases/scenarios plus four parent wrappers: 84 native cases (all 47 Phase 1 cases plus 37 new image cases), 15 controlled browser scenarios (all 11 original scenarios plus four new ones), six existing live-page scenarios, and four dedicated live-image scenarios. No cases were cancelled. The deterministic suite makes no third-party network requests and adds no dependencies. The optional browser commands reuse an existing Playwright installation via F1_PLAYWRIGHT_MODULE and Chrome via channel or F1_BROWSER_EXECUTABLE.

| Dedicated real-browser scenario | Genuine photo loads | Failed photo loads | Decoded local fallbacks | Unexpected CSP violations | JavaScript exceptions |
| --- | ---: | ---: | ---: | ---: | ---: |
| Desktop, normal network | 33 | 0 | 0 | 0 | 0 |
| Mobile, normal network | 33 | 0 | 0 | 0 | 0 |
| One intentionally unavailable source | 32 | 1 expected | 1 | 0 | 0 |
| Offline gallery navigation | 0 | 33 expected | 33 | 0 | 0 |

The separate six-page live run also confirmed 33 genuine champion photographs, zero fallbacks, zero failed external requests, zero CSP violations and zero uncaught JavaScript exceptions across index, drivers, teams, champions, calendar and 404. The controlled Phase 1 security test deliberately generates exactly one expected img-src violation for an unauthorized origin; it is not an unexpected violation. The existing double-failure test still verifies one source attempt and one placeholder attempt per image, even when both fail.

The dedicated audit captured 40 console entries: one normal desktop favicon.ico HTTP 404, one expected Playwright Service Worker-blocking warning, one expected intentionally failed photo request, and 37 offline network errors (33 photos plus four font/style requests). Thus 39 error-level resource messages and one warning were recorded; there were no JavaScript exceptions or unexpected CSP violations. The favicon request is Chrome's automatic host-root request and is unrelated to the champion sources. Its URL and all expected failures remain in [raw browser evidence](browser/results.json); no errors were hidden or counted as successful photographs.

Updated screenshots, all visually reviewed, cover first/middle/final gallery sections:

| Layout | First | Middle | Final |
| --- | --- | --- | --- |
| Desktop 1440×1000 | [First](browser/desktop-first.png) | [Middle](browser/desktop-middle.png) | [Final](browser/desktop-last.png) |
| Mobile 390×844 | [First](browser/mobile-first.png) | [Middle](browser/mobile-middle.png) | [Final](browser/mobile-last.png) |

Mobile was also checked at 320px with no horizontal overflow. Reduced-motion cards use animation-name: none. The audit explicitly invokes image.decode() for all 33 desktop photographs, checks natural dimensions on both layouts, verifies JPEG signatures and reviewed byte hashes, and keeps successful placeholders separate from genuine photographs.

## 6. Performance and Compatibility

| Guarantee | Verified outcome |
| --- | --- |
| Vanilla JavaScript / static hosting | Preserved; no backend, database, framework or dependency added |
| Desktop/mobile identity and layouts | Existing card/header/grid/portrait/navigation classes preserved; small wrapping credits added below statistics |
| Loading and dimensions | loading=lazy retained; decoding=async and declared 100×100 dimensions added; existing responsive CSS retained |
| Network size | 32 250px thumbnails plus one 217px original; 872,049 bytes total for all 33 JPEGs in the forced-eager audit, about 852 KiB; production stays lazy |
| Shell payload | static-data.js grew from 50,675 to 65,878 bytes before compression for URLs/credits; photos and audit evidence are not mandatory shell resources |
| Service Worker installation | Complete 18-resource installation still passes, including provider failure; missing mandatory resource still rejects atomically |
| Upgrade behavior | v3 → v4 and legacy v13 → v4 verified after old clients close; no skipWaiting or forced activation added |
| Offline shell | All existing shell routes and local placeholder remain available after installation; offline gallery renders all 33 records with placeholders |
| Cache isolation | Same mount-scoped namespace and legacy cleanup; unrelated caches preserved; no cross-origin photo entries |
| CSP | Exact new API-returned thumbnail host synchronized centrally; no relaxed script/style policy; zero unexpected violations |
| GitHub Pages /F1/ | Prefix navigation, assets, service-worker scope, queries and nested 404 behavior all verified locally |
| Historical statistics | All original values and record order preserved by deterministic hash comparison |

## 7. Remaining Technical Debt

- P0: none found within this phase.
- P1: no unavailable or unlicensed champion photographs remain in final validation.
- P2, inherited and explicitly deferred: missing historical champions and broader historical-data corrections remain Phase 2 work; no championships, wins or teams were changed here.
- P3, accepted external-source dependency: Commons may change availability or replace files. The optional live audit detects HTTP/MIME/decoding/byte regressions. A changed hash requires renewed visual identity and licensing review; do not automatically bless it. The application still degrades safely to its local placeholder. Local copies can be reconsidered if measured reliability justifies that maintenance cost.
- P3, inherited/out of scope: the repository supplies no host-root favicon.ico, producing one automatic Chrome 404 in local validation. It does not affect image recovery, CSP, offline shell or page functionality.

There were no unavailable validation tools or unresolved licensing blockers. Live availability is a dated observation, not a guarantee of future third-party uptime. No monitoring service or mandatory network-dependent unit test was introduced.

## 8. Final Git Status

Current branch: **main**. HEAD: **1e54313a866b1c5227067bb0deceee8916806e86**, unchanged from initial inspection. Origin: https://github.com/AndersonCav/F1.git. **17 modified tracked files; 22 newly created untracked files; zero staged files.** All tracked edits are unstaged. No branch was created. No commit, push, merge, deployment or GitHub settings change occurred. No reset, clean, restore or unrelated-file replacement was performed.

Complete status (M in the second column means an unstaged tracked edit; ?? means untracked):

```text
 M 404.html
 M README.md
 M assets/css/styles-v7.css
 M assets/js/champions.js
 M assets/js/static-data.js
 M calendar.html
 M champions.html
 M drivers.html
 M index.html
 M package.json
 M scripts/sync-csp.mjs
 M sw.js
 M teams.html
 M tests/browser/live.browser.mjs
 M tests/browser/phase1.browser.mjs
 M tests/helpers/http-server.js
 M tests/site-integrity.test.js
?? docs/phase-1.1/REPORT.md
?? docs/phase-1.1/browser/desktop-first.png
?? docs/phase-1.1/browser/desktop-last.png
?? docs/phase-1.1/browser/desktop-middle.png
?? docs/phase-1.1/browser/identity-contact-sheet.png
?? docs/phase-1.1/browser/mobile-first.png
?? docs/phase-1.1/browser/mobile-last.png
?? docs/phase-1.1/browser/mobile-middle.png
?? docs/phase-1.1/browser/results.json
?? docs/phase-1.1/image-audit.json
?? docs/phase-1.1/validation/controlled-chrome.txt
?? docs/phase-1.1/validation/csp.txt
?? docs/phase-1.1/validation/git-status.txt
?? docs/phase-1.1/validation/git-whitespace.txt
?? docs/phase-1.1/validation/live-images.txt
?? docs/phase-1.1/validation/live-pages.txt
?? docs/phase-1.1/validation/node-tests.txt
?? docs/phase-1.1/validation/syntax.txt
?? tests/browser/champion-images.browser.mjs
?? tests/browser/champion-images.live.mjs
?? tests/champion-images.test.js
?? tests/helpers/champion-browser.js
```

