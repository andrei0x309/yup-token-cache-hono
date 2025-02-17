import { Hono } from "https://deno.land/x/hono@v3.11.12/mod.ts"
import { cors } from "https://deno.land/x/hono@v3.11.12/middleware.ts"

const app = new Hono();

app.use('/*', cors({
  origin: (origin: string) => (origin.toLocaleLowerCase().includes('://localhost') || 
  origin.toLocaleLowerCase().includes('://yup') ) ||
  origin.toLocaleLowerCase().includes('://live.yup.io')
  ? origin : '',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 3600,
}))

const kv = await Deno.openKv();

const getData = async (token: string) => {
  try {
    const API_URL = Deno.env.get("API_URL");

    const res = await fetch(`${API_URL}`, {
      headers: {
        authorization: token,
      },
    });
    const data = await res.json();
    if (data?.status?.error_code === 429) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

const setData = async (data: Record<string, any>) => {
  const storeData = {} as Record<string, any>;
  storeData.data = data;
  storeData.timestamp = Date.now();
  await kv.set(["preferences", "data"], storeData);
}

app.get("/token/yup", async (c) => {
  const API_URL = Deno.env.get("API_URL");
  if (!API_URL) {
    return c.json({ error: "API_URL not found" });
  }
  const token = c.req.headers.get("authorization");
  if (!token) {
    return c.json({ error: "token not found" });
  }

  let reqData = (await kv.get(["preferences", "data"])).value as Record<string, any> | null;

  if(reqData?.data?.status?.error_code === 429) {
    reqData = null;
  }

  if (!reqData) {
    const data = await getData(token);
    if (!data) {
      return c.json({ error: "data not found" });
    }
    await setData(data);
    return c.json(data);
  }

  const { timestamp } = reqData
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 1000 / 60);
  if (minutes > 180) {
    const data = await getData(token);
    if (!data) {
      return c.json(reqData.data);
    }
    await setData(data);
    return c.json(data);
  }
  return c.json(reqData.data);
});

app.get("/", async (c) => {
  c.text("...");
});

Deno.serve(app.fetch);