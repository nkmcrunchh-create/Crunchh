import { Container, getRandom } from "@cloudflare/containers";

type Env = {
  CRUNCHH_CONTAINER: DurableObjectNamespace;
  INTERNAL_JOB_SECRET?: string;
  CONTAINER_INSTANCES?: string;
  [key: string]: unknown;
};

export class CrunchhCommerceContainer extends Container<Env> {
  defaultPort = 3000;
  requiredPorts = [3000];
  sleepAfter = "15m";
  enableInternet = true;
  envVars: Record<string, string> = {
    NODE_ENV: "production",
    PORT: "3000"
  };

  constructor(ctx: DurableObjectState<{}>, env: Env) {
    super(ctx, env);
    this.envVars = runtimeEnv(env);
  }
}

function runtimeEnv(env: Env) {
  const output: Record<string, string> = {
    NODE_ENV: "production",
    PORT: "3000"
  };
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") output[key] = value;
  }
  return output;
}

async function getContainer(env: Env) {
  const instances = Number(env.CONTAINER_INSTANCES || "2");
  return getRandom(env.CRUNCHH_CONTAINER as any, Number.isFinite(instances) ? instances : 2);
}

export default {
  async fetch(request: Request, env: Env) {
    const container = await getContainer(env);
    return container.fetch(request);
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      const container = await getContainer(env);
      await container.fetch("http://crunchh.internal/api/internal/jobs/process-due", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-job-secret": String(env.INTERNAL_JOB_SECRET || "")
        },
        body: "{}"
      });
    })());
  }
};
