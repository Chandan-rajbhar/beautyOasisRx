# BeautyOasisRx — Firebase Cloud Messaging & Supabase Push Notification Setup Guide

This guide provides the complete, production-ready setup instructions for connecting **Firebase Cloud Messaging (FCM HTTP v1 API)**, **Supabase Database & Edge Functions**, the **BeautyOasisRx Admin Dashboard**, and the **Mobile Application**.

---

## 1. Firebase Console Configuration

### 1.1 Create or Select Firebase Project
1. Navigate to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** (or select your existing project: `beautyoasis-rx`).
3. Name the project `beautyoasis-rx` and proceed through the prompts.
4. Google Analytics can be enabled or disabled as preferred.

### 1.2 Register Android Application
1. In the Firebase project overview, click the **Android** icon to add an app.
2. Enter the exact Android package name:
   ```
   com.beautyoasis.app
   ```
3. Enter the App nickname: `BeautyOasis Rx Android`.
4. (Optional for Debug / required for Google Sign-in): Add your SHA-1 fingerprint:
   ```bash
   cd mobile/android && ./gradlew signingReport
   ```
5. Click **Register app**.
6. Download `google-services.json` and place it at:
   ```
   mobile/android/app/google-services.json
   ```

### 1.3 Register iOS Application
1. In the Firebase project overview, click the **iOS** icon to add an app.
2. Enter the exact iOS bundle ID:
   ```
   com.beautyoasis.app
   ```
3. Enter App nickname: `BeautyOasis Rx iOS`.
4. Click **Register app**.
5. Download `GoogleService-Info.plist` and place it at:
   ```
   mobile/ios/GoogleService-Info.plist
   mobile/ios/BeautyOasis/GoogleService-Info.plist
   ```

### 1.4 Configure APNs (Apple Push Notification service) for iOS
1. In the Firebase Console, go to **Project settings** (gear icon) → **Cloud Messaging** tab.
2. Under **Apple app configuration**:
   - Upload your **APNs Authentication Key (`.p8` file)** obtained from [developer.apple.com](https://developer.apple.com) under *Certificates, Identifiers & Profiles → Keys*.
   - Enter your **Key ID** (10-character string).
   - Enter your **Team ID** (10-character string from your Apple Developer account).

---

## 2. Server-Side Service Account & OAuth 2.0 (FCM HTTP v1)

FCM legacy API (`fcm.googleapis.com/fcm/send`) is deprecated by Google. This system uses the **FCM HTTP v1 API** (`fcm.googleapis.com/v1/projects/{projectId}/messages:send`) secured with Google OAuth 2.0 access tokens.

### 2.1 Generate Firebase Service Account Key
1. In the Firebase Console, go to **Project settings** → **Service accounts** tab.
2. Verify **Firebase Admin SDK** is selected.
3. Click **Generate new private key** and confirm **Generate key**.
4. A JSON file will download (e.g. `beautyoasis-rx-firebase-adminsdk-xxxxx.json`).

The JSON file contains:
```json
{
  "type": "service_account",
  "project_id": "beautyoasis-rx",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@beautyoasis-rx.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
}
```

---

## 3. Supabase Database Setup

### 3.1 Execute the SQL Migration
1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard/project/tuepzwlxgnmtbjijtgta).
2. Go to **SQL Editor** → **New query**.
3. Open [`supabase_push_notifications_and_devices.sql`](./supabase_push_notifications_and_devices.sql).
4. Paste the entire script and click **Run**.

This migration creates:
* `public.notifications` table extended with:
  * `recipient_user_id`
  * `notification_type`
  * `related_entity_id`
  * `deep_link` & `action_url`
  * `data_payload`
  * `idempotency_key` (unique index prevents duplicate pushes)
  * `delivery_status` (`'pending'`, `'sent'`, `'no_devices'`, `'partial'`, `'failed'`)
  * `delivery_details` (per-token message IDs & errors)
  * `read_at`
  * Bi-directional legacy synchronization trigger (`sync_notifications_columns`)
* `public.push_devices` table:
  * Multi-device registration per user (`fcm_token` UNIQUE)
  * Platform identifier (`'android'`, `'ios'`, `'web'`)
  * Active state tracking (`is_active = true/false`)
  * `last_seen_at` heartbeat
* Helper RPC functions:
  * `register_push_device(p_user_id, p_fcm_token, p_platform, ...)`
  * `unregister_push_device(p_fcm_token, p_user_id)`
  * `deactivate_invalid_fcm_tokens(p_invalid_tokens)`
* Realtime replication added to `supabase_realtime` publication.

---

## 4. Supabase Edge Function Secrets & Deployment

### 4.1 Set Secrets in Supabase
Set the Firebase Service Account credentials as Supabase secrets so they remain 100% server-side and never leak into frontend or mobile builds.

#### Option A: Supabase Dashboard
1. Go to **Project Settings** → **Edge Functions** → **Secrets**.
2. Add the secret `FIREBASE_SERVICE_ACCOUNT` with the entire content of the downloaded service account JSON file.
   *(Or set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` individually).*

#### Option B: Supabase CLI
```bash
# Set using full JSON string:
npx supabase secrets set FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"beautyoasis-rx",...}'

# Or set individual variables:
npx supabase secrets set FIREBASE_PROJECT_ID="beautyoasis-rx"
npx supabase secrets set FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@beautyoasis-rx.iam.gserviceaccount.com"
npx supabase secrets set FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### 4.2 Deploy the Edge Function
Deploy `send-push-notification`:
```bash
npx supabase functions deploy send-push-notification --no-verify-jwt
```

The function is now accessible at:
```
https://tuepzwlxgnmtbjijtgta.supabase.co/functions/v1/send-push-notification
```

---

## 5. Security & Credentials Architecture

| Asset | Location | Security Rule |
| :--- | :--- | :--- |
| **Firebase Service Account Private Key** | Supabase Edge Function Secrets only | **NEVER** commit to Git, never include in mobile or dashboard code |
| **Supabase Service Role Key** | Supabase Edge Function Secrets only | Never expose in frontend |
| **Supabase Anon Key** | `.env` / Mobile client | Safe for client-side use with Supabase RLS |
| **Firebase google-services.json** | `mobile/android/app/` | Client-safe API keys for device registration |
| **Firebase GoogleService-Info.plist** | `mobile/ios/` | Client-safe API keys for device registration |
| **FCM Device Registration Tokens** | `push_devices` table | Protected by RLS (`auth.uid() = user_id`) |
