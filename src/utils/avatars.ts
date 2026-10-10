export function getAvatarUrl(factionId: string, opId: string): string | undefined {
  if (factionId === 'warpcoven') {
    const image = opId.startsWith('wc_sorcerer_') ? 'wc_sorcerer' : opId
    return `/assets/images/warpcoven/${image}.webp`
  }
  return `/assets/images/${factionId}/${opId}.jpg`
}
