export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ---------------------------
    // Health check
    // ---------------------------
    if (request.method === "GET" && url.pathname === "/") {
      return new Response("✅ WebXPay LIVE backend running (Cloudflare)", {
        headers: corsHeaders(),
      });
    }

    // ---------------------------
    // Create payment
    // ---------------------------
    if (request.method === "POST" && url.pathname === "/create-payment") {
      const data = await request.json();

      const {
        order_id,
        amount,
        currency = "LKR",
        first_name = "",
        last_name = "",
        email = "",
        contact_number = "",
        address_line_one = "",
      } = data;

      if (!order_id || !amount) {
        return new Response("Missing order_id or amount", { status: 400 });
      }

      const encrypted = await encryptPayment(
        `${order_id}|${amount}`,
        WEBXPAY_PUBLIC_KEY
      );

      const html = `<!DOCTYPE html>
<html>
<body onload="document.forms[0].submit()">
<form action="https://www.webxpay.com/index.php?route=checkout/billing" method="POST">
  <input type="hidden" name="merchant_id" value="${env.MERCHANT_ID}">
  <input type="hidden" name="payment" value="${encrypted}">
  <input type="hidden" name="secret_key" value="${env.SECRET_KEY}">
  <input type="hidden" name="enc_method" value="JCs3J+6oSz4V0LgE0zi/Bg==">

  <input type="hidden" name="first_name" value="${first_name}">
  <input type="hidden" name="last_name" value="${last_name}">
  <input type="hidden" name="email" value="${email}">
  <input type="hidden" name="contact_number" value="${contact_number}">
  <input type="hidden" name="address_line_one" value="${address_line_one}">
  <input type="hidden" name="process_currency" value="${currency}">

  <input type="hidden" name="return_url" value="https://your-worker-domain.workers.dev/payment-success">
</form>
</body>
</html>`;

      return new Response(html, {
        headers: {
          "Content-Type": "text/html",
          ...corsHeaders(),
        },
      });
    }

    // ---------------------------
    // Payment success / callback
    // ---------------------------
    if (url.pathname === "/payment-success") {
      let data = {};

      if (request.method === "POST") {
        const form = await request.formData();
        form.forEach((v, k) => (data[k] = v));
      } else {
        url.searchParams.forEach((v, k) => (data[k] = v));
      }

      const order_id = data.order_id || "UNKNOWN";
      const amount = data.amount || "0";
      const txn_id =
        data.transaction_id ||
        data.order_reference_number ||
        order_id;

      const status = data.status || "SUCCESS";

      const methodMap = {
        "1": "Sampath Bank",
        "2": "EzCash",
        "3": "Mcash",
        "4": "Amex",
        "5": "Sampath Vishwa",
      };

      const method =
        methodMap[data.payment_gateway_id] || "WebXPay";

      const date =
        data.date_time_transaction || new Date().toLocaleString();

      const redirectUrl = `https://www.redtrex.store/payment-success?order_id=${encodeURIComponent(
        txn_id
      )}&amount=${encodeURIComponent(amount)}&status=${encodeURIComponent(
        status
      )}&method=${encodeURIComponent(method)}&date=${encodeURIComponent(date)}`;

      return Response.redirect(redirectUrl, 302);
    }

    return new Response("Not Found", { status: 404 });
  },
};
