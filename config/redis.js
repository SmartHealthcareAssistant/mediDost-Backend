import { createClient } from "redis";

const client = createClient({
  url: process.env.REDIS_URL,
});

client.on("error", (err) => {
  console.error("Redis Error:", err);
});

// Connect Redis
if (process.env.REDIS_URL) {
  client.connect()
    .then(() => console.log("✅ Redis connected"))
    .catch((err) => console.error("❌ Redis connection error:", err));
}

// Error handling
client.on("error", (err) => {
  console.error("Redis Error:", err);
});

export default client;