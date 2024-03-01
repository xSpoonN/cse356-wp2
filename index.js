const express = require("express");
const mongoose = require("mongoose");
const User = require("./User");
const app = express();
const PORT = 3000;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});
