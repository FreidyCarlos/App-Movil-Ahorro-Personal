import { spawn } from "node:child_process";

const child = spawn(
  process.execPath,
  [
    "node_modules/expo/bin/cli",
    "start",
    "--dev-client",
    ...process.argv.slice(2),
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      EXPO_NO_TYPESCRIPT_SETUP: "1",
    },
  },
);

child.on("error", (error) => {
  console.error("No fue posible iniciar Expo.", error.message);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal !== null) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
