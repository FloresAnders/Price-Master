import { useEffect, useState } from "react";
import type { User } from "../../../../types/firestore";
import { UsersService } from "../../../../services/users";

interface UseSuperAdminUsersResult {
  superAdminUsers: User[];
  superAdminUsersLoading: boolean;
}

export function useSuperAdminUsers(
  isSuperAdminUser: boolean,
  shouldLoadUsers: boolean,
): UseSuperAdminUsersResult {
  const [superAdminUsers, setSuperAdminUsers] = useState<User[]>([]);
  const [superAdminUsersLoading, setSuperAdminUsersLoading] = useState(false);

  useEffect(() => {
    let isActive = true;

    if (!isSuperAdminUser || !shouldLoadUsers) {
      setSuperAdminUsers([]);
      setSuperAdminUsersLoading(false);
      return () => {
        isActive = false;
      };
    }

    setSuperAdminUsersLoading(true);
    UsersService.getUsersOrderedByName()
      .then((users) => {
        if (!isActive) return;
        setSuperAdminUsers(Array.isArray(users) ? users : []);
      })
      .catch((err) => {
        console.error(
          "Error loading users for superadmin manager selector:",
          err,
        );
        if (!isActive) return;
        setSuperAdminUsers([]);
      })
      .finally(() => {
        if (isActive) setSuperAdminUsersLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [isSuperAdminUser, shouldLoadUsers]);

  return { superAdminUsers, superAdminUsersLoading };
}
