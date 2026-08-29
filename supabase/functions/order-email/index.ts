import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const esc = (v: unknown) => String(v ?? "")
  .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
  .replaceAll('"',"&quot;").replaceAll("'","&#039;");

const money = (v: unknown) => `${Number(v || 0).toLocaleString("uk-UA")} грн`;

function copy(status:string, order:any) {
  const n = esc(order.order_number || String(order.id).slice(0,8));
  const ttn = esc(order.ttn || "");
  const map:Record<string,{subject:string,title:string,text:string}> = {
    new: {
      subject:`Замовлення #${n} прийнято — Vintage Hedonista`,
      title:"ВАШЕ ЗАМОВЛЕННЯ ПРИЙНЯТО",
      text:"Дякуємо за замовлення. Ми отримали його та найближчим часом опрацюємо."
    },
    confirmed: {
      subject:`Замовлення #${n} підтверджено — Vintage Hedonista`,
      title:"ЗАМОВЛЕННЯ ПІДТВЕРДЖЕНО",
      text:"Ваше замовлення підтверджено та готується до відправлення."
    },
    shipped: {
      subject:`Замовлення #${n} відправлено — Vintage Hedonista`,
      title:"ВАШЕ ЗАМОВЛЕННЯ ВІДПРАВЛЕНО",
      text: ttn ? `Замовлення вже передано перевізнику. ТТН: ${ttn}` : "Замовлення вже передано перевізнику."
    },
    received: {
      subject:`Замовлення #${n} отримано — Vintage Hedonista`,
      title:"ЗАМОВЛЕННЯ ОТРИМАНО",
      text:"Дякуємо, що обрали Vintage Hedonista. Нехай ця річ стане частиною вашої історії."
    },
    cancelled: {
      subject:`Замовлення #${n} скасовано — Vintage Hedonista`,
      title:"ЗАМОВЛЕННЯ СКАСОВАНО",
      text:"Статус вашого замовлення змінено на «Скасовано». Якщо це сталося помилково, зв’яжіться з нами."
    },
  };
  return map[status] || map.new;
}

function emailHtml(order:any) {
  const c=copy(order.status,order);
  const img=order.products?.cover_image
    ? `<img src="${esc(order.products.cover_image)}" alt="" width="132" style="display:block;width:132px;height:156px;object-fit:cover;border:0">`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#eee5d8;color:#17120e;font-family:Arial,sans-serif">
  <table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="background:#eee5d8"><tr><td align="center" style="padding:34px 16px">
  <table width="620" cellspacing="0" cellpadding="0" role="presentation" style="width:100%;max-width:620px;background:#f5ede2;border:1px solid #cdbda9">
    <tr><td style="background:#0d0b09;padding:28px 34px;color:#f3eadf">
      <div style="font-family:Georgia,serif;font-size:24px;letter-spacing:2px">VINTAGE HEDONISTA</div>
      <div style="font-size:9px;letter-spacing:2px;color:#b99062;margin-top:8px">ODESA · UKRAINE</div>
    </td></tr>
    <tr><td style="padding:36px 34px">
      <div style="font-size:10px;letter-spacing:1.5px;color:#9b7046;margin-bottom:12px">ЗАМОВЛЕННЯ #${esc(order.order_number || String(order.id).slice(0,8))}</div>
      <h1 style="font-family:Georgia,serif;font-size:31px;line-height:1.08;font-weight:400;margin:0 0 14px">${c.title}</h1>
      <p style="font-size:14px;line-height:1.7;margin:0 0 28px;color:#463a31">${c.text}</p>
      <table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="border-top:1px solid #cdbda9;border-bottom:1px solid #cdbda9">
        <tr>
          ${img?`<td width="150" valign="top" style="padding:18px 18px 18px 0">${img}</td>`:""}
          <td valign="top" style="padding:20px 0">
            <div style="font-size:9px;letter-spacing:1px;color:#8e755f;margin-bottom:7px">${esc(order.products?.brand || "VINTAGE HEDONISTA")}</div>
            <div style="font-family:Georgia,serif;font-size:19px;line-height:1.3;margin-bottom:10px">${esc(order.product_name || order.products?.name || "Вінтажна річ")}</div>
            <div style="font-size:15px;font-weight:bold">${money(order.amount)}</div>
            ${order.ttn?`<div style="font-size:12px;margin-top:14px"><b>ТТН:</b> ${esc(order.ttn)}</div>`:""}
          </td>
        </tr>
      </table>
      <p style="font-size:13px;line-height:1.7;margin:26px 0 0">З повагою,<br><b>команда Vintage Hedonista</b></p>
    </td></tr>
  </table>
  </td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok",{headers:corsHeaders});
  try {
    const body=await req.json();
    const orderId=body?.order_id;
    if(!orderId) throw new Error("order_id is required");

    const supabaseUrl=Deno.env.get("SUPABASE_URL")!;
    const serviceRole=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey=Deno.env.get("RESEND_API_KEY")!;
    const from=Deno.env.get("ORDER_EMAIL_FROM") || "Vintage Hedonista <onboarding@resend.dev>";

    const admin=createClient(supabaseUrl,serviceRole,{auth:{persistSession:false}});
    const {data:order,error}=await admin.from("orders")
      .select("*,products(name,brand,cover_image)")
      .eq("id",orderId).single();
    if(error) throw error;
    if(!order?.email) return Response.json({ok:true,skipped:true,reason:"no_email"},{headers:corsHeaders});

    const c=copy(order.status,order);
    const res=await fetch("https://api.resend.com/emails",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":`Bearer ${resendKey}`},
      body:JSON.stringify({from,to:[order.email],subject:c.subject,html:emailHtml(order)})
    });
    const data=await res.json();
    if(!res.ok) throw new Error(data?.message || "Email provider error");

    return Response.json({ok:true,id:data?.id},{headers:corsHeaders});
  } catch(e) {
    console.error(e);
    return Response.json({ok:false,error:String(e?.message||e)},{status:500,headers:corsHeaders});
  }
});
