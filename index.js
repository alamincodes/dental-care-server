const express = require("express");
const cors = require("cors");
const port = 5000;
require("dotenv").config();
const app = express();
app.use(cors());
app.use(express.json());
// dentalCare
// dtd7gPIIh4A4MpmB
app.get("/", (req, res) => {
  res.send("Dental care server running");
});

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.oiqqfzt.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri);
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    const appoinmentOption = client
      .db("dentalCare")
      .collection("appointmentOption");
    const bookings = client.db("dentalCare").collection("bookings");
    app.get("/appointmentOption", async (req, res) => {
      const query = {};
      const cursor = appoinmentOption.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      const result = await bookings.insertOne(booking);
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`example app listening on port ${port}`);
});
