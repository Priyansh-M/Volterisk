import app from "./index.js";

const port = Number(process.env.PORT ?? 8787);
const host = "0.0.0.0";

const server = app.listen(port, host, () => {
  console.log(`Iron Hour API on http://${host}:${port}`);
});
server.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
