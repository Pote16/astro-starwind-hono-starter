import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

const router = new Hono();

// Example validation schema
const createUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters long"),
  email: z.string().email("Invalid email format"),
  age: z.number().int().positive().optional(),
});

// A standard GET route
router.get("/", (c) => {
  return c.json({
    message: "Welcome to the Astro+Hono-Setup API",
    status: "healthy",
  });
});

// A POST route with strict Zod validation on the JSON body
router.post(
  "/users",
  zValidator("json", createUserSchema),
  async (c) => {
    // The request body is now strictly typed according to createUserSchema
    const data = c.req.valid("json");
    
    // In a real scenario, we'd use @ho-setup/db Prisma client here to insert it
    
    return c.json({
      success: true,
      message: `User ${data.name} created successfully!`,
      data,
    }, 201);
  }
);

export default router;
