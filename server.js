const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const routes = require("./routes/index");

dotenv.config();

connectDB();

// create our Express app
const app = express();

app.use(cors());
app.use(express.json());

// After allllll that above middleware, we finally handle our own routes!
app.use(routes);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
