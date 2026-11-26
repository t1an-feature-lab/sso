import type {
  BaseDetailPayload,
  BaseSchema,
  BasesListPayload,
  FieldConfig,
  FieldSchema,
  FieldType,
  RecordData,
  RecordsPagePayload,
  TableDetailPayload,
  TableSummary,
  ViewConfig,
  ViewSchema,
  ViewType,
} from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string" ? data.error : `请求失败 (${response.status})`
    );
  }
  return data as T;
}

export const bitableApi = {
  listBases(params?: {
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<BasesListPayload> {
    const qs = new URLSearchParams();
    if (params?.limit !== undefined) qs.set("limit", String(params.limit));
    if (params?.offset !== undefined) qs.set("offset", String(params.offset));
    if (params?.search?.trim()) qs.set("q", params.search.trim());
    const query = qs.toString();
    return request<BasesListPayload>(`/api/bases${query ? `?${query}` : ""}`);
  },

  reorderBases(baseIds: string[]): Promise<{ ok: true }> {
    return request("/api/bases/reorder", {
      method: "POST",
      body: JSON.stringify({ baseIds }),
    });
  },

  createBase(input: {
    name: string;
    description?: string;
    iconColor?: string;
  }): Promise<{ base: BaseSchema; defaultTableId: string }> {
    return request("/api/bases", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  getBase(baseId: string): Promise<BaseDetailPayload> {
    return request<BaseDetailPayload>(`/api/bases/${encodeURIComponent(baseId)}`);
  },

  updateBase(
    baseId: string,
    input: { name?: string; description?: string; iconColor?: string }
  ): Promise<{ base: BaseSchema }> {
    return request(`/api/bases/${encodeURIComponent(baseId)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  deleteBase(baseId: string): Promise<{ ok: true }> {
    return request(`/api/bases/${encodeURIComponent(baseId)}`, {
      method: "DELETE",
    });
  },

  createTable(
    baseId: string,
    input: { name: string; description?: string }
  ): Promise<{ table: TableSummary }> {
    return request(`/api/bases/${encodeURIComponent(baseId)}/tables`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  getTableDetail(tableId: string): Promise<TableDetailPayload> {
    return request<TableDetailPayload>(
      `/api/tables/${encodeURIComponent(tableId)}`
    );
  },

  updateTable(
    tableId: string,
    input: { name?: string; description?: string }
  ): Promise<{ table: TableSummary }> {
    return request(`/api/tables/${encodeURIComponent(tableId)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  deleteTable(tableId: string): Promise<{ ok: true }> {
    return request(`/api/tables/${encodeURIComponent(tableId)}`, {
      method: "DELETE",
    });
  },

  reorderTables(baseId: string, tableIds: string[]): Promise<{ ok: true }> {
    return request(
      `/api/bases/${encodeURIComponent(baseId)}/tables/reorder`,
      {
        method: "POST",
        body: JSON.stringify({ tableIds }),
      }
    );
  },

  createField(
    tableId: string,
    input: {
      name: string;
      type: FieldType;
      required?: boolean;
      width?: number;
      config?: FieldConfig;
    }
  ): Promise<{ field: FieldSchema }> {
    return request(`/api/tables/${encodeURIComponent(tableId)}/fields`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  updateField(
    fieldId: string,
    input: {
      name?: string;
      type?: FieldType;
      required?: boolean;
      width?: number;
      config?: FieldConfig;
    }
  ): Promise<{ field: FieldSchema }> {
    return request(`/api/fields/${encodeURIComponent(fieldId)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  deleteField(fieldId: string): Promise<{ ok: true }> {
    return request(`/api/fields/${encodeURIComponent(fieldId)}`, {
      method: "DELETE",
    });
  },

  createView(
    tableId: string,
    input: { name: string; type: ViewType; config?: ViewConfig }
  ): Promise<{ view: ViewSchema }> {
    return request(`/api/tables/${encodeURIComponent(tableId)}/views`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  updateView(
    viewId: string,
    input: { name?: string; type?: ViewType; config?: ViewConfig }
  ): Promise<{ view: ViewSchema }> {
    return request(`/api/views/${encodeURIComponent(viewId)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  deleteView(viewId: string): Promise<{ ok: true }> {
    return request(`/api/views/${encodeURIComponent(viewId)}`, {
      method: "DELETE",
    });
  },

  reorderViews(tableId: string, viewIds: string[]): Promise<{ ok: true }> {
    return request(
      `/api/tables/${encodeURIComponent(tableId)}/views/reorder`,
      {
        method: "POST",
        body: JSON.stringify({ viewIds }),
      }
    );
  },

  listRecords(
    tableId: string,
    params?: { limit?: number; offset?: number }
  ): Promise<RecordsPagePayload> {
    const qs = new URLSearchParams();
    if (params?.limit !== undefined) qs.set("limit", String(params.limit));
    if (params?.offset !== undefined) qs.set("offset", String(params.offset));
    const query = qs.toString();
    return request<RecordsPagePayload>(
      `/api/tables/${encodeURIComponent(tableId)}/records${query ? `?${query}` : ""}`
    );
  },

  createRecord(
    tableId: string,
    input?: { values?: Record<string, unknown> }
  ): Promise<{ record: RecordData }> {
    return request(`/api/tables/${encodeURIComponent(tableId)}/records`, {
      method: "POST",
      body: JSON.stringify(input ?? {}),
    });
  },

  insertRecords(
    tableId: string,
    input: {
      anchorRecordId: string;
      position: "before" | "after";
      count: number;
    }
  ): Promise<{ records: RecordData[] }> {
    return request(
      `/api/tables/${encodeURIComponent(tableId)}/records/insert`,
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    );
  },

  getRecord(recordId: string): Promise<{ record: RecordData }> {
    return request(`/api/records/${encodeURIComponent(recordId)}`);
  },

  updateRecord(
    recordId: string,
    values: Record<string, unknown>
  ): Promise<{ record: RecordData }> {
    return request(`/api/records/${encodeURIComponent(recordId)}`, {
      method: "PATCH",
      body: JSON.stringify({ values }),
    });
  },

  reorderRecords(
    tableId: string,
    items: { id: string; sortOrder: number }[]
  ): Promise<{ ok: true }> {
    return request(
      `/api/tables/${encodeURIComponent(tableId)}/records/reorder`,
      {
        method: "POST",
        body: JSON.stringify({ items }),
      }
    );
  },

  deleteRecord(recordId: string): Promise<{ ok: true }> {
    return request(`/api/records/${encodeURIComponent(recordId)}`, {
      method: "DELETE",
    });
  },

  bulkDeleteRecords(
    tableId: string,
    recordIds: string[]
  ): Promise<{ deletedCount: number }> {
    return request(
      `/api/tables/${encodeURIComponent(tableId)}/records/bulk-delete`,
      {
        method: "POST",
        body: JSON.stringify({ recordIds }),
      }
    );
  },
};
