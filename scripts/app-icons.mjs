const iconVersion='1';
const browserIconVersion='2';

export function renderAppIcons(html,file=''){
 const admin=file.startsWith('admin/'),root=admin?'../':'',name=admin?'Vintazhka Admin':'Vintazhka';
 const tags=[
  `<link rel="icon" href="${root}favicon.ico?v=${browserIconVersion}" sizes="16x16 32x32 48x48">`,
  `<link rel="icon" type="image/png" sizes="32x32" href="${root}assets/icons/favicon-32.png?v=${browserIconVersion}">`,
  `<link rel="icon" type="image/png" sizes="16x16" href="${root}assets/icons/favicon-16.png?v=${browserIconVersion}">`,
  `<link rel="apple-touch-icon" sizes="180x180" href="${root}assets/icons/apple-touch-icon-180.png?v=${iconVersion}">`,
  `<link rel="manifest" href="site.webmanifest?v=${iconVersion}">`,
  '<meta name="theme-color" content="#0d0c09">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
  `<meta name="apple-mobile-web-app-title" content="${name}">`
 ].join('');
 return html.replace(/<head\b[^>]*>[\s\S]*?<\/head>/i,head=>{
  head=head.replace(/<link\b[^>]*>/gi,tag=>/\brel\s*=\s*["'](?:icon|shortcut icon|apple-touch-icon(?:-precomposed)?|manifest)["']/i.test(tag)?'':tag);
  head=head.replace(/<meta\b[^>]*>/gi,tag=>/\bname\s*=\s*["'](?:theme-color|apple-mobile-web-app-capable|apple-mobile-web-app-status-bar-style|apple-mobile-web-app-title)["']/i.test(tag)?'':tag);
  return head.replace(/<\/head>/i,tags+'</head>');
 });
}
