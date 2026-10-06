-- ==============================================================================
-- FIX PAYMENT NOTIFICATIONS: DYNAMIC AMOUNT, CURRENCY & CUSTOMER NAME
-- ==============================================================================
-- Fixes the issue where payment notifications showed '$0.00' and 'Client'
-- even when actual payment amount, currency, and customer name were present.
-- ==============================================================================

-- 1. Synchronize amount and total_amount, client_name and customer_name on payments table
UPDATE public.payments
SET amount = total_amount
WHERE (amount IS NULL OR amount = 0) AND total_amount IS NOT NULL AND total_amount > 0;

UPDATE public.payments
SET total_amount = amount
WHERE (total_amount IS NULL OR total_amount = 0) AND amount IS NOT NULL AND amount > 0;

UPDATE public.payments
SET client_name = customer_name
WHERE (client_name IS NULL OR TRIM(client_name) = '') AND customer_name IS NOT NULL AND TRIM(customer_name) <> '';

UPDATE public.payments
SET customer_name = client_name
WHERE (customer_name IS NULL OR TRIM(customer_name) = '') AND client_name IS NOT NULL AND TRIM(client_name) <> '';

-- 2. CREATE OR REPLACE FUNCTION public.fn_notify_on_payment_insert
CREATE OR REPLACE FUNCTION public.fn_notify_on_payment_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_json JSONB;
  v_id TEXT;
  v_raw_amount NUMERIC;
  v_order_amount NUMERIC;
  v_appt_amount NUMERIC;
  v_final_amount NUMERIC;
  v_curr_code TEXT;
  v_curr_symbol TEXT;
  v_customer_name TEXT;
  v_title TEXT;
  v_message TEXT;
  v_formatted_amount TEXT;
BEGIN
  v_json := to_jsonb(NEW);
  v_id := COALESCE(v_json->>'id', NEW.id::text);

  -- 2.1 Deduplication check: if notification already exists for this payment reference_id, exit
  IF v_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.notifications 
    WHERE LOWER(type) = 'payment' 
      AND LOWER(TRIM(reference_id)) = LOWER(TRIM(v_id))
  ) THEN
    RETURN NEW;
  END IF;

  -- 2.2 Resolve Amount dynamically:
  v_raw_amount := NULLIF(COALESCE(
    CASE WHEN NEW.total_amount IS NOT NULL AND NEW.total_amount > 0 THEN NEW.total_amount ELSE NULL END,
    CASE WHEN NEW.amount IS NOT NULL AND NEW.amount > 0 THEN NEW.amount ELSE NULL END,
    CASE WHEN NEW.raw_subtotal IS NOT NULL AND NEW.raw_subtotal > 0 THEN NEW.raw_subtotal ELSE NULL END
  ), 0);

  -- Fallback to parent order if order_id exists and amount not found
  IF (v_raw_amount IS NULL OR v_raw_amount = 0) AND NEW.order_id IS NOT NULL AND TRIM(NEW.order_id) <> '' THEN
    SELECT COALESCE(
      NULLIF(o.total_amount, 0),
      NULLIF(o.total, 0),
      NULLIF(o.subtotal, 0)
    )
    INTO v_order_amount
    FROM public.orders o
    WHERE o.id::text = NEW.order_id OR (o.invoice_number IS NOT NULL AND o.invoice_number = NEW.order_id)
    LIMIT 1;

    IF v_order_amount IS NOT NULL AND v_order_amount > 0 THEN
      v_raw_amount := v_order_amount;
    END IF;
  END IF;

  -- Fallback to parent appointment if appointment_id exists and amount not found
  IF (v_raw_amount IS NULL OR v_raw_amount = 0) AND NEW.appointment_id IS NOT NULL THEN
    SELECT COALESCE(
      NULLIF(a.amount, 0),
      NULLIF(a.price, 0)
    )
    INTO v_appt_amount
    FROM public.appointments a
    WHERE a.id = NEW.appointment_id
    LIMIT 1;

    IF v_appt_amount IS NOT NULL AND v_appt_amount > 0 THEN
      v_raw_amount := v_appt_amount;
    END IF;
  END IF;

  v_final_amount := COALESCE(v_raw_amount, NEW.total_amount, NEW.amount, 0);

  -- 2.3 Resolve Currency Code & Symbol
  v_curr_code := UPPER(TRIM(COALESCE(
    NULLIF(NEW.currency, ''),
    (SELECT o.currency FROM public.orders o WHERE (o.id::text = NEW.order_id OR (o.invoice_number IS NOT NULL AND o.invoice_number = NEW.order_id)) LIMIT 1),
    'USD'
  )));

  CASE v_curr_code
    WHEN 'GBP' THEN v_curr_symbol := '£';
    WHEN 'EUR' THEN v_curr_symbol := '€';
    WHEN 'INR' THEN v_curr_symbol := '₹';
    WHEN 'CAD' THEN v_curr_symbol := '$';
    WHEN 'AUD' THEN v_curr_symbol := '$';
    WHEN 'USD' THEN v_curr_symbol := '$';
    ELSE v_curr_symbol := '$';
  END CASE;

  -- 2.4 Format Amount dynamically to 2 decimal places
  v_formatted_amount := v_curr_symbol || TRIM(TO_CHAR(v_final_amount, 'FM999,999,990.00'));

  -- 2.5 Resolve Customer Name
  v_customer_name := COALESCE(
    NULLIF(TRIM(NEW.customer_name), ''),
    NULLIF(TRIM(NEW.client_name), ''),
    (SELECT COALESCE(NULLIF(TRIM(o.customer_name), ''), NULLIF(TRIM(o.client_name), '')) FROM public.orders o WHERE (o.id::text = NEW.order_id OR (o.invoice_number IS NOT NULL AND o.invoice_number = NEW.order_id)) LIMIT 1),
    (SELECT COALESCE(NULLIF(TRIM(a.patient_name), ''), NULLIF(TRIM(a.client_name), '')) FROM public.appointments a WHERE a.id = NEW.appointment_id LIMIT 1),
    'Patient'
  );

  v_title := 'Payment Confirmed (' || v_formatted_amount || ')';
  v_message := 'Payment of ' || v_formatted_amount || ' confirmed for ' || v_customer_name || '.';

  -- 2.6 Insert Notification
  INSERT INTO public.notifications (
    title,
    message,
    type,
    category,
    reference_id,
    is_read,
    created_at
  ) VALUES (
    v_title,
    v_message,
    'payment',
    'payment',
    v_id,
    false,
    NOW()
  )
  ON CONFLICT (LOWER(type), LOWER(TRIM(reference_id))) 
  WHERE reference_id IS NOT NULL AND TRIM(reference_id) <> '' 
  DO UPDATE SET
    title = EXCLUDED.title,
    message = EXCLUDED.message,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger to payments
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
    DROP TRIGGER IF EXISTS trg_notify_new_payment ON public.payments;
    CREATE TRIGGER trg_notify_new_payment
      AFTER INSERT ON public.payments
      FOR EACH ROW
      EXECUTE FUNCTION public.fn_notify_on_payment_insert();
  END IF;
