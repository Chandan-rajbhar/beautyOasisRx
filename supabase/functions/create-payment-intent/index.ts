// Delegate to or share implementation with stripe-payment
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "npm:stripe@^14.25.0";
import { createClient } from "npm:@supabase/supabase-js@^2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: "STRIPE_SECRET_KEY is not configured in Supabase Edge Function secrets" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Supabase credentials missing in Edge Function environment" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json().catch(() => ({}));
    const { action = "create-payment-intent", recordType, recordId, paymentIntentId, customerEmail, customerName } = body;

    if (action === "verify-payment") {
      if (!paymentIntentId) {
        return new Response(
          JSON.stringify({ error: "paymentIntentId is required for verification" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status !== "succeeded") {
        return new Response(
          JSON.stringify({
            success: false,
            verified: false,
            status: paymentIntent.status,
            message: `Payment has not succeeded. Current status: ${paymentIntent.status}`,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const targetType = recordType || paymentIntent.metadata?.record_type;
      const targetId = recordId || paymentIntent.metadata?.record_id;

      if (targetType === "appointment" && targetId) {
        const { data: existingAppt } = await supabase
          .from("appointments")
          .select("*")
          .eq("id", targetId)
          .single();

        if (existingAppt) {
          await supabase
            .from("appointments")
            .update({
              payment_status: "Paid",
              stripe_payment_intent_id: paymentIntent.id,
              updated_at: new Date().toISOString(),
            })
            .eq("id", targetId);

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
              appointment_id: targetId,
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
      } else if (targetType === "order" && targetId) {
        const { data: existingOrder } = await supabase
          .from("orders")
          .select("*")
          .eq("id", targetId)
          .single();

        if (existingOrder) {
          await supabase
            .from("orders")
            .update({
              payment_status: "Paid",
              order_status: "Placed",
              payment_method: "Credit Card (Stripe)",
              stripe_payment_intent_id: paymentIntent.id,
              updated_at: new Date().toISOString(),
            })
            .eq("id", targetId);

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
              order_id: targetId,
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
              description: `Apothecary Settlement for Order #${existingOrder.order_number || targetId}`,
              date: new Date().toISOString(),
            });
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          verified: true,
          status: "succeeded",
          recordType: targetType,
          recordId: targetId,
          paymentIntentId: paymentIntent.id,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!recordType || !recordId) {
      return new Response(
        JSON.stringify({ error: "recordType ('appointment' or 'order') and recordId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let calculatedAmount = 0;
    let customerDesc = "";
    let resolvedEmail = customerEmail || "";
    let resolvedName = customerName || "";
    let clientId = "";

    if (recordType === "appointment") {
      const { data: appt, error: apptErr } = await supabase
        .from("appointments")
        .select("*")
        .eq("id", recordId)
        .single();

      if (apptErr || !appt) {
        return new Response(
          JSON.stringify({ error: `Appointment not found with ID: ${recordId}` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if already paid
      if (String(appt.payment_status).toLowerCase() === "paid") {
        return new Response(
          JSON.stringify({ error: "This appointment is already marked as Paid", isAlreadyPaid: true }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      calculatedAmount = Number(appt.price || appt.amount || 0);
      resolvedName = resolvedName || appt.patient_name || appt.client_name || "Patient";
      resolvedEmail = resolvedEmail || appt.patient_email || appt.client_email || "";
      clientId = appt.patient_id || appt.client_id || "";
      customerDesc = `Clinical Consultation: ${appt.protocol_title || appt.service_name || "Appointment"}`;

      if (appt.stripe_payment_intent_id) {
        try {
          const existingPi = await stripe.paymentIntents.retrieve(appt.stripe_payment_intent_id);
          if (existingPi.status === "succeeded") {
            await supabase.from("appointments").update({ payment_status: "Paid" }).eq("id", recordId);
            return new Response(
              JSON.stringify({
                success: true,
                isAlreadyPaid: true,
                paymentIntentId: existingPi.id,
                message: "Appointment was already completed in Stripe.",
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          if (["requires_payment_method", "requires_confirmation", "requires_action"].includes(existingPi.status)) {
            return new Response(
              JSON.stringify({
                success: true,
                clientSecret: existingPi.client_secret,
                paymentIntentId: existingPi.id,
                amount: calculatedAmount,
                currency: existingPi.currency,
                reused: true,
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } catch {
          // ignore
        }
      }
    } else if (recordType === "order") {
      const { data: ord, error: ordErr } = await supabase
        .from("orders")
        .select("*")
        .eq("id", recordId)
        .single();

      if (ordErr || !ord) {
        return new Response(
          JSON.stringify({ error: `Order not found with ID: ${recordId}` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (String(ord.payment_status).toLowerCase() === "paid") {
        return new Response(
          JSON.stringify({ error: "This order is already marked as Paid", isAlreadyPaid: true }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const possibleOrderAmounts = [ord.outstanding_balance, ord.total_amount, ord.total, ord.subtotal];
      for (const val of possibleOrderAmounts) {
        const num = Number(val);
        if (!isNaN(num) && num > 0) {
          calculatedAmount = num;
          break;
        }
      }
      resolvedName = resolvedName || ord.client_name || ord.customer_name || "Patient";
      resolvedEmail = resolvedEmail || ord.client_email || ord.customer_email || "";
      clientId = ord.client_id || "";
      customerDesc = `Apothecary Order #${ord.order_number || ord.id}`;

      if (ord.stripe_payment_intent_id) {
        try {
          const existingPi = await stripe.paymentIntents.retrieve(ord.stripe_payment_intent_id);
          if (existingPi.status === "succeeded") {
            await supabase.from("orders").update({ payment_status: "Paid", order_status: "Placed", status: "Placed" }).eq("id", recordId);
            return new Response(
              JSON.stringify({
                success: true,
                isAlreadyPaid: true,
                paymentIntentId: existingPi.id,
                message: "Order was already completed in Stripe.",
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          if (["requires_payment_method", "requires_confirmation", "requires_action"].includes(existingPi.status)) {
            return new Response(
              JSON.stringify({
                success: true,
                clientSecret: existingPi.client_secret,
                paymentIntentId: existingPi.id,
                amount: calculatedAmount,
                currency: existingPi.currency,
                reused: true,
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } catch {
          // ignore
        }
      }
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid recordType. Supported values: 'appointment', 'order'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (calculatedAmount <= 0) {
      return new Response(
        JSON.stringify({ error: `Invalid payment amount: $${calculatedAmount.toFixed(2)}. Amount must be greater than 0.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const amountInCents = Math.round(calculatedAmount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "usd",
      description: customerDesc,
      receipt_email: resolvedEmail || undefined,
      metadata: {
        record_type: recordType,
        record_id: String(recordId),
        user_id: clientId || "",
        client_name: resolvedName || "",
      },
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never",
      },
    });

    if (recordType === "appointment") {
      await supabase
        .from("appointments")
        .update({
          stripe_payment_intent_id: paymentIntent.id,
          payment_status: "Pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", recordId);
    } else if (recordType === "order") {
      await supabase
        .from("orders")
        .update({
          stripe_payment_intent_id: paymentIntent.id,
          payment_status: "Pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", recordId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: calculatedAmount,
        currency: "usd",
        recordType,
        recordId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Payment intent error:", err);
    return new Response(
      JSON.stringify({
        error: err.message || "An unexpected error occurred processing Stripe payment",
        type: err.type || "server_error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
