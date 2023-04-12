const express = require("express");
const cors = require("cors");
const port = 5000;
require("dotenv").config();
const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Dental care server running");
});

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.oiqqfzt.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    const appointmentOption = client
      .db("dentalCare")
      .collection("appointmentOption");
    const bookings = client.db("dentalCare").collection("bookings");
    app.get("/appointmentOption", async (req, res) => {
      const query = {};
      const date = req.query.date;
      const cursor = appointmentOption.find(query);
      const options = await cursor.toArray();
      const bookQuery = {appointmentDate: date}
      const alreadyBooked = await bookings.find(bookQuery).toArray()
      options.forEach(option =>{
        const optionBooked = alreadyBooked.filter(book => book.treatment === option.name)
        const bookedSlot = optionBooked.map(book => book.slot)
        const remainingSlots =  option.slots.filter(slot => !bookedSlot.includes(slot))
        option.slots = remainingSlots;
        console.log(bookedSlot)
      })
      res.send(options);
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
