# ✈️ Travel Assist — PWA

App di viaggio accessibile per ipovedenti, installabile su iPhone/iPad come app nativa.

## 📁 Struttura File

```
travel-assist/
├── index.html       # App principale (HTML5 semantico)
├── style.css        # Stili accessibili (alto contrasto, rem, zoom-safe)
├── app.js           # Logica JavaScript (vanilla)
├── sw.js            # Service Worker (offline totale)
├── manifest.json    # PWA manifest (iOS + Android)
├── icons/           # Icone PWA tutte le dimensioni
│   ├── icon-57.png … icon-512.png
└── README.md
```

## 🚀 Deploy su GitHub Pages

### Metodo 1 — Repository GitHub (consigliato)

1. Crea un repository GitHub (es. `travel-assist`)
2. Carica tutti i file nella root del repository
3. Vai in **Settings → Pages**
4. Source: **Deploy from a branch** → branch: `main` → folder: `/ (root)`
5. Salva. Dopo qualche minuto l'app sarà su `https://tuousername.github.io/travel-assist/`

### Metodo 2 — GitHub CLI

```bash
git init
git add .
git commit -m "Travel Assist PWA v1"
git remote add origin https://github.com/USERNAME/travel-assist.git
git push -u origin main
```

## 📱 Installazione su iPhone/iPad

1. Apri l'URL dell'app in **Safari** (obbligatorio per PWA iOS)
2. Tocca il tasto **Condividi** (quadrato con freccia)
3. Scorri e tocca **"Aggiungi a schermata Home"**
4. Dai un nome e conferma

L'app si aprirà come nativa, senza barra URL, con supporto offline completo.

## ♿ Accessibilità

- Tutti i testi in unità `rem` (rispettano le impostazioni di zoom del browser)
- Contrasto superiore a WCAG AA (sfondo scuro #0d0d1a, testi #f0f0f0)
- Tutti i bottoni ≥ 48×48px (standard WCAG 2.5.5)
- Skip link per screen reader
- ARIA labels su tutti gli elementi interattivi
- `aria-live` regions per aggiornamenti dinamici
- Focus visibile con outline spesso 3px
- Funziona al 200% di zoom senza layout rotto
- Compatibile con VoiceOver (iOS/macOS)

## ⚙️ Funzionalità

| Funzione | Descrizione |
|----------|-------------|
| 🎫 Biglietti | Upload PDF/JPEG, viewer fullscreen con zoom |
| 🏨 Hotel | Apertura Google Maps verso hotel salvato |
| 🔍 Info | Geolocalizzazione + link attrazioni vicine |
| 📅 Itinerario | Calendario giornaliero con tappe e biglietti |
| 🧭 Portami Lì | Bottone diretto a Google Maps per ogni tappa |
| 📍 Distanza Live | Calcolo km dalla posizione alla prossima tappa |
| 🚨 Emergenze | Numeri rapidi con tel: links (113, 118, 112) |
| 💾 Offline | Service Worker cache-first, funziona senza rete |
| 💿 Storage | LocalStorage, dati persistenti tra sessioni |

## 🔧 Personalizzazione

Per aggiungere il numero del consolato specifico, modifica in `app.js`:

```js
function callConsulate() {
  window.location.href = 'tel:+390612345678'; // sostituisci con numero reale
}
```

## 📋 Requisiti Browser

- Safari 14+ (iOS/macOS) — consigliato per installazione PWA
- Chrome 88+ (Android)
- Firefox 86+

---
*Sviluppato con HTML5, CSS3, JavaScript Vanilla — nessuna dipendenza esterna*
