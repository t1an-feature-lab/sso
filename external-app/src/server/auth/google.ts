export function getGoogleAuthorizationUrl(
  redirectUri: string,
  state: string
): string {
  return ''
}

export async function getGoogleIdentity(
  code: string,
  redirectUri: string,
  iss: string | null
) {
  return {
    providerUserId: 'string',
    username: ' user.name || user.login',
    avatarUrl: ' user.avatar_url˝'
  }
}
