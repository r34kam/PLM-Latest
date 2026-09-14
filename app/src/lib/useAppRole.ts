import { useGetApiUserContext } from '@unifyapps/app-builder-sdk/hooks/user'

/* ------------------------------------------------------------------ *
 * Platform-level role names — must match exactly what is configured   *
 * in the platform's Roles settings for this app.                      *
 * ------------------------------------------------------------------ */
export const ROLE_DC = 'Document Controller'
export const ROLE_APPROVER = 'Approver'

export type AppRole = 'dc' | 'approver' | 'unknown'

/** Read the signed-in user's platform roles and return a typed role. */
export function useAppRole(): {
  role: AppRole
  isLoading: boolean
  userName: string
  userEmail: string
} {
  const { data, isPending } = useGetApiUserContext(
    { includeRoles: true },
    {
      query: {
        staleTime: 0,
        refetchOnMount: true,
        refetchOnWindowFocus: true,
      },
    },
  )

  const roles: string[] = (data?.user?.roles ?? []).map((r: any) => r.name as string)

  const role: AppRole = roles.includes(ROLE_DC)
    ? 'dc'
    : roles.includes(ROLE_APPROVER)
    ? 'approver'
    : 'unknown'

  const userName: string =
    data?.user?.name ?? data?.user?.username ?? ''
  const userEmail: string = data?.user?.email ?? data?.user?.username ?? ''

  return { role, isLoading: isPending, userName, userEmail }
}
