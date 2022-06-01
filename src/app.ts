import cors from "cors";
import express from "express";

const createApplication = () => {
  const app = express();
  app.use(
    cors({
      origin: ["http://localhost:3000", "http://localhost:443"],
      credentials: true,
    })
  );
  app.use(express.json());

  return app;
};

export default createApplication;
