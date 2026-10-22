import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/core/permissions/components";
import { lazyPage } from "./lazyPage";

const SyncQueuePage = lazyPage(() =>
  import("@/features/sync/pages/SyncQueuePage").then((module) => ({
    default: module.SyncQueuePage,
  })),
);

export const syncRoutes: RouteObject[] = [
  {
    path: "sync",
    element: (
      <RequirePermission permission="sync.view">
        <SyncQueuePage />
      </RequirePermission>
    ),
  },
];
