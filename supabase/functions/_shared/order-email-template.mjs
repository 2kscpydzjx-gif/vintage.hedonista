const esc=(v)=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const price=(v)=>`${Number(v||0).toLocaleString("uk-UA")} грн`;
const orderNumber=(o)=>o.order_number||String(o.id||"").slice(0,8).toUpperCase();

export function statusContent(order){
  const n=orderNumber(order);
  const map={
    new:{subject:`Замовлення #${n} прийнято — Vintazhka`,eyebrow:"МИ ОТРИМАЛИ ВАШЕ ЗАМОВЛЕННЯ",title:"Ваше замовлення прийнято",text:"Дякуємо за замовлення. Ми вже отримали його та найближчим часом опрацюємо."},
    confirmed:{subject:`Замовлення #${n} підтверджено — Vintazhka`,eyebrow:"СТАТУС ЗАМОВЛЕННЯ ОНОВЛЕНО",title:"Замовлення підтверджено",text:"Ваше замовлення підтверджено. Ми готуємо його до відправлення."},
    shipped:{subject:`Замовлення #${n} відправлено — Vintazhka`,eyebrow:"ВАША РІЧ УЖЕ В ДОРОЗІ",title:"Ваше замовлення відправлено",text:order.ttn?`Замовлення передано перевізнику. Номер ТТН: ${esc(order.ttn)}`:"Замовлення передано перевізнику та вже прямує до вас."},
    received:{subject:`Замовлення #${n} отримано — Vintazhka`,eyebrow:"ДЯКУЄМО, ЩО ОБРАЛИ НАС",title:"Замовлення отримано",text:"Сподіваємось, ця річ стане особливою частиною вашого гардероба. Дякуємо, що обрали Vintazhka."},
    cancelled:{subject:`Замовлення #${n} скасовано — Vintazhka`,eyebrow:"СТАТУС ЗАМОВЛЕННЯ",title:"Замовлення скасовано",text:"Ваше замовлення було скасовано. Якщо це сталося помилково, зв’яжіться з нами."},
  };
  return map[order.status]||map.new;
}

export function emailHtml(order){
  const c=statusContent(order), n=orderNumber(order);
  const name=order.product_name||order.products?.name||"Вінтажна річ";
  const brand=order.products?.brand||"VINTAZHKA";
  const image=order.products?.cover_image?`<td width="160" valign="top" style="padding:20px 20px 20px 0"><img src="${esc(order.products.cover_image)}" width="140" height="165" alt="" style="display:block;width:140px;height:165px;object-fit:cover;border:0"></td>`:"";
  const customer=order.customer_name?`<p style="margin:0 0 10px;font-size:14px;color:#54463a">${esc(order.customer_name)},</p>`:"";
  const ttn=order.ttn?`<div style="margin-top:16px;padding-top:14px;border-top:1px solid #d2c3b1;font-size:12px;line-height:1.5"><span style="color:#8f7864">ТТН</span><br><strong>${esc(order.ttn)}</strong></div>`:"";
  return `<!doctype html><html lang="uk"><body style="margin:0;padding:0;background:#eee5d8;color:#18130f;font-family:Arial,Helvetica,sans-serif"><table width="100%" cellspacing="0" cellpadding="0" role="presentation"><tr><td align="center" style="padding:36px 16px"><table width="620" cellspacing="0" cellpadding="0" role="presentation" style="width:100%;max-width:620px;background:#f4ecdf;border:1px solid #cbbba8"><tr><td style="padding:30px 34px;background:#0c0a08;color:#f4eadf"><div style="font-family:Georgia,'Times New Roman',serif;font-size:25px;letter-spacing:2px">VINTAZHKA</div><div style="margin-top:8px;color:#b68b5d;font-size:9px;letter-spacing:2px">ODESA · UKRAINE</div></td></tr><tr><td style="padding:38px 34px 34px"><div style="margin-bottom:12px;color:#9b7046;font-size:9px;letter-spacing:1.5px">${c.eyebrow}</div><h1 style="margin:0 0 17px;font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1.08;font-weight:400">${c.title}</h1>${customer}<p style="margin:0 0 28px;color:#54463a;font-size:14px;line-height:1.7">${c.text}</p><div style="margin-bottom:10px;color:#92785e;font-size:9px;letter-spacing:1px">ЗАМОВЛЕННЯ #${esc(n)}</div><table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="border-top:1px solid #cbbba8;border-bottom:1px solid #cbbba8"><tr>${image}<td valign="top" style="padding:21px 0"><div style="margin-bottom:7px;color:#91765d;font-size:9px;letter-spacing:1px">${esc(brand)}</div><div style="margin-bottom:11px;font-family:Georgia,'Times New Roman',serif;font-size:19px;line-height:1.3">${esc(name)}</div><div style="font-size:16px;font-weight:bold">${price(order.amount)}</div>${ttn}</td></tr></table><p style="margin:28px 0 0;color:#54463a;font-size:13px;line-height:1.7">З повагою,<br><strong>команда Vintazhka</strong></p></td></tr><tr><td style="padding:18px 34px;background:#e9dfd1;border-top:1px solid #cbbba8;color:#8a7868;font-size:9px;line-height:1.5">Вінтажний одяг з історією, відібраний зі смаком.</td></tr></table></td></tr></table></body></html>`;
}

