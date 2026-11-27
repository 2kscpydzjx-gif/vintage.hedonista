/* Turn enabled off after the promotion to restore the single-slide homepage.
   image/mobileImage hold the desktop and mobile campaign banner URLs.
   An empty image reuses the homepage's current published photo. */
window.VH_HOME_CAMPAIGN = Object.freeze({
  enabled: true,
  autoSlideMs: 7000,
  image: 'assets/campaigns/black-friday-desktop.png',
  desktopImageFit: 'contain',
  mobileImage: 'https://yffwjgwwkapdrpwyjwfp.supabase.co/storage/v1/object/public/vintage-media/products/402ea35e-bd3e-42a9-a6bf-70975cf630f5-1795717592177-8-10aee648-a073-4971-8842-82b324856b48.webp',
  imagePosition: 'center top',
  // Percent padding already present in these product uploads; omit for unpadded banners.
  mobileImageFrame: {top:6.416667,bottom:6.416667},
  eyebrow: 'VINTAZHKA · BLACK FRIDAY',
  title: 'ЧОРНА\nП’ЯТНИЦЯ',
  discount: 'ЗНИЖКИ ДО -20%',
  description: 'Вінтаж із характером. Ціни, яких ви чекали.',
  detail: 'Унікальні знахідки в єдиному екземплярі.',
  buttonText: 'ВІДКРИТИ РОЗПРОДАЖ →',
  // Independent popup switch. Change id for a new campaign, not for a text edit.
  popup: {
    enabled: true,
    id: 'black-friday-2026',
    delayMs: 5000,
    // Shared seven-day deadline in Kyiv time; null hides the countdown.
    countdownEndsAt: '2026-12-04T08:43:34+02:00',
    image: 'assets/campaigns/black-friday-popup.jpg',
    imagePosition: '58% center',
    title: 'BLACK\nFRIDAY',
    description: 'ЗНИЖКИ ДО -20%',
    buttonText: 'ПЕРЕГЛЯНУТИ ЗНИЖКИ'
  }
});
