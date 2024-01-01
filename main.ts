import { Hono } from "https://deno.land/x/hono@v3.11.12/mod.ts";

const app = new Hono();
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
    return data;
  } catch (e) {
    return null;
  }
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

  const reqData = await kv.get(["preferences", "data"]) as Record<string, any>;

  if (!reqData) {
    const data = await getData(token);
    if (!data) {
      return c.json({ error: "data not found" });
    }
    const storeData = {} as Record<string, any>;
    storeData.data = data;
    storeData.timestamp = Date.now();
    await kv.set(["preferences", "data"], storeData);
    return c.json(data);
  }

  const { timestamp } = reqData
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 1000 / 60);
  if (minutes > 110) {
    const data = await getData(token);
    if (!data) {
      return c.json(reqData.data);
    }
    const storeData = {} as Record<string, any>;
    storeData.data = data;
    storeData.timestamp = Date.now();
    await kv.set(["preferences", "data"], storeData);
    return c.json(data);
  }
  return c.json(reqData.data);
});
