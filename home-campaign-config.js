/* Turn enabled off after the promotion to restore the single-slide homepage.
   image/mobileImage hold the desktop and mobile campaign banner URLs.
   An empty image reuses the homepage's current published photo. */
window.VH_HOME_CAMPAIGN = Object.freeze({
  enabled: true,
  image: 'https://yffwjgwwkapdrpwyjwfp.supabase.co/storage/v1/object/public/vintage-media/products/402ea35e-bd3e-42a9-a6bf-70975cf630f5-1795717591010-7-68a1c3ef-3219-4cb9-8f80-14ffe60b1a09.webp',
  mobileImage: 'https://yffwjgwwkapdrpwyjwfp.supabase.co/storage/v1/object/public/vintage-media/products/402ea35e-bd3e-42a9-a6bf-70975cf630f5-1795717592177-8-10aee648-a073-4971-8842-82b324856b48.webp',
  imagePosition: 'center top',
  // Percent padding already present in these product uploads; omit for unpadded banners.
  imageFrame: {top:21.916667,bottom:21.833333},
  mobileImageFrame: {top:6.416667,bottom:6.416667},
  eyebrow: 'VINTAZHKA · BLACK FRIDAY',
  title: 'ЧОРНА\nП’ЯТНИЦЯ',
  description: 'Обирай вінтажні речі зі знижками.',
  buttonText: 'ПЕРЕГЛЯНУТИ ЗНИЖКИ',
  // Independent popup switch. Change id for a new campaign, not for a text edit.
  popup: {
    enabled: true,
    id: 'black-friday-2026',
    delayMs: 5000,
    image: 'https://yffwjgwwkapdrpwyjwfp.supabase.co/storage/v1/object/public/vintage-media/products/402ea35e-bd3e-42a9-a6bf-70975cf630f5-1795717592177-8-10aee648-a073-4971-8842-82b324856b48.webp',
    mobileImage: '',
    imageFrame: {top:6.416667,bottom:6.416667}
  }
});
