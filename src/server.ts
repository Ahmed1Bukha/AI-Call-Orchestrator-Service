import app from "./app";
import { WorkService } from "./worker/callWorker";

app.listen(3000, () => {
  console.log(`Server running on port ${3000}`);
});

WorkService.start();
