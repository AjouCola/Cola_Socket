import cors from "cors";
import express from "express";

const createApplication = () => {
  const app = express();
  app.use(
    cors({
      origin: process.env.CLIENT,
      credentials: true,
    })
  );
  app.use(express.json());

  return app;
};

export default createApplication;