END $$;

-- 3. CREATE OR REPLACE FUNCTION public.fn_log_payment_activity
CREATE OR REPLACE FUNCTION public.fn_log_payment_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_raw_amount NUMERIC;
  v_order_amount NUMERIC;
  v_appt_amount NUMERIC;
  v_final_amount NUMERIC;
  v_curr_code TEXT;
  v_curr_symbol TEXT;
  v_customer_name TEXT;
  v_formatted_amount TEXT;
BEGIN
  v_raw_amount := NULLIF(COALESCE(
    CASE WHEN NEW.total_amount IS NOT NULL AND NEW.total_amount > 0 THEN NEW.total_amount ELSE NULL END,
    CASE WHEN NEW.amount IS NOT NULL AND NEW.amount > 0 THEN NEW.amount ELSE NULL END,
    CASE WHEN NEW.raw_subtotal IS NOT NULL AND NEW.raw_subtotal > 0 THEN NEW.raw_subtotal ELSE NULL END
  ), 0);

  IF (v_raw_amount IS NULL OR v_raw_amount = 0) AND NEW.order_id IS NOT NULL AND TRIM(NEW.order_id) <> '' THEN
    SELECT COALESCE(NULLIF(o.total_amount, 0), NULLIF(o.total, 0), NULLIF(o.subtotal, 0))
    INTO v_order_amount
    FROM public.orders o
    WHERE o.id::text = NEW.order_id OR (o.invoice_number IS NOT NULL AND o.invoice_number = NEW.order_id)
    LIMIT 1;

    IF v_order_amount IS NOT NULL AND v_order_amount > 0 THEN
      v_raw_amount := v_order_amount;
    END IF;
  END IF;

  IF (v_raw_amount IS NULL OR v_raw_amount = 0) AND NEW.appointment_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(a.amount, 0), NULLIF(a.price, 0))
    INTO v_appt_amount
    FROM public.appointments a
    WHERE a.id = NEW.appointment_id
    LIMIT 1;

    IF v_appt_amount IS NOT NULL AND v_appt_amount > 0 THEN
      v_raw_amount := v_appt_amount;
    END IF;
  END IF;

  v_final_amount := COALESCE(v_raw_amount, NEW.total_amount, NEW.amount, 0);

  v_curr_code := UPPER(TRIM(COALESCE(
    NULLIF(NEW.currency, ''),
    (SELECT o.currency FROM public.orders o WHERE (o.id::text = NEW.order_id OR (o.invoice_number IS NOT NULL AND o.invoice_number = NEW.order_id)) LIMIT 1),
    'USD'
  )));

  CASE v_curr_code
    WHEN 'GBP' THEN v_curr_symbol := '£';
    WHEN 'EUR' THEN v_curr_symbol := '€';
    WHEN 'INR' THEN v_curr_symbol := '₹';
    WHEN 'CAD' THEN v_curr_symbol := '$';
    WHEN 'AUD' THEN v_curr_symbol := '$';
    WHEN 'USD' THEN v_curr_symbol := '$';
    ELSE v_curr_symbol := '$';
  END CASE;

  v_formatted_amount := v_curr_symbol || TRIM(TO_CHAR(v_final_amount, 'FM999,999,990.00'));

  v_customer_name := COALESCE(
    NULLIF(TRIM(NEW.customer_name), ''),
    NULLIF(TRIM(NEW.client_name), ''),
    (SELECT COALESCE(NULLIF(TRIM(o.customer_name), ''), NULLIF(TRIM(o.client_name), '')) FROM public.orders o WHERE (o.id::text = NEW.order_id OR (o.invoice_number IS NOT NULL AND o.invoice_number = NEW.order_id)) LIMIT 1),
    (SELECT COALESCE(NULLIF(TRIM(a.patient_name), ''), NULLIF(TRIM(a.client_name), '')) FROM public.appointments a WHERE a.id = NEW.appointment_id LIMIT 1),
    'Patient'
  );

  INSERT INTO public.activity_logs (action, description, entity_type, entity_id, created_at)
  VALUES (
    'payment_received',
    'Payment of ' || v_formatted_amount || ' settled for ' || v_customer_name,
    'payment',
    NEW.id::text,
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. UPDATE ALL EXISTING PAYMENT NOTIFICATIONS IN public.notifications
UPDATE public.notifications n
SET
  title = 'Payment Confirmed (' ||
    CASE UPPER(TRIM(COALESCE(p.currency, 'USD')))
      WHEN 'GBP' THEN '£'
      WHEN 'EUR' THEN '€'
      WHEN 'INR' THEN '₹'
      WHEN 'CAD' THEN '$'
      WHEN 'AUD' THEN '$'
      WHEN 'USD' THEN '$'
      ELSE '$'
    END || TRIM(TO_CHAR(COALESCE(NULLIF(p.total_amount, 0), NULLIF(p.amount, 0), NULLIF(p.raw_subtotal, 0), 0), 'FM999,999,990.00')) || ')',
  message = 'Payment of ' ||
    CASE UPPER(TRIM(COALESCE(p.currency, 'USD')))
      WHEN 'GBP' THEN '£'
      WHEN 'EUR' THEN '€'
      WHEN 'INR' THEN '₹'
      WHEN 'CAD' THEN '$'
      WHEN 'AUD' THEN '$'
      WHEN 'USD' THEN '$'
      ELSE '$'
    END || TRIM(TO_CHAR(COALESCE(NULLIF(p.total_amount, 0), NULLIF(p.amount, 0), NULLIF(p.raw_subtotal, 0), 0), 'FM999,999,990.00')) ||
    ' confirmed for ' || COALESCE(NULLIF(TRIM(p.customer_name), ''), NULLIF(TRIM(p.client_name), ''), 'Client') || '.',
  updated_at = NOW()
FROM public.payments p
WHERE n.reference_id = p.id::text
  AND LOWER(n.type) = 'payment'
  AND (COALESCE(p.total_amount, p.amount, p.raw_subtotal, 0) > 0);

-- 5. UPDATE ALL EXISTING ACTIVITY LOGS FOR PAYMENTS
UPDATE public.activity_logs a
SET
  description = 'Payment of ' ||
    CASE UPPER(TRIM(COALESCE(p.currency, 'USD')))
      WHEN 'GBP' THEN '£'
      WHEN 'EUR' THEN '€'
      WHEN 'INR' THEN '₹'
      WHEN 'CAD' THEN '$'
      WHEN 'AUD' THEN '$'
      WHEN 'USD' THEN '$'
      ELSE '$'
    END || TRIM(TO_CHAR(COALESCE(NULLIF(p.total_amount, 0), NULLIF(p.amount, 0), NULLIF(p.raw_subtotal, 0), 0), 'FM999,999,990.00')) ||
    ' settled for ' || COALESCE(NULLIF(TRIM(p.customer_name), ''), NULLIF(TRIM(p.client_name), ''), 'Patient')
FROM public.payments p
WHERE a.entity_id = p.id::text
  AND a.entity_type = 'payment'
  AND (COALESCE(p.total_amount, p.amount, p.raw_subtotal, 0) > 0);

-- 6. REMOVE ORPHANED NOTIFICATIONS & ACTIVITY LOGS WITH NO PAYMENT ROW THAT HAVE $0.00
DELETE FROM public.notifications n
WHERE LOWER(n.type) = 'payment'
  AND (n.title ILIKE '%$0.00%' OR n.message ILIKE '%$0.00%')
  AND NOT EXISTS (
    SELECT 1 FROM public.payments p WHERE p.id::text = n.reference_id
  );

DELETE FROM public.activity_logs a
WHERE a.entity_type = 'payment'
  AND a.description ILIKE '%$0.00%'
  AND NOT EXISTS (
    SELECT 1 FROM public.payments p WHERE p.id::text = a.entity_id
  );

-- 7. REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
