/* Turn enabled off after the promotion to restore the single-slide homepage.
   Replace image/mobileImage with the final banner URLs when they are ready.
   An empty image reuses the homepage's current published photo. */
window.VH_HOME_CAMPAIGN = Object.freeze({
  enabled: true,
  image: '',
  mobileImage: '',
  imagePosition: 'center',
  eyebrow: 'VINTAZHKA · BLACK FRIDAY',
  title: 'ЧОРНА\nП’ЯТНИЦЯ',
  description: 'Обирай вінтажні речі зі знижками.',
  buttonText: 'ПЕРЕГЛЯНУТИ ЗНИЖКИ',
  // Independent popup switch. Change id for a new campaign, not for a text edit.
  popup: {
    enabled: true,
    id: 'black-friday-2026',
    delayMs: 5000,
    image: '',
    mobileImage: ''
  }
});
