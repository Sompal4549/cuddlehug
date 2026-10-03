"use client";

import * as React from "react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import type { AuditLog } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { Panel } from "@/components/admin/panels";

const ENTITIES = ["", "ORDER", "PRODUCT", "CATEGORY", "COUPON", "USER", "REVIEW", "INVENTORY", "SETTINGS"];

export default function AuditLogsPage() {
  const [logs, setLogs] = React.useState<AuditLog[] | null>(null);
  const [meta, setMeta] = React.useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = React.useState(1);
  const [entity, setEntity] = React.useState("");

  React.useEffect(() => {
    setLogs(null);
    api
      .getFull<{ items: AuditLog[] }>("/admin/audit-logs", {
        query: { page, limit: 30, entity: entity || undefined },
      })
      .then(({ data, meta: pageMeta }) => {
        setLogs(data.items);
        setMeta({
          page: Number(pageMeta?.page ?? 1),
          totalPages: Number(pageMeta?.totalPages ?? 1),
          total: Number(pageMeta?.total ?? 0),
        });
      })
      .catch((error: unknown) => {
        setLogs([]);
        toast.error(errorMessage(error));
      });
  }, [page, entity]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Audit log</h1>
          <p className="text-sm text-muted-foreground">{meta.total} recorded actions</p>
        </div>
        <div className="w-52">
          <Select
            value={entity}
            onChange={(event) => {
              setPage(1);
              setEntity(event.target.value);
            }}
            options={ENTITIES.map((value) => ({ value, label: value || "All entities" }))}
          />
        </div>
      </div>

      <Panel title="Activity">
        {logs === null ? (
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No audit entries yet.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 pb-2">When</th>
                  <th className="px-5 pb-2">Action</th>
                  <th className="px-5 pb-2">Entity</th>
                  <th className="px-5 pb-2">Actor</th>
                  <th className="px-5 pb-2">IP</th>
                  <th className="px-5 pb-2">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-5 py-3 text-muted-foreground">{formatDateTime(log.createdAt)}</td>
                    <td className="px-5 py-3">
                      <Badge variant="info">{log.action}</Badge>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {log.entity ?? "—"}
                      {log.entityId ? <span className="ml-1 text-xs opacity-70">({log.entityId.slice(0, 8)})</span> : null}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{log.actor ?? "System"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{log.ip ?? "—"}</td>
                    <td className="max-w-md truncate px-5 py-3 text-xs text-muted-foreground">
                      {log.meta ? JSON.stringify(log.meta) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Pagination page={meta.page} totalPages={meta.totalPages} onChange={setPage} />
    </div>
  );
}
