# Authentication handoff

The account UI consumes `useAuth()`. `AuthProvider` delegates credentials, session restoration/persistence and challenges to `authService`, currently backed by `mockAuthService`. There is no user/role switching operation in the public auth context.

The existing `User` contract supplies identity, `tenantId`, `roleId` and read-only `roleName`, `branchIds`, and `defaultBranchId`. PermissionProvider resolves permissions through the tenant-scoped role service; role names never grant access. TenantProvider pins the company to the authenticated account, and BranchProvider resolves only permitted branches.

For backend integration, replace the adapter in `authService.ts`. Restore the authenticated account asynchronously, map its account/branch grants to the existing User contract, and replace roleService/tenant/branch mock services with their API equivalents. If the backend returns multiple roles or effective permissions, extend those contracts and PermissionProvider together. Keep platform and tenant permissions separate.

The adapter must return a fully authenticated account only after the backend verifies all required challenges. Replace the current mock challenge methods and identity-only browser session storage with the agreed backend session mechanism. No tokens, APIs, or production security are implemented by this cleanup.

Logout clears the session and query cache, invalidates pending auth responses, and remounts account-bound providers to discard branch, permission and sync UI state. Durable business records and the offline sync queue remain intact. A backend adapter must also revoke the server session before completing logout, including handling revocation failures.

Mock users and credentials remain inside the service layer. CRM assignment controls use the existing tenant-scoped user-options service. Development login hints and the sidebar environment label are hidden in production builds. A real profile update endpoint is not implemented; My Profile is read-only.
