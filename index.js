const express = require("express");
const cors = require("cors");
const port = 5000;
require("dotenv").config();
const jwt = require("jsonwebtoken");

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

function verifyJWT(req, res, next) {
  const headerAuthorization = req.headers.authorization;
  if (!headerAuthorization) {
    return res.status(401).send("unauthorize access");
  }
  const token = headerAuthorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send("forbidden access");
    }
    req.decoded = decoded;
    next();
  });
}
async function run() {
  try {
    const appointmentOption = client
      .db("dentalCare")
      .collection("appointmentOption");
    const bookings = client.db("dentalCare").collection("bookings");
    const usersCollection = client.db("dentalCare").collection("users");

    app.get("/appointmentOption", async (req, res) => {
      const query = {};
      const date = req.query.date;
      const cursor = appointmentOption.find(query);
      const options = await cursor.toArray();
      const bookQuery = { appointmentDate: date };
      const alreadyBooked = await bookings.find(bookQuery).toArray();
      options.forEach((option) => {
        const optionBooked = alreadyBooked.filter(
          (book) => book.treatment === option.name
        );
        const bookedSlot = optionBooked.map((book) => book.slot);
        const remainingSlots = option.slots.filter(
          (slot) => !bookedSlot.includes(slot)
        );
        option.slots = remainingSlots;
        // console.log(bookedSlot)
      });
      res.send(options);
    });

    app.get("/bookings", verifyJWT, async (req, res) => {
      const userEmail = req.query.email;
      const decodedEmail = req.decoded.email;
      if (userEmail !== decodedEmail) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: userEmail };
      const bookingsData = await bookings.find(query).toArray();
      res.send(bookingsData);
    });

    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const users = await usersCollection.findOne(query);
      if (users) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
          expiresIn: "1h",
        });
        return res.send({ accessToken: token });
      }
      res.status(403).send({ accessToken: "" });
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      const query = {
        email: booking.email,
        appointmentDate: booking.appointmentDate,
        treatment: booking.treatment,
      };
      const alreadyBooked = await bookings.find(query).toArray();
      if (alreadyBooked.length) {
        const message = `You already have a booking on date ${booking.appointmentDate}`;
        return res.send({ acknowlege: false, message });
      }
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
