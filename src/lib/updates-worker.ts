/// <reference lib="webworker" />
// Off-main-thread parsing / filtering / formatting of very large host lists so
// the UI never blocks while copying or exporting hundreds of thousands of rows.
import {
  applyHostQuery,
  formatHosts,
  parseQuery,
  type ExportFormat,
} from "./updates-dsl";

export type WorkerRequest = {
  id: number;
  text: string;
  query: string;
  format: ExportFormat;
};

export type WorkerResponse = {
  id: number;
  hosts: string[];
  output: string;
  total: number;
  kept: number;
  ms: number;
};

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const t0 = Date.now();
  const { id, text, query, format } = e.data;
  const raw = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  const hosts = applyHostQuery(raw, parseQuery(query));
  const res: WorkerResponse = {
    id,
    hosts,
    output: formatHosts(hosts, format),
    total: raw.length,
    kept: hosts.length,
    ms: Date.now() - t0,
  };
  (self as unknown as Worker).postMessage(res);
};
