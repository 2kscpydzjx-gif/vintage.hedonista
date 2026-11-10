export const privacyUrl='privacy.html';
export const privacyLink='<a data-vh-privacy-link href="'+privacyUrl+'">Політика конфіденційності</a>';
export function renderStorefrontFooter(html,file=''){
 if(file.startsWith('admin/'))return html;
 html=html.replace(/<footer\b([^>]*)>([\s\S]*?)<\/footer>/i,(all,attrs,content)=>{
  if(!/site-footer-v64/.test(attrs))return all;
  let copyright='';content=content.replace(/<div class="footer-v64-copy">([\s\S]*?)<\/div>/,(_,text)=>{copyright=text;return ''});
  // Replace only our generated rows; preserve the published masthead and CMS slots.
  content=content.replace(/<nav\b[^>]*data-vh-footer-navigation[^>]*>[\s\S]*?<\/nav>/,'').replace(/<div class="wrap vh-footer-bottom">[\s\S]*$/,'');
  return '<footer'+attrs+'>'+content.replace(/[ \t]+(?=\r?\n)/g,'').trimEnd()+`
   <nav class="wrap vh-footer-navigation" data-vh-footer-navigation aria-label="Посилання у футері">
    <div><h2>Магазин</h2><a href="catalog.html">Каталог</a><a href="capsule.html">Стильові капсули</a><a href="about.html">Про нас</a><a href="journal.html">Vintazhka Journal</a></div>
    <div><h2>Покупцеві</h2><a href="delivery.html">Доставка і оплата</a><a href="account.html" data-vh-footer-account>Особистий кабінет</a><a href="contacts.html">Контакти</a>${privacyLink}</div>
    <div><h2>Будьмо на зв’язку</h2><p>Маєте запитання про річ або замовлення?</p><a href="contacts.html">Зв’язатися з нами →</a></div>
   </nav>
   <div class="wrap vh-footer-bottom"><div class="footer-v64-copy">${copyright}</div><div class="vh-footer-legal"><button type="button" class="vh-analytics-settings" data-vh-analytics-settings hidden>Налаштування cookie</button></div></div>
  </footer>`;
 });
 if(!/href="storefront-details\.css/.test(html))html=html.replace(/<\/head>/i,'<link rel="stylesheet" href="storefront-details.css?v=1"></head>');
 html=html.replace(/href="storefront-details\.css(?:\?[^"]*)?"/g,'href="storefront-details.css?v=4"');
 if(!/name="vh-privacy-policy"/.test(html))html=html.replace(/<\/head>/i,'<meta name="vh-privacy-policy" content="'+privacyUrl+'"></head>');
 html=html.replace(/(<meta name="vh-privacy-policy" content=")[^"]*(")/g,'$1'+privacyUrl+'$2');
 html=html.replace(/<a\b[^>]*data-vh-privacy-link[^>]*>[\s\S]*?<\/a>/g,privacyLink);
 if(file==='checkout.html'&&!/class="vh-privacy-note"/.test(html))html=html.replace(/(<form\b[^>]*id="checkoutForm"[^>]*>[\s\S]*?)(<\/form>)/i,'$1<p class="vh-privacy-note">Про обробку персональних даних: '+privacyLink+'</p>$2');
 // Keep the checkout form intact while the buyer reads the policy.
 html=html.replace(/<p class="vh-privacy-note">[\s\S]*?<\/p>/g,note=>note.replace(privacyLink,privacyLink.replace('<a ','<a target="_blank" rel="noopener" ')));
 return html;
}
