/**
 * useAuth — lightweight auth hook for standalone docs app.
 *
 * Fetches the current user profile via the app's own API endpoint.
 * Returns { user, isLoading }.
 */

import { useQuery } from "@tanstack/react-query";
import type { UserProfile } from "../api/generated";

export function useAuth() {
  const profileQuery = useQuery({
    queryKey: ["user", "profile"],
    queryFn: (): Promise<UserProfile> =>
      fetch("/api/user/profile", { credentials: "include" })
        .then((r) => r.json())
        .then(
          (json: {
            success: boolean;
            data?: UserProfile;
            error?: string;
          }) => {
            if (!json.success) throw new Error(json.error ?? "Failed");
            return json.data as UserProfile;
          },
        ),
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  return {
    user: profileQuery.data ?? null,
    isLoading: profileQuery.isLoading,
  };
}
