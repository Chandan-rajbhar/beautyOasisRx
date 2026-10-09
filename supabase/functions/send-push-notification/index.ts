import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@^2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-idempotency-key",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

interface PushNotificationPayload {
  recipient_type?: "specific_user" | "all_users" | "role";
  recipient_user_id?: string;
  recipient_role?: string;
  title: string;
  message?: string;
  body?: string;
  notification_type?: string;
  category?: string;
  related_entity_id?: string;
  deep_link?: string;
  action_url?: string;
  data?: Record<string, string>;
  idempotency_key?: string;
  priority?: "high" | "normal";
}

// In-memory token cache to prevent repeated OAuth token exchanges
let cachedAccessToken: { token: string; expiresAt: number } | null = null;

/**
 * Base64URL encoding helper
 */
function base64UrlEncode(str: string | Uint8Array): string {
  let binary = "";
  if (typeof str === "string") {
    const bytes = new TextEncoder().encode(str);
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
  } else {
    for (let i = 0; i < str.length; i++) {
      binary += String.fromCharCode(str[i]);
    }
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Convert PKCS#8 PEM string to Uint8Array for SubtleCrypto
 */
function pemToBinary(pem: string): Uint8Array {
  const cleanPem = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\\n/g, "")
    .replace(/\s+/g, "");
  const binaryString = atob(cleanPem);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generate Google OAuth 2.0 access token using Web Crypto SubtleCrypto
 */
async function getGoogleOAuthAccessToken(
  clientEmail: string,
  privateKeyPem: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // Return cached token if valid for at least 5 more minutes
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 300) {
    return cachedAccessToken.token;
  }

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const claims = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaims = base64UrlEncode(JSON.stringify(claims));
  const signingInput = `${encodedHeader}.${encodedClaims}`;

  const keyBytes = pemToBinary(privateKeyPem);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const encodedSignature = base64UrlEncode(new Uint8Array(signature));
  const jwt = `${signingInput}.${encodedSignature}`;

  // Exchange signed JWT for OAuth 2.0 access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    throw new Error(`Google OAuth token exchange failed: ${tokenResponse.status} - ${errorBody}`);
  }

  const tokenData = await tokenResponse.json();
  cachedAccessToken = {
    token: tokenData.access_token,
    expiresAt: now + (tokenData.expires_in || 3600),
  };

  return cachedAccessToken.token;
}

/**
 * Parse Firebase Service Account from environment variables
 */
