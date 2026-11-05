# Checklist voor TestFlight — Thomas' Pub Golf

Stand van zaken: broncode voorbereid; **nog niet ondertekend of geüpload**. Apple-accountinformatie moet door de eigenaar worden toegevoegd.

## Door het project geregeld

- [x] Capacitor iOS-shell met lokaal meegeleverde spelinterface.
- [x] iOS-camera en fotobibliotheek via de Camera-plugin.
- [x] Haptische feedback bij scores en bonussen.
- [x] iOS-appicoon van 1024 × 1024 zonder transparantie, gegenereerd uit het bestaande PWA-icoon.
- [x] App-naam, bundel-ID en Nederlandse privacy-permissieteksten.
- [x] Bestaande Railway-multiplayer-API gekoppeld via HTTPS en iOS CORS.
- [x] iOS-simulator-buildcheck in GitHub Actions.
- [x] Handmatig te starten TestFlight-uploadworkflow, gereed voor Apple Secrets.
- [x] Privacy-informatie bereikbaar op `https://thomas-pubgolf-production.up.railway.app/privacy.html` zodra Railway de laatste backend-versie draait.

## Nog door de Apple-accountbeheerder te doen

- [ ] Actief Apple Developer Program-lidmaatschap (of lid worden).
- [ ] Apple Developer Team ID, bevoegdheden voor App Store Connect.
- [ ] Een unieke App ID in Apple Developer, overeenkomend met `nl.jobschipper.thomaspubgolf`.
- [ ] App-record in App Store Connect: appnaam Thomas' Pub Golf, platform iOS, taal Nederlands, unieke SKU.
- [ ] Beta-feedbackcontact, e-mailadres, en zo nodig een support-URL opgeven.
- [ ] De App Privacy-vragenlijst correct invullen: naam, optionele profielfoto, spelgegevens, hosting in VS, gegevens zichtbaar voor deelnemers binnen de gedeelde kamer. Er wordt geen advertentie-tracking gebruikt.
- [ ] Leeftijdsclassificatie invullen passend bij een pub-golf-drinkspel voor volwassenen; dit niet als kinderspel categoriseren.
- [ ] De GitHub `testflight`-environment en vier Apple-secrets aanmaken (zie README).
- [ ] Minstens één ondertekende iPhone-build in TestFlight uploaden. Automatische certificaataanmaak kan vereisen dat de eigenaar de eerste Apple-ondertekening in Xcode voltooit.
- [ ] Op een echte iPhone controleren: eerste registratie, kamera- en fotorechten, haptics, zes kroegen, live updates, quizvragen, Salmari en eindstand.
- [ ] TestFlight-externetestersgroep aanmaken en de eerste externe build bij Apple ter beoordeling aanbieden.
- [ ] Pas na goedkeuring van Apple de vrienden uitnodigen via e-mail of een TestFlight-link.

## App Store Connect metadata: concept

**App name:** Thomas' Pub Golf  
**Platform:** iOS  
**Primary language:** Dutch  
**Category:** Games / Casual (na controle of passend)  
**Bundle ID:** `nl.jobschipper.thomaspubgolf` (voorlopig gereserveerd in de code, nog niet bij Apple geregistreerd)  
**Version:** 1.0.0  
**Description:** Een besloten pub-golfspel voor de vriendengroep: zes kroegen, realtime slagen, een live klassement, bonusshots en verrassingsvragen over Thomas.  
**What to test:** Speel een hele ronde op iPhone. Voeg een profielfoto toe, bevestig elke hole, bekijk de ranglijst en probeer de quizvragen en de hole-in-one. Test gelijktijdig met een tweede toestel om live synchronisatie te controleren.  
**Review notes (English):** Private social scorekeeping game for invited adult participants. No login or purchases. Create a player name and play all six holes directly in the app without visiting physical locations. Test the shared leaderboard from two devices. Users can upload an optional profile picture. Backend available via HTTPS at the Railway domain above.  
**Privacy policy URL:** `https://thomas-pubgolf-production.up.railway.app/privacy.html`  
**Support/feedback contact:** eigenaar moet eigen bereikbaar e-mailadres invullen.  

## Belangrijke beperking

Apple hanteert de App Review Guidelines ook voor TestFlight, en kan een externe testbuild weigeren als de app niet voldoende native functionaliteit of een te beperkte doelgroep heeft. De camera-, haptics- en volledige lokale spelervaring helpen, maar garanderen geen goedkeuring. De gewone PWA is een bruikbaar alternatief als de groep niet door review kan komen.

Verstuur Apple-certificaten, .p8-bestanden of wachtwoorden **niet** via chat of in GitHub-code. Gebruik uitsluitend versleutelde GitHub Actions Secrets.
