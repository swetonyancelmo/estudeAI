export interface HealthStatusDto {
  status: "ok" | "error";
  database: "up" | "down";
  timestamp: string;
}

export * from "./auth";
export * from "./roadmap";

