# Thomas' Pub Golf — Haarlem Open

De originele multiplayer-webapp (PWA) blijft draaien op Railway met Node.js 20+. Er staat nu ook een aparte **echte iPhone-app** met Capacitor 8 en een TestFlight-workflow in [`ios-app/`](ios-app/README.md).

## Spelerservaring

1. Open de link. Kies bestaande speler of registreer een nieuwe golfer.
2. Upload optioneel een eigen profielfoto. Foto's worden lokaal bijgesneden, verkleind naar 160×160 JPEG en samen met de spelersgegevens gesynchroniseerd.
3. Bekijk één hole per scherm, stel je aantal slagen in en bevestig met één knop.
4. **Na iedere score** verschijnt automatisch het live klassement. De leider krijgt 👑, de laatste speler 💩. Daarna verschijnt na hole 1–5 een korte verrassingsronde, met een vraag, check-in of een cadeaubonus voor een andere speler.
5. De Salmari-shotknop verschijnt vanaf het eerste drankje en verdwijnt na hole 6. Opgeslagen scores staan definitief vast. Via het menu kan je je profielfoto wijzigen; tik op een deelnemer in het klassement om de volledige scorekaart in te zien.

## Spelregels

| # | Kroeg | Drankje | Par |
|--|--|--|--:|
| 1 | Jopen | Mooie Nel IPA 50 cl | 8 |
| 2 | Tierney's Irish Pub | Guinness pint | 10 |
| 3 | Proeflokaal In den Uiver | Halve liter bier | 8 |
| 4 | Bierlokaal de Uiver | Fluitje in één keer, hole-in-one | 1 |
| 5 | Café De Lift | Brugse Zot 33 cl | 7 |
| 6 | Café Studio | Vaasje 25 cl | 9 |

Totaal PAR 43. Iedere Salmari is één slag aftrek. Er is geen tijdslimiet.

## Testen

`npm test && npm start`, vervolgens `http://localhost:3000`. Open dezelfde URL op verschillende toestellen op een gedeelde server. Locally opened `index.html` can show the interface but has no live server sync.

## Online plaatsen op Railway

1. Maak een **nieuwe aparte GitHub repository** (bijv. `JobSchip/thomas-dadchelor-pubgolf`) en upload de inhoud van deze map naar de hoofdmap van de repository.
2. In Railway, open het bestaande project **Thomas Dadchelor Pub Golf** (project-id `7e3ed243-96fc-4693-b42b-cd837744ad88`) en voeg een service toe vanuit de nieuwe GitHub repository. Start command: `npm start`.
3. Maak een Railway volume met mount path `/app/data` (als je service bij `/app` draait) of zet `DATA_DIR` expliciet naar de mount path. Vereist voor behoud van scores bij deployment/restart. Houd één replica.
4. Genereer in Railway een openbaar HTTPS-domein; deel de URL met de groep. Voor een eigen wedstrijd gebruikt de app de queryparameter `?room=THOMAS-OPEN`.
5. iOS: Safari > Deel > Zet op beginscherm. Android: Chrome > Menu > Toevoegen aan startscherm / App installeren.

## Beveiliging en privacy

Deel de wedstrijdlink alleen met deelnemers: de huidige kleinschalige party-app heeft geen accounts of rollen. Spelers kunnen ingediende hole-scores niet achteraf wijzigen, maar deelnemers hebben nog geen individuele identiteitstoets en kunnen een bestaand profiel selecteren. Geüploade profielfoto's staan (als data-URL's) in de serveropslag, toegankelijk voor anderen met dezelfde link. Dit is niet geschikt voor gevoelige of publieke data. Een toekomstige versie kan deelnemerscodes en server-side identiteitscontrole toevoegen.

## Pub Golf 4.0 — Quizflow en dynamische UX

- Per hole verschijnt eerst de volgende kroeg en het drankje, daarna 'Ik heb m'n drankje' en vervolgens de score-invoer.
- Steeds wazigere achtergrond per nieuwe bar, vallende feesticoontjes, bonusconfetti en veel 💩/🤡 bij een score boven PAR.
- Een grote zwarte Salmari-shotknop tijdens de ronde, vanaf het eerste drankje tot aan de definitieve score van hole 6. Iedere tik telt direct als één aftrek op de score.
- Na hole 1: gok jongen (–1), meisje (+1), alle kleuren (+2).
- Na hole 2: Danique's uitgerekende datum (18 januari is –1; de andere 7 keuzes zijn +1).
- Na hole 3: bestaande vier-smiley check-in, vierde antwoord levert –1 op.
- Na hole 4: Thomas' naamquiz. Ieder antwoord is –1. Een hole-in-one op de fluitjes-hole krijgt de grote feestanimatie.
- Na hole 5: iedere deelnemer kiest één speler die –1 slag krijgt; de keuze telt slechts eenmaal en wordt centraal opgeslagen.
- Per vraag volgt een apart scherm met de uitslag, voordat de volgende bar in beeld komt.
- De profielwisselknop is verwijderd, maar een gebruiker kan bij het eerste aanmelden zijn bestaande naam selecteren.

## Echte iPhone-app / TestFlight

De iPhone-app staat in [`ios-app/`](ios-app/README.md) en gebruikt dezelfde Railway-server en wedstrijdkamer `THOMAS-OPEN`. De Xcode-projectgeneratie, iPhone-camera/fotobibliotheek, iOS-haptics, appicoon, privacy-permissies en twee GitHub Actions-workflows zijn voorbereid:

- `.github/workflows/ios-build.yml`: controleert een niet-ondertekende iOS-simulator-build (geen Apple-account vereist).
- `.github/workflows/testflight.yml`: uploadt na expliciete GitHub Actions-start een ondertekende distributiebuild naar TestFlight (Apple Developer Team, apprecord en vier secrets vereist).

De website blijft onafhankelijk functioneren en de bestanden voor de native app worden tijdens de build lokaal in de app verpakt. Zie [het stappenplan voor TestFlight](ios-app/README.md) voor de Apple-stappen en beperkingen.
