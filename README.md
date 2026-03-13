# Event POS

A mobile point-of-sale system built for live events — manage inventory, process orders, and track revenue in real time from any device.

Built with **React Native** (Expo SDK 54) and **Firebase** (Auth + Firestore).

## Features

### Admin Panel
- **Event management** — create, go live, pause, close, and delete events
- **Inventory** — add items with prices and optional stock limits, restock or adjust quantities on the fly
- **Cashier management** — create cashier accounts secured with PIN authentication
- **Dashboard** — view total revenue, order counts, and per-event stats at a glance
- **Export / Import** — export full event data as JSON or import from a backup
- **Reporting** — revenue breakdowns by payment method with per-item sales tracking
- **Audit logging** — every action (event status changes, item edits, order commits, cashier changes) is logged

### Cashier POS
- **Fast item grid** — tap-to-add interface with search bar and real-time stock counts
- **Cart** — swipe-up bottom sheet with quantity controls and running total
- **Custom line items** — add manual items with a required reason for accountability
- **Checkout** — supports **cash**, **card**, **mobile**, and **comp** payment methods with automatic change calculation
- **Atomic orders** — inventory is decremented and stats are updated inside a Firestore transaction

### Security & Device Pairing
- Admin login via Firebase Authentication (email/password)
- Device pairing — a device stays associated with its admin even after the admin logs out
- Cashier PIN login — cashiers authenticate with a 4-digit PIN (hashed)
- Firestore security rules scoped per admin

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Expo](https://expo.dev) SDK 54 + React Native 0.81 |
| Routing | [Expo Router](https://docs.expo.dev/router/introduction/) (file-based) |
| State | [Zustand](https://zustand.docs.pmnd.rs/) |
| Server State | [TanStack Query](https://tanstack.com/query) v5 |
| Backend | [Firebase](https://firebase.google.com) Auth + Firestore |
| Validation | [Zod](https://zod.dev) v4 |
| Icons | [Lucide](https://lucide.dev) (React Native) |
| Haptics | `expo-haptics` |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) ≥ 18
- [pnpm](https://pnpm.io) 8.x
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- A Firebase project with **Authentication** (Email/Password) and **Firestore** enabled
- An [EAS](https://expo.dev/eas) account (for dev builds)

### Setup

1. **Clone the repo**

   ```bash
   git clone https://github.com/shamar-morrison/event-pos.git
   cd event-pos
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Configure environment variables**

   Copy the example and fill in your Firebase credentials:

   ```bash
   cp .env.example .env
   ```

   ```env
   EXPO_PUBLIC_FIREBASE_API_KEY=
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
   EXPO_PUBLIC_FIREBASE_APP_ID=
   ```

4. **Deploy Firestore security rules**

   ```bash
   firebase deploy --only firestore:rules
   ```

5. **Create a development build**

   You need a [dev client](https://docs.expo.dev/develop/development-builds/introduction/) to run this app (it is not compatible with Expo Go):

   ```bash
   eas build --profile development --platform android
   # or
   eas build --profile development --platform ios
   ```

6. **Start the dev server**

   ```bash
   pnpm start
   ```

## EAS Build Profiles

| Profile | Purpose | Output |
|---|---|---|
| `development` | Dev client with debugging | APK (Android) |
| `preview` | Internal testing | APK (Android) |
| `production` | Release | AAB (Android) |

## License

Private — all rights reserved.
