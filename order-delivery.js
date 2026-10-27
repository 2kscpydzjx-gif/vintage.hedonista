/* Keep delivery data in the existing checkout RPC's comment argument until the
   database exposes dedicated delivery arguments. Both clients use this codec;
   no post-order update or change to reservation/pricing transactions is needed. */
(()=>{'use strict';
 const line=value=>String(value||'').replace(/\s+/g,' ').trim();
 function encode(city,address,comment){
  return 'Доставка Новою поштою:\nМісто: '+line(city)+'\nВідділення: '+line(address)+(comment?'\n\nКоментар:\n'+comment:'');
 }
 function read(order){
  const match=String(order.comment||'').match(/^Доставка Новою поштою:\nМісто: ([^\r\n]+)\nВідділення: ([^\r\n]+)(?:\n\nКоментар:\n([\s\S]*))?$/);
  if(!match)return order;
  return {...order,city:order.city||match[1],delivery_address:order.delivery_address||match[2],comment:match[3]||null};
 }
 window.VHOrderDelivery={encode,read};
})();
