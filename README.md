# Thomas' Dadchelor — Pub Golf 2.0

Mobile-first PWA in het Nederlands voor de Haarlem Open. Geen framework of npm-dependencies: Node.js 20+.

## Spelerservaring

1. Open de link. Kies bestaande speler of registreer een nieuwe golfer.
2. Upload optioneel een eigen profielfoto. Foto's worden lokaal bijgesneden, verkleind naar 160×160 JPEG en samen met de spelersgegevens gesynchroniseerd.
3. Bekijk één hole per scherm, stel je aantal slagen in en bevestig met één knop.
4. **Na iedere score** verschijnt automatisch het live klassement. De leider krijgt 👑, de laatste speler 💩. Daarna ga je met één knop door naar de volgende nog niet voltooide hole.
5. Via het menu kun je scores corrigeren, de Salmari-bonus aanpassen, je foto wijzigen en de link delen.

## Spelregels

| # | Kroeg | Drankje | Par |
|--|--|--|--:|
| 1 | Jopen | Mooie Nel IPA 50 cl | 8 |
| 2 | Tierney's Irish Pub | Guinness pint | 10 |
| 3 | Proeflokaal In den Uiver | Halve liter bier | 8 |
| 4 | Bierlokaal de Uiver | Fluitje in één keer, hole-in-one | 1 |
| 5 | Café De Lift | Brugse Zot 33 cl | 7 |
| 6 | Café Studio | Vaasje 25 cl | 9 |

Totaal PAR 43. Iedere Salmari is één slag aftrek. Alcoholvrije deelname is mogelijk en er is geen tijdslimiet.

## Testen

`npm test && npm start`, vervolgens `http://localhost:3000`. Open dezelfde URL op verschillende toestellen op een gedeelde server. Locally opened `index.html` can show the interface but has no live server sync.

## Online plaatsen op Railway

1. Maak een **nieuwe aparte GitHub repository** (bijv. `JobSchip/thomas-dadchelor-pubgolf`) en upload de inhoud van deze map naar de hoofdmap van de repository.
2. In Railway, open het bestaande project **Thomas Dadchelor Pub Golf** (project-id `7e3ed243-96fc-4693-b42b-cd837744ad88`) en voeg een service toe vanuit de nieuwe GitHub repository. Start command: `npm start`.
3. Maak een Railway volume met mount path `/app/data` (als je service bij `/app` draait) of zet `DATA_DIR` expliciet naar de mount path. Vereist voor behoud van scores bij deployment/restart. Houd één replica.
4. Genereer in Railway een openbaar HTTPS-domein; deel de URL met de groep. Voor een eigen wedstrijd gebruikt de app de queryparameter `?room=THOMAS-OPEN`.
5. iOS: Safari > Deel > Zet op beginscherm. Android: Chrome > Menu > Toevoegen aan startscherm / App installeren.

## Beveiliging en privacy

Deel de wedstrijdlink alleen met deelnemers: de huidige kleinschalige party-app heeft geen accounts of rollen. Iedereen met de link kan scores aanpassen of zich als een speler selecteren. Geüploade profielfoto's staan (als data-URL's) in de serveropslag, toegankelijk voor anderen met dezelfde link. Dit is niet geschikt voor gevoelige of publieke data. Een toekomstige versie kan deelnemerscodes en server-side identiteitscontrole toevoegen.