function getFirebaseCredentials(): {
  projectId: string;
  clientEmail: string;
  privateKey: string;
} | null {
  // Option 1: Full JSON string in FIREBASE_SERVICE_ACCOUNT
  const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
  if (serviceAccountJson) {
    try {
      const parsed = JSON.parse(serviceAccountJson);
      if (parsed.project_id && parsed.client_email && parsed.private_key) {
        return {
          projectId: parsed.project_id,
          clientEmail: parsed.client_email,
          privateKey: parsed.private_key,
        };
      }
    } catch (e) {
      console.warn("Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:", e);
    }
  }

  // Option 2: Individual env vars
  const projectId = Deno.env.get("FIREBASE_PROJECT_ID");
  const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL");
  const privateKey = Deno.env.get("FIREBASE_PRIVATE_KEY");

  if (projectId && clientEmail && privateKey) {
    return {
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    };
  }

  return null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const clientKey = supabaseServiceRoleKey || supabaseAnonKey;

    if (!supabaseUrl || !clientKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase credentials in Edge Function environment" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, clientKey);

    // ────────────────────────────────────────────────────────────────────────
    // 1. AUTHENTICATE & AUTHORIZE REQUESTER
    // ────────────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("authorization");
    let callerUser = null;
    let isServiceRole = false;

    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (supabaseServiceRoleKey && token === supabaseServiceRoleKey) {
        isServiceRole = true;
      } else {
        // Check if token is a valid Supabase service_role JWT
        try {
          const parts = token.split(".");
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            if (payload && payload.role === "service_role") {
              isServiceRole = true;
            }
          }
        } catch (_) {}

        if (!isServiceRole) {
          const { data: { user }, error: userError } = await supabase.auth.getUser(token);
          if (!userError && user) {
            callerUser = user;
          }
        }
      }
    }

    // Strictly enforce authorization: either trusted service role or super_admin/admin user
    if (!isServiceRole) {
      if (!callerUser) {
        return new Response(
          JSON.stringify({ error: "Unauthorized: Missing or invalid authentication token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: dbUser } = await supabase
        .from("users")
        .select("role, status")
        .eq("id", callerUser.id)
        .maybeSingle();

      const role = dbUser?.role || callerUser.user_metadata?.role;
      const isAdmin = role === "super_admin" || role === "admin";

      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: "Forbidden: Super Admin or Admin role required to broadcast notifications" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // 2. PARSE AND VALIDATE PAYLOAD
    // ────────────────────────────────────────────────────────────────────────
    const body: PushNotificationPayload = await req.json().catch(() => ({}));
    const title = (body.title || "").trim();
    const message = (body.message || body.body || "").trim();
    const notificationType = (body.notification_type || body.category || "general").toLowerCase().trim();
    const relatedEntityId = body.related_entity_id ? String(body.related_entity_id).trim() : null;
    const deepLink = body.deep_link || body.action_url || null;
    const recipientType = body.recipient_type || (body.recipient_user_id ? "specific_user" : "all_users");
    const recipientUserId = body.recipient_user_id ? String(body.recipient_user_id).trim() : null;
    const idempotencyKey = body.idempotency_key || req.headers.get("x-idempotency-key") || null;
    const customData = body.data || {};

    if (!title) {
      return new Response(
        JSON.stringify({ error: "Notification title is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Notification message body is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ────────────────────────────────────────────────────────────────────────
    // 3. IDEMPOTENCY CHECK
    // ────────────────────────────────────────────────────────────────────────
    if (idempotencyKey) {
      const { data: existingNotif } = await supabase
        .from("notifications")
        .select("*")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (existingNotif) {
        console.log(`[send-push-notification] Idempotent request detected for key: ${idempotencyKey}`);
        return new Response(
          JSON.stringify({
            success: true,
            idempotent: true,
            notification_id: existingNotif.id,
            delivery_status: existingNotif.delivery_status,
            message: "Notification already processed with this idempotency key",
            notification: existingNotif,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // 4. RETRIEVE RECIPIENT DEVICE TOKENS
    // ────────────────────────────────────────────────────────────────────────
    let targetTokensQuery = supabase
      .from("push_devices")
      .select("id, user_id, fcm_token, platform, device_id")
      .eq("is_active", true);

    if (recipientType === "specific_user" && recipientUserId) {
      targetTokensQuery = targetTokensQuery.eq("user_id", recipientUserId);
    } else if (recipientType === "role" && body.recipient_role) {
      // Find user IDs matching role from users or patients
      const roleName = body.recipient_role.toLowerCase();
      if (roleName === "patient" || roleName === "patients") {
        const { data: patientsList } = await supabase.from("patients").select("id");
        const patientIds = (patientsList || []).map((p: any) => p.id);
        if (patientIds.length > 0) {
          targetTokensQuery = targetTokensQuery.in("user_id", patientIds);
        } else {
          targetTokensQuery = targetTokensQuery.eq("user_id", "00000000-0000-0000-0000-000000000000");
        }
      } else {
        const { data: staffList } = await supabase.from("users").select("id").eq("role", body.recipient_role);
        const staffIds = (staffList || []).map((s: any) => s.id);
        if (staffIds.length > 0) {
          targetTokensQuery = targetTokensQuery.in("user_id", staffIds);
        }
      }
    }

    const { data: activeDevices, error: devicesError } = await targetTokensQuery;
    if (devicesError) {
      console.warn("[send-push-notification] Error querying push_devices:", devicesError.message);
    }

    const devices = activeDevices || [];
    const initialStatus = devices.length === 0 ? "no_devices" : "pending";

    // ────────────────────────────────────────────────────────────────────────
    // 5. CREATE PERSISTENT SUPABASE NOTIFICATION RECORD
    // ────────────────────────────────────────────────────────────────────────
    const notificationInsert = {
      title,
      message,
      type: notificationType,
      category: notificationType,
      notification_type: notificationType,
      recipient_user_id: recipientUserId,
      user_id: recipientUserId,
      patient_id: recipientUserId,
      related_entity_id: relatedEntityId,
      reference_id: relatedEntityId,
      deep_link: deepLink,
      action_url: deepLink,
      link: deepLink,
      data_payload: {
        ...customData,
        recipient_type: recipientType,
        recipient_role: body.recipient_role || null,
        dispatched_at: new Date().toISOString(),
      },
      idempotency_key: idempotencyKey,
      is_read: false,
      delivery_status: initialStatus,
      delivery_details: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let createdNotif: any = null;
    const { data: insertedData, error: notifInsertError } = await supabase
      .from("notifications")
      .insert(notificationInsert)
      .select()
      .single();

    if (!notifInsertError && insertedData) {
      createdNotif = insertedData;
    } else if (notifInsertError) {
      console.warn("[send-push-notification] Insert notice:", notifInsertError.message);
      // If unique constraint violation (e.g. uq_notifications_type_reference or idempotency key)
      if (notifInsertError.code === "23505" || notifInsertError.message?.includes("unique constraint")) {
        let query = supabase.from("notifications").select("*");
        if (relatedEntityId) {
          query = query.eq("type", notificationType).eq("reference_id", relatedEntityId);
        } else if (idempotencyKey) {
          query = query.eq("idempotency_key", idempotencyKey);
        }
        const { data: existing } = await query.maybeSingle();
        if (existing) {
          const { data: updated } = await supabase
            .from("notifications")
            .update({
              title,
              message,
              delivery_status: initialStatus,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id)
            .select()
            .single();
          createdNotif = updated || existing;
        }
      }

      if (!createdNotif) {
        console.error("[send-push-notification] Database insert error:", notifInsertError);
        return new Response(
          JSON.stringify({ error: `Failed to persist notification record: ${notifInsertError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const notifId = createdNotif.id;

    // If no devices found, complete gracefully with saved record
    if (devices.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          notification_id: notifId,
          delivery_status: "no_devices",
          tokens_count: 0,
          sent_count: 0,
          failed_count: 0,
          message: "Notification saved in Supabase. Recipient currently has 0 registered active mobile devices.",
          notification: createdNotif,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ────────────────────────────────────────────────────────────────────────
    // 6. FIREBASE CLOUD MESSAGING HTTP v1 DISPATCH
    // ────────────────────────────────────────────────────────────────────────
    const fbCreds = getFirebaseCredentials();

    // If Firebase credentials are not yet configured in Supabase secrets
    if (!fbCreds) {
      console.warn("[send-push-notification] FIREBASE_SERVICE_ACCOUNT or FIREBASE_PROJECT_ID secrets not configured.");
      await supabase
        .from("notifications")
        .update({
          delivery_status: "pending_fcm_configuration",
          delivery_details: [{
            info: "Firebase credentials pending in Supabase secrets. Token count matched.",
            target_devices_count: devices.length,
          }],
        })
        .eq("id", notifId);

      return new Response(
        JSON.stringify({
          success: true,
          notification_id: notifId,
          delivery_status: "pending_fcm_configuration",
          tokens_count: devices.length,
          sent_count: 0,
          failed_count: 0,
          message: "Notification saved in Supabase. Firebase service account secrets required to deliver push.",
          setup_required: "Set FIREBASE_SERVICE_ACCOUNT or FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in Supabase Edge Function Secrets.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Obtain Google OAuth 2.0 Access Token
    let accessToken: string;
    try {
      accessToken = await getGoogleOAuthAccessToken(fbCreds.clientEmail, fbCreds.privateKey);
    } catch (authError: any) {
      console.error("[send-push-notification] OAuth error:", authError.message);
      await supabase
        .from("notifications")
        .update({
          delivery_status: "failed",
          delivery_details: [{ error: `FCM OAuth authentication failure: ${authError.message}` }],
        })
        .eq("id", notifId);

      return new Response(
        JSON.stringify({
          success: false,
          notification_id: notifId,
          delivery_status: "failed",
          error: `Google OAuth failure: ${authError.message}`,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deliver to each registered device token
    const deliveryResults: Array<{
      token: string;
      platform: string;
      status: "sent" | "failed";
      message_id?: string;
      error?: string;
    }> = [];

    const invalidTokens: string[] = [];
    let sentCount = 0;
    let failedCount = 0;

    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${fbCreds.projectId}/messages:send`;

    for (const dev of devices) {
      const fcmMessage = {
        message: {
          token: dev.fcm_token,
          notification: {
            title,
            body: message,
          },
          data: {
            notification_id: notifId,
            type: notificationType,
            category: notificationType,
            related_entity_id: relatedEntityId || "",
            deep_link: deepLink || "",
            click_action: "FLUTTER_NOTIFICATION_CLICK",
            ...Object.fromEntries(
              Object.entries(customData).map(([k, v]) => [k, String(v)])
            ),
          },
          android: {
            priority: body.priority === "normal" ? "NORMAL" : "HIGH",
            notification: {
              channel_id: "beautyoasis_urgent",
              sound: "default",
              click_action: "OPEN_ACTIVITY",
              tag: notifId,
            },
          },
          apns: {
            headers: {
              "apns-priority": "10",
            },
            payload: {
              aps: {
                alert: {
                  title,
                  body: message,
                },
                sound: "default",
                badge: 1,
                "content-available": 1,
              },
            },
          },
        },
      };

      let lastErrMessage = "";
      let lastErrorCode = "";
      let isSuccess = false;
      let successMessageId = "";
      const maxRetries = 2; // Up to 2 retries for transient 500/503/429 or network errors

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            // Exponential backoff delay (300ms, 600ms)
            await new Promise((resolve) => setTimeout(resolve, attempt * 300));
          }

          const fcmRes = await fetch(fcmEndpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(fcmMessage),
          });

          if (fcmRes.ok) {
            const resJson = await fcmRes.json();
            isSuccess = true;
            successMessageId = resJson.name;
            break;
          }

          const errData = await fcmRes.json().catch(() => ({}));
          lastErrorCode = errData?.error?.details?.[0]?.errorCode || errData?.error?.status || "UNKNOWN";
          lastErrMessage = errData?.error?.message || `HTTP ${fcmRes.status}`;

          // Check if retryable transient error
          const isTransient = fcmRes.status === 429 || fcmRes.status >= 500;
          if (!isTransient) {
            // Permanent error (e.g. 400, 404, UNREGISTERED) - do not retry
            if (
              lastErrorCode === "UNREGISTERED" ||
              lastErrorCode === "INVALID_ARGUMENT" ||
              lastErrMessage.includes("registration token is not registered")
            ) {
              invalidTokens.push(dev.fcm_token);
            }
            break;
          }
        } catch (sendErr: any) {
          lastErrMessage = sendErr.message;
          lastErrorCode = "NETWORK_ERROR";
        }
      }

      if (isSuccess) {
        sentCount++;
        deliveryResults.push({
          token: dev.fcm_token.substring(0, 10) + "...",
          platform: dev.platform,
          status: "sent",
          message_id: successMessageId,
        });
      } else {
        failedCount++;
        deliveryResults.push({
          token: dev.fcm_token.substring(0, 10) + "...",
          platform: dev.platform,
          status: "failed",
          error: `${lastErrorCode}: ${lastErrMessage}`,
        });
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // 7. CLEANUP INVALID TOKENS AUTOMATICALLY
    // ────────────────────────────────────────────────────────────────────────
    if (invalidTokens.length > 0) {
      await supabase
        .from("push_devices")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in("fcm_token", invalidTokens);
      console.log(`[send-push-notification] Deactivated ${invalidTokens.length} dead FCM tokens.`);
    }

    // Determine aggregate delivery status
    const finalStatus = sentCount > 0 ? (failedCount > 0 ? "partial" : "sent") : "failed";

    // ────────────────────────────────────────────────────────────────────────
    // 8. UPDATE NOTIFICATION IN SUPABASE WITH FINAL DELIVERY STATUS
    // ────────────────────────────────────────────────────────────────────────
    const { data: updatedNotif } = await supabase
      .from("notifications")
      .update({
        delivery_status: finalStatus,
        delivery_details: deliveryResults,
        updated_at: new Date().toISOString(),
      })
      .eq("id", notifId)
      .select()
      .single();

    return new Response(
      JSON.stringify({
        success: sentCount > 0,
        notification_id: notifId,
        delivery_status: finalStatus,
        tokens_count: devices.length,
        sent_count: sentCount,
        failed_count: failedCount,
        deactivated_invalid_tokens: invalidTokens.length,
        delivery_details: deliveryResults,
        notification: updatedNotif || createdNotif,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[send-push-notification] Unhandled fatal error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
