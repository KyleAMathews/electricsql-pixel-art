import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import postgres from "postgres";
import { Resource } from "sst";

const app = new Hono();

// Enable CORS
app.use("*", cors());

const pixelSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  color: z.string(),
  user_id: z.string(),
  last_updated: z.string().datetime()
});

const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  pixels_placed: z.number().int(),
  last_active: z.string().datetime(),
  created_at: z.string().datetime()
});

// Create a new user
app.post("/api/users", zValidator("json", userSchema), async (c) => {
  try {
    const { id, username, pixels_placed, last_active, created_at } = c.req.valid("json");
    
    // Create a new postgres client for each request
    const sql = postgres(Resource.databaseUriLink.url);
    
    const user = await sql`
      INSERT INTO users (id, username, pixels_placed, last_active, created_at)
      VALUES (${id}, ${username}, ${pixels_placed}, ${last_active}, ${created_at})
      RETURNING *
    `;
    
    return c.json(user[0]);
  } catch (error) {
    console.error("Error creating user:", error);
    return c.json({ error: "Failed to create user" }, 500);
  }
});

// Update or create a pixel
app.post("/api/pixels", zValidator("json", pixelSchema), async (c) => {
  try {
    const { x, y, color, user_id, last_updated } = c.req.valid("json");
    
    // Create a new postgres client for each request
    const sql = postgres(Resource.databaseUriLink.url);
    
    // Using upsert (INSERT ... ON CONFLICT DO UPDATE)
    const pixel = await sql`
      INSERT INTO pixels (x, y, color, user_id, last_updated)
      VALUES (${x}, ${y}, ${color}, ${user_id}, ${last_updated})
      ON CONFLICT (x, y)
      DO UPDATE SET 
        color = EXCLUDED.color,
        user_id = EXCLUDED.user_id,
        last_updated = EXCLUDED.last_updated
      RETURNING *
    `;
    
    // Update user's pixels_placed count
    await sql`
      UPDATE users 
      SET pixels_placed = pixels_placed + 1,
          last_active = ${new Date().toISOString()}
      WHERE id = ${user_id}
    `;
    
    return c.json(pixel[0]);
  } catch (error) {
    console.error("Error updating pixel:", error);
    return c.json({ error: "Failed to update pixel" }, 500);
  }
});

export default {
  fetch: app.fetch,
};
