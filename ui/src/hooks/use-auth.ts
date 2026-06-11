/**
 * useAuth — lightweight auth hook for standalone docs app.
 *
 * Fetches the current user profile via the app's own API endpoint.
 * Returns { user, isLoading }.
 */

import { useQuery } from "@tanstack/react-query";
import { userApi, type UserProfile } from "../api/generated";

export function useAuth() {
  const profileQuery = useQuery({
    queryKey: ["user", "profile"],
    queryFn: (): Promise<UserProfile> => userApi.getProfile.fetch(),
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  return {
    user: profileQuery.data ?? null,
    isLoading: profileQuery.isLoading,
  };
}
