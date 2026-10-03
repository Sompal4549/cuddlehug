 

type LogLevel = "info" | "warn" | "error" | "debug";

const format = (level: LogLevel, message: string, meta?: unknown) => {
  const stamp = new Date().toISOString();
  const line = `[${stamp}] ${level.toUpperCase()} ${message}`;
  if (meta === undefined) return line;
  try {
    return `${line} ${typeof meta === "string" ? meta : JSON.stringify(meta)}`;
  } catch {
    return line;
  }
};

export const logger = {
  info: (message: string, meta?: unknown) => console.log(format("info", message, meta)),
  warn: (message: string, meta?: unknown) => console.warn(format("warn", message, meta)),
  error: (message: string, meta?: unknown) => console.error(format("error", message, meta)),
  debug: (message: string, meta?: unknown) => {
    if (process.env.NODE_ENV !== "production") console.debug(format("debug", message, meta));
  },
};
