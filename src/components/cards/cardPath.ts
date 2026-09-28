/** Route of a credit card's page. */
export function cardPagePath(account: string): string {
  return `/cards/${encodeURIComponent(account)}`
}
