addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// load secrets
const MERCHANT_ID = globalThis.MERCHANT_ID;
const SECRET_KEY = globalThis.SECRET_KEY;

async function handleRequest(request) {
  const url = new URL(request.url);

  if (url.pathname === "/") {
    return new Response(
      `✅ WebXPay backend running\nMerchant ID Loaded: ${MERCHANT_ID ? "✔" : "❌"}`,
      { headers: corsHeaders }
    );
  }

  return new Response("Not found", { status: 404, headers: corsHeaders });
}

// WebXPay LIVE Public Key
const WEBXPAY_PUBLIC_KEY = `
-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDla3BZjh19LvuG+qYOF3gpcqCM
swXfkkNJ2zwxyenNn5hGgfN0cu3dXl9jg0gkUM/p9tNCQ6k9ULLm33SGi8Vo15k4
WI2uT9R0sBbV/U4Z3qB8RiTN0mG3qfBnl088iS3SIUcAWb+Y9SnW8N3PUTZTss13
sZx1THY1BzCnnBdHPwIDAQAB
-----END PUBLIC KEY-----
`;

// Helper: encrypt order_id|amount
function encryptPayment(plain) {
  // Workers do not support Node crypto directly
  // So you will need to implement WebCrypto equivalent
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  // NOTE: For live deployment, you need to handle RSA encryption properly
  return btoa(String.fromCharCode(...data)); // temporary base64 placeholder
}

async function handleRequest(request) {
  const url = new URL(request.url);

  // Handle OPTIONS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check
  if (url.pathname === "/") {
    return new Response("✅ WebXPay LIVE backend running", {
      headers: corsHeaders,
    });
  }

  // Create payment
  if (url.pathname === "/create-payment" && request.method === "POST") {
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

    const encrypted = encryptPayment(`${order_id}|${amount}`);
    const html = `
<!DOCTYPE html>
<html>
  <body onload="document.forms[0].submit()">
    <form action="https://www.webxpay.com/index.php?route=checkout/billing" method="POST">
      <input type="hidden" name="merchant_id" value="${MERCHANT_ID}">
      <input type="hidden" name="payment" value="${encrypted}">
      <input type="hidden" name="secret_key" value="${SECRET_KEY}">
      <input type="hidden" name="enc_method" value="JCs3J+6oSz4V0LgE0zi/Bg==">
      <input type="hidden" name="first_name" value="${first_name}">
      <input type="hidden" name="last_name" value="${last_name}">
      <input type="hidden" name="email" value="${email}">
      <input type="hidden" name="contact_number" value="${contact_number}">
      <input type="hidden" name="address_line_one" value="${address_line_one}">
      <input type="hidden" name="process_currency" value="${currency}">
      <input type="hidden" name="return_url" value="https://webxpay-worker.YOUR_ACCOUNT.workers.dev/payment-success">
    </form>
  </body>
</html>
`;
    return new Response(html, { headers: { ...corsHeaders, "Content-Type": "text/html" } });
  }

  // Payment callback
  if (url.pathname === "/payment-success") {
    const data = request.method === "POST" ? await request.json() : Object.fromEntries(url.searchParams.entries());

    const order_id = data.order_id || "UNKNOWN";
    const amount = data.amount || "0";
    const txn_id = data.transaction_id || data.order_reference_number || order_id;
    const status = data.status || "SUCCESS";

    const methodMap = {
      "1": "Sampath Bank",
      "2": "EzCash",
      "3": "Mcash",
      "4": "Amex",
      "5": "Sampath Vishwa",
    };
    const method = methodMap[data.payment_gateway_id] || "WebXPay";

    const date = data.date_time_transaction || new Date().toLocaleString();

    const redirectUrl = `https://www.redtrex.store/payment-success?order_id=${encodeURIComponent(
      txn_id
    )}&amount=${encodeURIComponent(amount)}&status=${encodeURIComponent(status)}&method=${encodeURIComponent(method)}&date=${encodeURIComponent(date)}`;

    return Response.redirect(redirectUrl, 302);
  }

  return new Response("Not found", { status: 404, headers: corsHeaders });
}
