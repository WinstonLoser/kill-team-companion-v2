export function getAvatarUrl(factionId: string, opId: string): string | undefined {
  return `/assets/images/${factionId}/${opId}.jpg`
}
