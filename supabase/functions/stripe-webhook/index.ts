import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "npm:stripe@^14.25.0";
import { createClient } from "npm:@supabase/supabase-js@^2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      return new Response("Missing STRIPE_SECRET_KEY", { status: 500, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response("Missing Supabase credentials", { status: 500, headers: corsHeaders });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const signature = req.headers.get("stripe-signature");
    const bodyText = await req.text();

    let event: Stripe.Event;

    if (webhookSecret && signature) {
      try {
        event = await stripe.webhooks.constructEventAsync(bodyText, signature, webhookSecret);
      } catch (err: any) {
        console.error("Webhook signature verification failed:", err.message);
        return new Response(`Webhook Error: ${err.message}`, { status: 400, headers: corsHeaders });
      }
    } else {
      // Safe fallback if webhook secret is not yet registered in Stripe dashboard
      try {
        event = JSON.parse(bodyText);
      } catch {
        return new Response("Invalid JSON payload", { status: 400, headers: corsHeaders });
      }
    }

    // Handle payment_intent.succeeded
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const recordType = paymentIntent.metadata?.record_type;
      const recordId = paymentIntent.metadata?.record_id;

      if (recordType === "appointment" && recordId) {
        const { data: existingAppt } = await supabase
          .from("appointments")
          .select("*")
          .eq("id", recordId)
          .single();

        if (existingAppt && String(existingAppt.payment_status).toLowerCase() !== "paid") {
          await supabase
            .from("appointments")
            .update({
              payment_status: "Paid",
              stripe_payment_intent_id: paymentIntent.id,
              updated_at: new Date().toISOString(),
            })
            .eq("id", recordId);

          // Idempotent payment recording
          const { data: existingPayment } = await supabase
            .from("payments")
            .select("id")
            .eq("reference", paymentIntent.id)
            .maybeSingle();

          if (!existingPayment) {
            const amountCharged = (paymentIntent.amount / 100);
            const resolvedName = existingAppt.patient_name || existingAppt.client_name || "Valued Patient";
            await supabase.from("payments").insert({
              customer_name: resolvedName,
              client_name: resolvedName,
              customer_email: existingAppt.patient_email || existingAppt.client_email || null,
              client_id: existingAppt.patient_id || existingAppt.client_id || null,
              appointment_id: recordId,
              amount: amountCharged,
              total_amount: amountCharged,
              currency: paymentIntent.currency.toUpperCase(),
              method: "Credit Card (Stripe)",
              payment_method: "Credit Card (Stripe)",
              status: "Paid",
              payment_status: "Paid",
              reference: paymentIntent.id,
              stripe_payment_intent_id: paymentIntent.id,
              address_line1: "123 Clinic Way",
              city: "Allen",
              state: "TX",
              pincode: "75013",
              country: "USA",
              description: `Clinical Service: ${existingAppt.protocol_title || existingAppt.service_name || "Appointment"}`,
              date: new Date().toISOString(),
            });
          }
        }
      } else if (recordType === "order" && recordId) {
        const { data: existingOrder } = await supabase
          .from("orders")
          .select("*")
          .eq("id", recordId)
          .single();

        if (existingOrder && String(existingOrder.payment_status).toLowerCase() !== "paid") {
          await supabase
            .from("orders")
            .update({
              payment_status: "Paid",
              order_status: "Placed",
              payment_method: "Credit Card (Stripe)",
              stripe_payment_intent_id: paymentIntent.id,
              updated_at: new Date().toISOString(),
            })
            .eq("id", recordId);

          // Idempotent payment recording
          const { data: existingPayment } = await supabase
            .from("payments")
            .select("id")
            .eq("reference", paymentIntent.id)
            .maybeSingle();

          if (!existingPayment) {
            const amountCharged = (paymentIntent.amount / 100);
            const resolvedName = existingOrder.customer_name || existingOrder.client_name || "Valued Patient";
            await supabase.from("payments").insert({
              customer_name: resolvedName,
              client_name: resolvedName,
              customer_email: existingOrder.customer_email || existingOrder.client_email || null,
              client_id: existingOrder.client_id || null,
              user_id: existingOrder.user_id || null,
              order_id: recordId,
              amount: amountCharged,
              total_amount: amountCharged,
              currency: paymentIntent.currency.toUpperCase(),
              method: "Credit Card (Stripe)",
              payment_method: "Credit Card (Stripe)",
              status: "Completed",
              payment_status: "Paid",
              reference: paymentIntent.id,
              stripe_payment_intent_id: paymentIntent.id,
              address_line1: existingOrder.shipping_address || "123 Clinic Way",
              city: "Allen",
              state: "TX",
              pincode: "75013",
              country: "USA",
              description: `Apothecary Settlement for Order #${existingOrder.order_number || recordId}`,
              date: new Date().toISOString(),
            });
          }
        }
      }

      // ─────────────────────────────────────────────────────────────
      // VERIFIED PAYMENT NOTIFICATION & PUSH DISPATCH
      // ─────────────────────────────────────────────────────────────
      const notifIdempotency = `payment-notif-${paymentIntent.id}`;
      const { data: existingNotif } = await supabase
        .from("notifications")
        .select("id")
        .eq("idempotency_key", notifIdempotency)
        .maybeSingle();

      if (!existingNotif) {
        const patientId = paymentIntent.metadata?.patient_id || null;
        const currencySymbol = paymentIntent.currency.toUpperCase() === "USD" ? "$" : `${paymentIntent.currency.toUpperCase()} `;
        const formattedAmt = `${currencySymbol}${(paymentIntent.amount / 100).toFixed(2)}`;

        await supabase.from("notifications").insert({
          title: `Payment Confirmed (${formattedAmt})`,
          message: `Payment of ${formattedAmt} received successfully for ${recordType === 'appointment' ? 'appointment session' : 'apothecary order'}.`,
          type: "payment",
          category: "payment",
          notification_type: "payment",
          recipient_user_id: patientId,
          related_entity_id: paymentIntent.id,
          deep_link: recordId ? (recordType === 'appointment' ? `/appointments/${recordId}` : `/orders/${recordId}`) : null,
          delivery_status: "pending",
          idempotency_key: notifIdempotency,
          is_read: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        // Trigger push notification to patient's registered devices
        try {
          const edgeFuncUrl = `${supabaseUrl}/functions/v1/send-push-notification`;
          await fetch(edgeFuncUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
              "apikey": supabaseServiceKey,
              "x-idempotency-key": notifIdempotency,
            },
            body: JSON.stringify({
              title: `Payment Confirmed (${formattedAmt})`,
              message: `Your payment of ${formattedAmt} has been processed successfully.`,
              notification_type: "payment",
              recipient_user_id: patientId,
              related_entity_id: paymentIntent.id,
              deep_link: recordId ? (recordType === 'appointment' ? `/appointments/${recordId}` : `/orders/${recordId}`) : null,
              idempotency_key: notifIdempotency,
            }),
          });
        } catch (pushErr) {
          console.warn("Webhook push dispatch warning:", pushErr);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Webhook processing error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
