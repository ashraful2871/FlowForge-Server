import { createApp } from "./app";

const app = createApp();

app.listen(5000, () => {
  console.log("API listening on http://localhost:5000");
});
