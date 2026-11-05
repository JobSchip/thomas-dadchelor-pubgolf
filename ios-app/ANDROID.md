# Thomas' Pub Golf — Android APK

De Android-app draait als **echte installeerbare Capacitor-app** op Android 8 of nieuwer. Hij bevat lokaal dezelfde zes kroegen, scorekaarten, afbeeldingen, vragen en animaties als de iPhone-app. De scores, Salmari-shotjes, foto's en het klassement worden uitgewisseld met de bestaande Railway-server in kamer `THOMAS-OPEN`. iPhone, Android en web spelen dus samen.

## Direct een APK uit GitHub downloaden

1. Open **[GitHub Actions → Android APK — Thomas Pub Golf](https://github.com/JobSchip/thomas-dadchelor-pubgolf/actions/workflows/android-apk.yml)**.
2. Klik op de meest recente **groene** (geslaagde) build. Is er nog geen build? Klik `Run workflow` op de `main`-branch.
3. Onderaan de buildpagina staat bij **Artifacts**: `Thomas-PubGolf-Android-APK`. Klik om het ZIP-bestand te downloaden. Hiervoor moet je mogelijk op GitHub ingelogd zijn.
4. Pak het ZIP-bestand uit. Het bevat `Thomas-PubGolf-Android.apk` en een bijbehorende `.sha256` checksum.
5. Stuur de **APK** (dus niet het ZIP-bestand) naar je vrienden via een vertrouwd kanaal of download hem op je eigen Android-telefoon.
6. Open de APK op de telefoon. Android kan eenmalig toestemming vragen om apps vanuit de betreffende bestandsbeheerder of browser te installeren. Controleer de bestandsnaam en herkomst voordat je toestemming geeft. Daarna staat **Thomas' Pub Golf** tussen de gewone apps.

Een Google Play-account of Google Play Store-publicatie is voor deze installatie niet nodig.

**Let op:** de eerste APK is een **debug-ondertekende testversie**; deze is bedoeld voor een besloten vriendenkring en niet als publieke Play Store-release. Elke GitHub Actions-run kan een nieuwe debug-handtekening gebruiken. Om later te updaten kan het daardoor nodig zijn de oude app te verwijderen en opnieuw te installeren. De scores staan op de Railway-server, maar het lokale toestelprofiel moet mogelijk opnieuw worden gekozen. Voor echte doorlopende APK-updates is een vaste, privé bewaarde Android-keystore nodig.

## Zelf bouwen op een computer

Vereist: Node.js 22+, JDK 21, Android SDK met platform API 36 en Android Studio (Capacitor 8).

```bash
npm install --prefix ios-app
npm run android:init --prefix ios-app
cd ios-app/android
./gradlew assembleDebug
```

Op Windows gebruik je `gradlew.bat assembleDebug` in plaats van `./gradlew`.

De APK verschijnt onder `ios-app/android/app/build/outputs/apk/debug/app-debug.apk`.

Voor het openen in Android Studio:

```bash
npm run android:open --prefix ios-app
```

Voor een bijgewerkt spel: `npm run android:sync --prefix ios-app`, daarna opnieuw `assembleDebug`.

## Wat is native?

- Eigen geïnstalleerde app met starticoon, naam en volledig scherm.
- Android WebView met lokaal gebundelde spelinterface en afbeeldingen.
- Optionele systeempicker voor camera of profielfoto.
- Native trilfeedback (voor toestellen die dit ondersteunen).
- HTTPS-netwerkverbinding met dezelfde live Railway-API als op iPhone en web.

## Belangrijke aandachtspunten

- **Geen Play Store:** de APK komt uit jouw eigen GitHub Actions. Android of Play Protect kan waarschuwen voor installatie buiten de Play Store. Installeer alleen APK's waarvan je de herkomst vertrouwt.
- **Geen los spel zonder internet:** de spelinterface is lokaal, maar synchronisatie met anderen vereist een internetverbinding.
- **Nog testen op echte Android:** controleer camera, score invoeren, Salmari, quizvragen, live leaderboard en alle zes holes.
- **Privacy:** spelersnaam en optionele profielfoto zijn voor deelnemers in dezelfde kamer zichtbaar. Zie `https://thomas-pubgolf-production.up.railway.app/privacy.html`.
- **Release-updates:** voor een permanente APK of Play Store-release moet de app worden ondertekend met een vaste private signing key. Zet die sleutel **nooit in deze openbare GitHub-repository**.

Technische bron: [Android-workflow](https://github.com/JobSchip/thomas-dadchelor-pubgolf/blob/main/.github/workflows/android-apk.yml) en [Capacitor Android-documentatie](https://capacitorjs.com/docs/android).
