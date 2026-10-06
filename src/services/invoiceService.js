/**
 * invoiceService.js
 * 
 * BeautyOasisRx Invoice Generation & PDF Utility
 * Generates dynamic, professional invoices from Supabase Order & Payment data.
 */

export function formatInvoiceNumber(orderId) {
  if (!orderId) return 'INV-0001';
  const cleanId = String(orderId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
  return `INV-${cleanId}`;
}

export function formatInvoiceDate(rawDate) {
  if (!rawDate) {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  }
  try {
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return String(rawDate);
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  } catch (_) {
    return String(rawDate);
  }
}

/**
 * Generate and download/print a professional BeautyOasisRx invoice PDF.
 * 
 * @param {Object} order - Supabase order record
 * @param {Object} patient - Supabase patient record
 * @param {Object} payment - Supabase payment record (optional)
 */
export function generateInvoice(order, patient = {}, payment = null) {
  if (!order) {
    console.error('generateInvoice: Order is required');
    return;
  }

  const invoiceNumber = order.invoiceNumber || order.invoice_number || formatInvoiceNumber(order.id);
  const invoiceDate = formatInvoiceDate(order.date || order.created_at);

  const patientName = patient?.name || patient?.full_name || order.clientName || order.client_name || 'Valued Patient';
  const patientEmail = patient?.email || order.clientEmail || order.client_email || '—';
  const patientPhone = patient?.phone || order.clientPhone || order.client_phone || '—';
  const patientAddress = patient?.address || patient?.residential_address || order.shippingAddress || order.shipping_address || 'Clinic Pickup (Allen, TX)';

  // Line items
  const items = Array.isArray(order.items) && order.items.length > 0
    ? order.items.map(item => {
        const qty = Number(item.qty || item.quantity || 1);
        const price = Number(item.price || item.unitPrice || item.unit_price || 0);
        return {
          name: item.name || item.title || item.product_name || 'Bespoke Formulation',
          qty,
          price,
          total: qty * price
        };
      })
    : [
        {
          name: order.productName || order.service_name || 'Clinical Aesthetic Order',
          qty: 1,
          price: Number(order.totalAmount || order.total || order.amount || 0),
          total: Number(order.totalAmount || order.total || order.amount || 0)
        }
      ];

  const itemsCalculatedSum = items.reduce((sum, item) => sum + item.total, 0);
  const subtotal = order.subtotal !== undefined && order.subtotal !== null
    ? Number(order.subtotal)
    : itemsCalculatedSum;

  const hasTax = order.tax !== undefined && order.tax !== null;
  const taxAmount = hasTax ? Number(order.tax) : null;

  const hasDiscount = order.discount !== undefined && order.discount !== null && Number(order.discount) > 0;
  const discountAmount = hasDiscount ? Number(order.discount) : null;

  const grandTotal = order.totalAmount !== undefined && order.totalAmount !== null
    ? Number(order.totalAmount)
    : (order.total !== undefined && order.total !== null ? Number(order.total) : subtotal);

  const paymentStatus = order.paymentStatus || order.payment_status || payment?.status || 'Paid';
  const paymentMethod = order.paymentMethod || order.payment_method || payment?.paymentMethod || payment?.method || 'Card on File';
  const transactionId = payment?.transactionId || payment?.reference || order.transactionId || order.stripe_payment_intent_id || order.id || 'TXN-SETTLED';

  const clinicInfo = {
    name: 'BeautyOasisRx',
    subTitle: 'Clinical Aesthetics & Bespoke Wellness',
    address: '975 Watters Creek Blvd, Suite 240, Allen, TX 75013',
    phone: '(214) 555-0190',
    email: 'concierge@beautyoasisrx.com',
    web: 'beautyoasisrx.com'
  };

  const invoiceHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice - ${invoiceNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Inter:wght@400;500;600;700&display=swap');

    @page {
      size: letter;
      margin: 14mm 16mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #0f2942;
      background: #ffffff;
      line-height: 1.5;
      padding: 24px;
      max-width: 820px;
      margin: 0 auto;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .inv-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #1e5aa8;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }

    .brand-title {
      font-family: 'Cinzel', Georgia, serif;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 1.5px;
      color: #0f2942;
      text-transform: uppercase;
    }

    .brand-accent {
      color: #1e5aa8;
    }

    .brand-tagline {
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .inv-doc-label {
      text-align: right;
    }

    .inv-title {
      font-family: 'Cinzel', Georgia, serif;
      font-size: 26px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #1e5aa8;
      text-transform: uppercase;
    }

    .inv-meta {
      margin-top: 6px;
      font-size: 13px;
      color: #334155;
    }

    .inv-meta-row {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 3px;
    }

    .inv-meta-lbl {
      color: #64748b;
      font-weight: 500;
    }

    .inv-meta-val {
      font-weight: 700;
      color: #0f2942;
      font-family: monospace;
    }

    .inv-parties {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 28px;
    }

    .party-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #1e5aa8;
      margin-bottom: 8px;
    }

    .party-name {
      font-size: 15px;
      font-weight: 700;
      color: #0f2942;
      margin-bottom: 4px;
    }

    .party-detail {
      font-size: 12.5px;
      color: #475569;
      line-height: 1.45;
    }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }

    .items-table th {
      background: #0f2942;
      color: #ffffff;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      padding: 10px 14px;
      text-align: left;
    }

    .items-table th.col-num {
      text-align: right;
    }

    .items-table td {
      padding: 12px 14px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 13px;
      color: #1e293b;
    }

    .items-table td.col-num {
      text-align: right;
    }

    .items-table tr:nth-child(even) td {
      background: #f8fafc;
    }

    .inv-bottom {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 30px;
      margin-top: 10px;
      align-items: flex-start;
    }

    .payment-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 18px;
    }

    .payment-box-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      color: #1e5aa8;
      margin-bottom: 10px;
    }

    .payment-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      margin-bottom: 6px;
      color: #475569;
    }

    .payment-status-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      background: #dcfce7;
      color: #15803d;
    }

    .totals-box {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .totals-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: #475569;
      padding: 3px 0;
    }

    .totals-row.grand-total {
      border-top: 2px solid #0f2942;
      padding-top: 8px;
      margin-top: 4px;
      font-size: 16px;
      font-weight: 700;
      color: #0f2942;
    }

    .totals-row.grand-total .amt {
      color: #15803d;
      font-size: 18px;
    }

    .inv-footer {
      margin-top: 40px;
      padding-top: 18px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 11px;
      color: #64748b;
      line-height: 1.6;
    }

    .print-bar {
      margin-bottom: 20px;
      padding: 12px 18px;
      background: #f1f5f9;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .print-btn {
      background: #1e5aa8;
      color: #ffffff;
      border: none;
      padding: 8px 18px;
      font-size: 13px;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
    }

    .print-btn:hover {
      background: #144484;
    }

    @media print {
      body {
        padding: 0;
      }
      .print-bar {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <span style="font-size: 13px; font-weight: 500; color: #334155;">BeautyOasisRx Official Patient Invoice</span>
    <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  </div>

  <div class="inv-header">
    <div>
      <div class="brand-title">Beauty<span class="brand-accent">Oasis</span>Rx</div>
      <div class="brand-tagline">${clinicInfo.subTitle}</div>
    </div>
    <div class="inv-doc-label">
      <div class="inv-title">Invoice</div>
      <div class="inv-meta">
        <div class="inv-meta-row">
          <span class="inv-meta-lbl">Invoice Number:</span>
          <span class="inv-meta-val">${invoiceNumber}</span>
        </div>
        <div class="inv-meta-row">
          <span class="inv-meta-lbl">Invoice Date:</span>
          <span class="inv-meta-val">${invoiceDate}</span>
        </div>
        <div class="inv-meta-row">
          <span class="inv-meta-lbl">Order Reference:</span>
          <span class="inv-meta-val">#${order.id}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="inv-parties">
    <div>
      <div class="party-title">Patient Information</div>
      <div class="party-name">${patientName}</div>
      <div class="party-detail">Email: ${patientEmail}</div>
      <div class="party-detail">Phone: ${patientPhone}</div>
      <div class="party-detail">Address: ${patientAddress}</div>
    </div>
    <div>
      <div class="party-title">Issuing Provider</div>
      <div class="party-name">${clinicInfo.name}</div>
      <div class="party-detail">${clinicInfo.address}</div>
      <div class="party-detail">Phone: ${clinicInfo.phone}</div>
      <div class="party-detail">Email: ${clinicInfo.email}</div>
    </div>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 50%;">Product / Service</th>
        <th class="col-num" style="width: 15%;">Quantity</th>
        <th class="col-num" style="width: 17%;">Unit Price</th>
        <th class="col-num" style="width: 18%;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${items.map(item => `
        <tr>
          <td><strong>${item.name}</strong></td>
          <td class="col-num">${item.qty}</td>
          <td class="col-num">$${item.price.toFixed(2)}</td>
          <td class="col-num">$${item.total.toFixed(2)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="inv-bottom">
    <div class="payment-box">
      <div class="payment-box-title">Payment & Settlement</div>
      <div class="payment-row">
        <span>Payment Status:</span>
        <span class="payment-status-badge">${paymentStatus}</span>
      </div>
      <div class="payment-row">
        <span>Payment Method:</span>
        <span style="font-weight: 600; color: #0f2942;">${paymentMethod}</span>
      </div>
      <div class="payment-row">
        <span>Transaction ID:</span>
        <span style="font-family: monospace; font-size: 11px; color: #0f2942;">${transactionId}</span>
      </div>
    </div>

    <div class="totals-box">
      <div class="totals-row">
        <span>Subtotal</span>
        <span style="font-weight: 600; color: #0f2942;">$${subtotal.toFixed(2)}</span>
      </div>
      ${hasTax ? `
        <div class="totals-row">
          <span>Tax</span>
          <span style="font-weight: 600; color: #0f2942;">$${taxAmount.toFixed(2)}</span>
        </div>
      ` : ''}
      ${hasDiscount ? `
        <div class="totals-row" style="color: #15803d;">
          <span>Discount</span>
          <span style="font-weight: 600;">-$${discountAmount.toFixed(2)}</span>
        </div>
      ` : ''}
      <div class="totals-row grand-total">
        <span>Grand Total</span>
        <span class="amt">$${grandTotal.toFixed(2)} USD</span>
      </div>
    </div>
  </div>

  <div class="inv-footer">
    <p><strong>BeautyOasisRx — Bespoke Medical Aesthetics & Wellness</strong></p>
    <p>${clinicInfo.address} • Phone: ${clinicInfo.phone} • Email: ${clinicInfo.email}</p>
    <p style="margin-top: 4px; font-size: 10px; color: #94a3b8;">
      Thank you for trusting BeautyOasisRx with your aesthetic and clinical care.
    </p>
  </div>

  <script>
    window.addEventListener('load', () => {
      // Small timeout to allow styles/fonts to paint
      setTimeout(() => {
        window.print();
      }, 350);
    });
  </script>
</body>
</html>
  `;

  // Open invoice in dedicated printable popup window
  const printWindow = window.open('', '_blank', 'width=880,height=900,menubar=no,toolbar=no,location=no,status=no');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(invoiceHtml);
    printWindow.document.close();
  } else {
    // If popup was blocked, fallback to hidden iframe print
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    iframe.contentDocument.open();
    iframe.contentDocument.write(invoiceHtml);
    iframe.contentDocument.close();
    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 500);
  }
}
