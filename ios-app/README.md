# Thomas' Pub Golf — echte iPhone-app

Dit is de **Capacitor 8**-versie van de bestaande Pub Golf-PWA. Het is een iOS-app met lokaal meegeleverde schermen en afbeeldingen. Alleen het gezamenlijke klassement, spelersprofielen, foto's en scores worden gesynchroniseerd met de bestaande Railway-server. De website blijft beschikbaar en gebruikt dezelfde wedstrijdkamer.

## Wat is al geregeld?

- Eigen iPhone-appidentiteit: `nl.jobschipper.thomaspubgolf` (voorlopig gekozen; controleer deze vóór Apple-registratie).
- Capacitor 8 + iOS-runtime en voorbereide Xcode-projectgeneratie.
- Lokaal geïnstalleerde webschermen, afbeeldingen en stijlen; geen netwerk nodig om die bestanden op te halen.
- Veilige HTTPS-koppeling met `https://thomas-pubgolf-production.up.railway.app` voor multiplayer.
- Camera/fotobibliotheek voor profielfoto's, iPhone-trilfeedback bij scores en bonusmomenten.
- Bestaande appicoon opgeschaald naar een ondoorzichtig iOS-icoon van 1024 × 1024.
- Nederlandse permissieteksten voor camera en foto's.
- GitHub Actions voor een simulator-build én een aparte handmatige TestFlight-upload.

## Benodigd

Voor een lokale iOS-build: **Mac met Xcode 26 of later**, **Node.js 22+**, plus een Apple Developer Program-lidmaatschap om via TestFlight te distribueren. Voor de build via GitHub Actions is geen eigen Mac nodig, maar wel een GitHub-repository met macOS-runnerrechten. Voor een TestFlight-upload zijn Apple-ondertekening en App Store Connect altijd vereist.

## Xcode openen (Mac)

Voer in de hoofdmap van de GitHub-repository uit:

```bash
npm install --prefix ios-app
npm run ios:check --prefix ios-app
npm run ios:init --prefix ios-app
cd ios-app
npx cap open ios
```

De laatste opdracht opent het door Capacitor aangemaakte project in Xcode. Verifieer de iPhone-simulator of sluit een iPhone aan. In **Signing & Capabilities** kies je jouw Apple Developer Team. Het bundel-ID moet exact overeenkomen met het App Store Connect-apprecord; zo nodig pas je `ios-app/capacitor.config.json` aan voordat je het iOS-project opnieuw genereert.

**Let op:** de mappen `ios-app/www/` en `ios-app/ios/` worden bewust automatisch gegenereerd. De bronbestanden staan in deze repository. Gebruik `npm run ios:sync --prefix ios-app` voor wijzigingen nadat het Xcode-project bestaat.

## Zonder Mac: een build via GitHub

Ga in GitHub naar **Actions → iOS native build check → Run workflow**. Deze workflow draait op `macos-26`, installeert Capacitor, genereert het Xcode-project en probeert een iPhone-simulator-app te compileren zonder Apple-signing. Het gegenereerde Xcode-project wordt als workflow-artifact opgeslagen.

Dit controleert de code, maar is **nog geen installeerbare TestFlight-app**. Daarvoor is een ondertekende distributiebuild nodig.

## TestFlight uploaden vanuit Xcode (eenvoudigste eerste keer)

