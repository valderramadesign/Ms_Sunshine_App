import { useQuery } from "@tanstack/react-query";

export function useSchoolLogo(): string {
  const { data } = useQuery<{ logoUrl: string }>({
    queryKey: ["/api/admin/logo"],
    staleTime: 60_000,
  });
  return data?.logoUrl || "/figmaAssets/demo-logo.png";
}
