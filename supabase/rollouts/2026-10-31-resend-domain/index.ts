import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const TEST_MODE = Deno.env.get("TEST_MODE") === "true";
const TEST_EMAIL = Deno.env.get("TEST_EMAIL") || "";
const ORDER_EMAIL_FROM = Deno.env.get("ORDER_EMAIL_FROM") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function esc(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function price(value: unknown) {
  return `${Number(value || 0).toLocaleString("uk-UA")} грн`;
}

function orderNumber(order: any) {
  return (
    order.order_number ||
    String(order.id || "").slice(0, 8).toUpperCase()
  );
}

function statusContent(order: any) {
  const number = orderNumber(order);

  const map: Record<
    string,
    {
      subject: string;
      eyebrow: string;
      title: string;
      text: string;
    }
  > = {
    new: {
      subject: `Замовлення #${number} прийнято — Vintage Hedonista`,
      eyebrow: "МИ ОТРИМАЛИ ВАШЕ ЗАМОВЛЕННЯ",
      title: "Ваше замовлення прийнято",
      text:
        "Дякуємо за замовлення. Ми вже отримали його та найближчим часом опрацюємо.",
    },

    confirmed: {
      subject: `Замовлення #${number} підтверджено — Vintage Hedonista`,
      eyebrow: "СТАТУС ЗАМОВЛЕННЯ ОНОВЛЕНО",
      title: "Замовлення підтверджено",
      text:
        "Ваше замовлення підтверджено. Ми готуємо його до відправлення.",
    },

    shipped: {
      subject: `Замовлення #${number} відправлено — Vintage Hedonista`,
      eyebrow: "ВАША РІЧ УЖЕ В ДОРОЗІ",
      title: "Ваше замовлення відправлено",
      text: order.ttn
        ? `Замовлення передано перевізнику. Номер ТТН: ${esc(order.ttn)}`
        : "Замовлення передано перевізнику та вже прямує до вас.",
    },

    received: {
      subject: `Замовлення #${number} отримано — Vintage Hedonista`,
      eyebrow: "ДЯКУЄМО, ЩО ОБРАЛИ НАС",
      title: "Замовлення отримано",
      text:
        "Сподіваємось, ця річ стане особливою частиною вашого гардероба. Дякуємо, що обрали Vintage Hedonista.",
    },

    cancelled: {
      subject: `Замовлення #${number} скасовано — Vintage Hedonista`,
      eyebrow: "СТАТУС ЗАМОВЛЕННЯ",
      title: "Замовлення скасовано",
      text:
        "Ваше замовлення було скасовано. Якщо це сталося помилково, зв’яжіться з нами.",
    },
  };

  return map[order.status] || map.new;
}

function emailHtml(order: any) {
  const content = statusContent(order);

  const number = orderNumber(order);

  const productName =
    order.product_name ||
    order.products?.name ||
    "Вінтажна річ";

  const brand =
    order.products?.brand ||
    "VINTAGE HEDONISTA";

  const productImage = order.products?.cover_image
    ? `
      <td width="160" valign="top" style="padding:20px 20px 20px 0">
        <img
          src="${esc(order.products.cover_image)}"
          width="140"
          height="165"
          alt=""
          style="
            display:block;
            width:140px;
            height:165px;
            object-fit:cover;
            border:0;
          "
        >
      </td>
    `
    : "";

  const customerName = order.customer_name
    ? `
      <p style="
        margin:0 0 10px;
        font-size:14px;
        color:#54463a;
      ">
        ${esc(order.customer_name)},
      </p>
    `
    : "";

  const ttn = order.ttn
    ? `
      <div style="
        margin-top:16px;
        padding-top:14px;
        border-top:1px solid #d2c3b1;
        font-size:12px;
        line-height:1.5;
      ">
        <span style="color:#8f7864;">ТТН</span><br>
        <strong>${esc(order.ttn)}</strong>
      </div>
    `
    : "";

  return `
<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
</head>

<body style="
  margin:0;
  padding:0;
  background:#eee5d8;
  color:#18130f;
  font-family:Arial,Helvetica,sans-serif;
">

<table width="100%" cellspacing="0" cellpadding="0" role="presentation">
<tr>
<td align="center" style="padding:36px 16px">

<table
  width="620"
  cellspacing="0"
  cellpadding="0"
  role="presentation"
  style="
    width:100%;
    max-width:620px;
    background:#f4ecdf;
    border:1px solid #cbbba8;
  "
>

<tr>
<td style="
  padding:30px 34px;
  background:#0c0a08;
  color:#f4eadf;
">
  <div style="
    font-family:Georgia,'Times New Roman',serif;
    font-size:25px;
    letter-spacing:2px;
  ">
    VINTAGE HEDONISTA
  </div>

  <div style="
    margin-top:8px;
    color:#b68b5d;
    font-size:9px;
    letter-spacing:2px;
  ">
    ODESA · UKRAINE
  </div>
</td>
</tr>

<tr>
<td style="padding:38px 34px 34px">

  <div style="
    margin-bottom:12px;
    color:#9b7046;
    font-size:9px;
    letter-spacing:1.5px;
  ">
    ${content.eyebrow}
  </div>

  <h1 style="
    margin:0 0 17px;
    font-family:Georgia,'Times New Roman',serif;
    font-size:32px;
    line-height:1.08;
    font-weight:400;
  ">
    ${content.title}
  </h1>

  ${customerName}

  <p style="
    margin:0 0 28px;
    color:#54463a;
    font-size:14px;
    line-height:1.7;
  ">
    ${content.text}
  </p>

  <div style="
    margin-bottom:10px;
    color:#92785e;
    font-size:9px;
    letter-spacing:1px;
  ">
    ЗАМОВЛЕННЯ #${esc(number)}
  </div>

  <table
    width="100%"
    cellspacing="0"
    cellpadding="0"
    role="presentation"
    style="
      border-top:1px solid #cbbba8;
      border-bottom:1px solid #cbbba8;
    "
  >
    <tr>

      ${productImage}

      <td valign="top" style="padding:21px 0">

        <div style="
          margin-bottom:7px;
          color:#91765d;
          font-size:9px;
          letter-spacing:1px;
        ">
          ${esc(brand)}
        </div>

        <div style="
          margin-bottom:11px;
          font-family:Georgia,'Times New Roman',serif;
          font-size:19px;
          line-height:1.3;
        ">
          ${esc(productName)}
        </div>

        <div style="
          font-size:16px;
          font-weight:bold;
        ">
          ${price(order.amount)}
        </div>

        ${ttn}

      </td>
    </tr>
  </table>

  <p style="
    margin:28px 0 0;
    color:#54463a;
    font-size:13px;
    line-height:1.7;
  ">
    З повагою,<br>
    <strong>команда Vintage Hedonista</strong>
  </p>

</td>
</tr>

<tr>
<td style="
  padding:18px 34px;
  background:#e9dfd1;
  border-top:1px solid #cbbba8;
  color:#8a7868;
  font-size:9px;
  line-height:1.5;
">
  Вінтажний одяг з історією, відібраний зі смаком.
</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>
`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json();
    const orderId = body?.order_id;

    if (!orderId) {
      throw new Error("order_id is required");
    }

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL")!;

    const serviceRole =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(
      supabaseUrl,
      serviceRole,
      {
        auth: {
          persistSession: false,
        },
      },
    );

    const { data: order, error } = await supabase
      .from("orders")
      .select(`
        *,
        products (
          name,
          brand,
          cover_image
        )
      `)
      .eq("id", orderId)
      .single();

    if (error) {
      throw new Error(
        `Order query error: ${error.message}`
      );
    }

    if (!order) {
      throw new Error("Order not found");
    }

    if (!order.email) {
      return new Response(
        JSON.stringify({
          ok: true,
          skipped: true,
          reason: "no_email",
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    let recipient = order.email;

    if (TEST_MODE) {
      if (!TEST_EMAIL) {
        throw new Error(
          "TEST_MODE enabled but TEST_EMAIL is missing"
        );
      }

      recipient = TEST_EMAIL;
    }

    const from = ORDER_EMAIL_FROM || (TEST_MODE ? "Vintage Hedonista <onboarding@resend.dev>" : "");
    const fromAddress = from.match(/<([^<>]+)>$/)?.[1] || from;
    if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(fromAddress) || /[\r\n]/.test(from) || (!TEST_MODE && /onboarding@resend\.dev/i.test(from))) {
      throw new Error("ORDER_EMAIL_FROM is missing or invalid");
    }

    const content = statusContent(order);

    const resendResponse = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization:
            `Bearer ${RESEND_API_KEY}`,
        },

        body: JSON.stringify({
          from,

          to: [recipient],

          subject:
            TEST_MODE
              ? `[TEST] ${content.subject}`
              : content.subject,

          html: emailHtml(order),
        }),
      },
    );

    const resendData =
      await resendResponse.json();

    if (!resendResponse.ok) {
      throw new Error(
        resendData?.message ||
          JSON.stringify(resendData),
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        email_id: resendData?.id,

        test_mode: TEST_MODE,

        original_recipient:
          TEST_MODE
            ? order.email
            : undefined,

        sent_to: recipient,

        status: order.status,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      },
    );
  } catch (error) {
    console.error(error);

    return new Response(
      JSON.stringify({
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : JSON.stringify(error),
      }),
      {
        status: 500,

        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      },
    );
  }
});
