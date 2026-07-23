import { useQuery } from "@tanstack/react-query";

export type Role = "admin" | "teacher" | "parent";

export type AuthMe = {
  role: Role;
  email: string;
  childIds?: string[];
};

// Lightweight module cache so non-React code (e.g. the realtime sync hook)
// can read the current role synchronously. Populated by useAuth().
let cachedRole: Role | null = null;
export function getCachedRole(): Role | null {
  return cachedRole;
}

// The "feed role" collapses admin/teacher into the staff side used for
// comment/like attribution and toast filtering.
export function feedRoleFor(role: Role | null): "parent" | "teacher" {
  return role === "parent" ? "parent" : "teacher";
}

export function useAuth() {
  const { data, isLoading, isFetched } = useQuery<AuthMe | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to check authentication");
      return (await res.json()) as AuthMe;
    },
    staleTime: Infinity,
    retry: false,
  });

  if (data?.role) {
    cachedRole = data.role;
  } else if (isFetched && !data) {
    cachedRole = null;
  }

  return {
    role: data?.role ?? null,
    email: data?.email ?? "",
    childIds: data?.childIds ?? [],
    isLoading,
    isAuthenticated: !!data?.role,
  };
}

// Where each role should land after authentication.
export function roleHome(role: Role | null, childIds: string[] = []): string {
  if (role === "parent") {
    if (childIds.length === 1) return `/school/${childIds[0]}`;
    return "/children";
  }
  return "/home";
}
