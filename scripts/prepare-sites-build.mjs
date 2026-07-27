import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const buildDirectory = resolve(projectRoot, "dist");
const generatedWorkerDirectory = resolve(buildDirectory, "kawan_campus");
const serverDirectory = resolve(buildDirectory, "server");
const generatedLocalSecretsFile = resolve(generatedWorkerDirectory, ".dev.vars");
const localSecretsFile = resolve(serverDirectory, ".dev.vars");

await rm(serverDirectory, { recursive: true, force: true });
await mkdir(serverDirectory, { recursive: true });
await cp(generatedWorkerDirectory, serverDirectory, { recursive: true });
await rm(generatedLocalSecretsFile, { force: true });
await rm(localSecretsFile, { force: true });
