import { getSocket } from "@socket/index";
import { Server } from "socket.io";

const http = require("http");

import createApplication from "./app";

const app = createApplication();

const server = http.createServer(app);

const io: Server = new Server(server, {
  cors: {
    origin: "*",
  },
});

getSocket(io);
const port = process.env.PORT || 4000;
server.listen(port, async () => {
  console.log(`listening on port : ${port}`);
});
