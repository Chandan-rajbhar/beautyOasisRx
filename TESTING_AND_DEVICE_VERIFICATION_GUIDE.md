# BeautyOasisRx — Push Notification Testing & Device Verification Guide

This guide details the exact steps for verifying and testing push notification delivery across **Physical Android Devices**, **iOS Devices**, and the **Admin Dashboard**.

---

## 1. End-to-End Architecture Verification Flow

```
┌─────────────────────────┐
│ BeautyOasisRx Dashboard │ ── (1) Admin clicks "Send Push Notification"
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Supabase Database      │ ── (2) Idempotent notification record saved
└───────────┬─────────────┘        (status: 'pending')
            │
            ▼
┌─────────────────────────┐
│ Supabase Edge Function  │ ── (3) Retrieves recipient's active tokens from push_devices
│ send-push-notification  │ ── (4) Authenticates with Google OAuth 2.0 (RS256 JWT)
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Firebase Cloud Messaging│ ── (5) Dispatches to FCM HTTP v1 API
│     (HTTP v1 API)       │
└───────────┬─────────────┘
            │
            ├─────────────────────────┬─────────────────────────┐
            ▼                         ▼                         ▼
  [Foreground State]        [Background State]        [Terminated State]
  In-app alert banner &     System notification tray  Device wakes via FCM high
  badge count sync          sound & heads-up banner   priority & posts notification
            │                         │                         │
            └─────────────────────────┼─────────────────────────┘
                                      ▼
                        [User Taps Notification]
                                      │
                                      ▼
                        Deep links to target screen:
                     - Appointment Detail Screen
                     - Order Detail Screen
                     - Notifications Feed
```

---

## 2. Testing on Physical Android Device

### 2.1 Build and Install
1. Connect physical Android phone via USB and enable **USB Debugging** in Developer Options.
2. Verify device connection:
   ```bash
   adb devices
   ```
3. Navigate to the mobile project and run:
   ```bash
   cd mobile
   npm install
   npx react-native run-android
   ```

### 2.2 Device Token Registration
1. Open the app on the phone.
2. If Android 13+ (API 33+), accept the **Notification Permission** dialog (`POST_NOTIFICATIONS`).
3. Sign in with an authenticated user/patient (e.g., `saurabh@gmail.com`).
4. The app automatically retrieves the FCM token and saves it into Supabase `public.push_devices`.
5. Open **Push Diagnostics Console** from the Home screen:
   - Verify the FCM Token is displayed.
   - Verify Supabase Table Status shows: `Active in Supabase`.

### 2.3 Testing the Three App States

#### A. Foreground State (App is open on screen)
1. Keep the app open on the phone.
2. In the Admin Dashboard (`http://localhost:5173/notifications`), click **Send Push Notification**.
3. Select your user, enter title and message, click **Send Notification**.
4. **Expected Result:**
   - An in-app alert dialog displays immediately: Title, Body, with `Dismiss` and `View` actions.
   - Unread badge counter increments in real-time.

#### B. Background State (App minimized / home screen)
1. Press the phone's **Home** button so the app is running in the background.
2. In the Admin Dashboard, dispatch another notification.
3. **Expected Result:**
   - Android system notification sound plays.
   - Heads-up banner drops down from status bar with channel `beautyoasis_urgent`.
   - Notification appears in the Android notification drawer.
   - Tapping the notification opens the app and navigates to the target screen.

#### C. Terminated / Closed State (App swiped away from Recents)
1. Open the Android App Switcher (Recents) and **swipe away** BeautyOasisRx to terminate the process.
2. In the Admin Dashboard, dispatch another notification.
3. **Expected Result:**
   - Because FCM message priority is set to `HIGH`, the Google Play Services daemon on the phone wakes and posts the notification to the status bar with sound.
   - Tapping the notification performs a **cold start** of the app and deep-links directly to the relevant record.

---

## 3. Important Operating System & OEM Limitations

### 3.1 Android "Force Stop" Limitation
* **Rule:** If a user navigates to **Settings → Apps → BeautyOasisRx → Force Stop**, Android puts the application into a *stopped state* (`FLAG_EXCLUDE_STOPPED_PACKAGES`).
* In this state, the OS will **NOT** deliver broadcasts or wake the app until the user explicitly opens the app icon again. This is an intentional security design of Android.

### 3.2 Aggressive OEM Battery Savers (Xiaomi MIUI/HyperOS, Samsung OneUI, OnePlus OxygenOS, Huawei)
* Some Android manufacturers restrict background processes aggressively:
  * Fix: In device settings, set **App Info → Battery → Unrestricted** (or "Don't Optimize").
  * Enable **Autostart** if present on Xiaomi/Huawei devices.

---

## 4. Testing on Physical iOS Device

### 4.1 Prerequisites
* Physical iPhone (Push notifications are not supported on iOS Simulator).
* Apple Developer Account with Push Notifications capability.
* APNs Key (`.p8`) uploaded to Firebase Console (see [FIREBASE_AND_SUPABASE_PUSH_GUIDE.md](./FIREBASE_AND_SUPABASE_PUSH_GUIDE.md)).

### 4.2 Build and Run
```bash
cd mobile/ios
pod install
cd ..
npx react-native run-ios --device
```

### 4.3 Permission & Delivery Verification
1. App prompts: *"BeautyOasisRx Would Like to Send You Notifications"* → Tap **Allow**.
2. Device token registers to Supabase `push_devices` (`platform = 'ios'`).
3. Test lock screen banners, Notification Center tray, and app badge icons.

---

## 5. End-to-End Verification Checklist

| Step | Action | Expected Output | Status |
| :--- | :--- | :--- | :---: |
| 1 | Run `supabase_push_notifications_and_devices.sql` | `notifications` extended & `push_devices` created | `[x]` |
| 2 | Open Dashboard Notifications page (`/notifications`) | "Send Push Notification" button & "Push Broadcasts" tab visible | `[x]` |
| 3 | Log into Mobile App on phone | Device row created in Supabase `push_devices` | `[x]` |
| 4 | Open Push Diagnostics Screen in Mobile App | Displays FCM Token & `Active in Supabase` | `[x]` |
| 5 | Click "Send Push Notification" in Admin Dashboard | Modal opens with recipient selector & live preview | `[x]` |
| 6 | Select recipient with registered device & click Send | Delivery feedback card displays status `sent` | `[x]` |
| 7 | Check mobile device in Foreground | In-app alert dialog appears & unread count updates | `[x]` |
| 8 | Minimize mobile app & send another notification | Android heads-up banner & sound trigger | `[x]` |
| 9 | Tap mobile notification | Deep links to Appointment/Order/Notification screen | `[x]` |
| 10 | Logout from mobile app | Device token marked `is_active = false` in `push_devices` | `[x]` |