1. Word lid van het [Apple Developer Program](https://developer.apple.com/programs/) en open [App Store Connect](https://appstoreconnect.apple.com/).
2. Maak een expliciete **App ID** aan: `nl.jobschipper.thomaspubgolf` (of vervang dit consistent door je eigen bundel-ID).
3. Maak een iOS-apprecord: naam **Thomas' Pub Golf**, taal **Nederlands**, bundel-ID hetzelfde als de App ID; kies een unieke SKU.
4. Selecteer jouw Apple Developer Team in Xcode en zet **Automatically manage signing** aan.
5. Kies in Xcode een generieke iOS Device-bestemming, vervolgens **Product → Archive**.
6. In Organizer kies je **Distribute App → TestFlight & App Store → Upload**.
7. Vul in App Store Connect de TestFlight-bèta-informatie en feedbackcontactgegevens in. Test je met vrienden die geen lid zijn van jouw App Store Connect-team, maak dan een **externe testgroep** aan.
8. Laat de eerste externe build beoordelen door Apple en nodig je vrienden daarna via e-mail of een TestFlight-link uit.

Externe TestFlight-builds kunnen review vereisen. Apple verwacht ook bij TestFlight apps die voldoen aan de App Review Guidelines; een privé-app voor één feest wordt daarom **niet gegarandeerd** goedgekeurd.

## Daarna met één GitHub-actie uploaden

De tweede GitHub-workflow heet **Upload Thomas Pub Golf to TestFlight**. Die start uitsluitend handmatig en is pas bruikbaar na het toevoegen van vier **GitHub Actions-secrets** aan je repository, bij voorkeur in een beschermde environment `testflight`:

| Secret | Betekenis |
| --- | --- |
| `APPLE_TEAM_ID` | Je Apple Developer Team ID |
| `ASC_KEY_ID` | App Store Connect API Key ID |
| `ASC_ISSUER_ID` | App Store Connect API Issuer ID |
| `ASC_KEY_P8_BASE64` | De .p8-sleutel, als één base64-gecodeerde tekenreeks |

De workflows sturen deze gegevens niet naar de webapp of het repository. GitHub gebruikt de geheimen alleen op de tijdelijk aangemaakte macOS-runner. Maak een **team-API-sleutel** in App Store Connect aan en controleer dat je Apple-account toegang heeft tot het apprecord en certificaten. Sommige accounts vereisen vooraf een distributiecertificaat/provisioningprofiel of een eerste upload vanuit Xcode voordat de automatische Apple-signing werkt.

Op je Mac kan je het geheim voor `ASC_KEY_P8_BASE64` maken met:

```bash
base64 -i AuthKey_JOUWKEY.p8 | tr -d '\n'
```

**Plak nooit Apple-sleutels of wachtwoorden in een chat of in GitHub-broncode.** Gebruik alleen de GitHub Secrets-interface.

## TestFlight-informatie (concept)

**Naam:** Thomas' Pub Golf  
**Bèta-omschrijving:** Zes kroegen, één live klassement. Voer slagen in, verzamel Salmari-bonussen en speel de verrassingsvragen over Thomas.  
**What to test:** Registratie en profielfoto, live scores op verschillende telefoons, voortgang per kroeg, bonusvragen, Salmari, eindstand en de hole-in-one-animatie.  
**Review notes:** Private party scorekeeping game for invited participants. Create a new player directly in the app; no login or purchase is required. All six holes can be played without needing to visit the physical pubs. Shared scoreboard API: `https://thomas-pubgolf-production.up.railway.app`.  
**Feedbackadres:** nog door de eigenaar van de app in te vullen.

### Privacy en aandachtspunten

De app verwerkt een gekozen spelersnaam, optionele profielfoto, scores en antwoorden. Die informatie is binnen dezelfde wedstrijdkamer zichtbaar voor andere deelnemers. De bestaande Railway-service gebruikt opslag op de server en er is momenteel **geen individuele aanmelding of identiteitstoets**: de link en kamernaam zijn bedoeld voor een vertrouwde vriendengroep. Voor openbare distributie of gevoelige informatie moet deze privacy en autorisatie eerst worden verbeterd. Er is nog geen definitieve privacyverklaring/contactadres voor App Store Connect ingesteld.

De app heeft internet nodig voor synchronisatie, maar de lokale spelinterface opent zonder download van de spelpagina's. Een update van de spelregels en native bestanden vereist normaal een nieuwe TestFlight-build; de server kan wel los worden bijgewerkt.

## Technische opzet

```
GitHub broncode                iPhone
├── app.js         ───┐         Capacitor WKWebView
├── index.html     ───┼──>      lokale www-bestanden
├── styles.css     ───┤         + Camera en Haptics plugins
├── assets/        ───┘                 │
├── server.js                         HTTPS
└── ios-app/                            ▼
    ├── package.json              Railway multiplayer API
    ├── capacitor.config.json       (THOMAS-OPEN)
    ├── scripts/
    └── native/bridge.js
```

**Beschikbare opties:** de originele webapp blijft op [de bestaande publieke link](https://thomas-pubgolf-production.up.railway.app/?room=THOMAS-OPEN); het iOS-project heeft een eigen buildproces en raakt Railway-deployments niet.

**Documentatie:** [Capacitor iOS](https://capacitorjs.com/docs/ios), [Capacitor environment](https://capacitorjs.com/docs/getting-started/environment-setup), [TestFlight](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/).
