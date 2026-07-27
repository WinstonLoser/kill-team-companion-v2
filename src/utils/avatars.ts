export function getAvatarUrl(factionId: string, opId: string): string | undefined {
  // 必须带 BASE_URL：GitHub Pages 部署在 /kill-team-companion-v2/ 子路径下，
  // 写死的 /assets/... 在生产环境会 404。
  return `${import.meta.env.BASE_URL}assets/images/${factionId}/${opId}.jpg`
}
