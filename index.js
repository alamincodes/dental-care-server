const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = 5000;
require("dotenv").config();
const jwt = require("jsonwebtoken");

const app = express();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Dental care server running");
});

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
    // appointment option
    const appointmentOption = client
      .db("dentalCare")
      .collection("appointmentOption");
    // bookings
    const bookings = client.db("dentalCare").collection("bookings");
    // users
    const usersCollection = client.db("dentalCare").collection("users");
    // doctors
    const doctorsCollection = client.db("dentalCare").collection("doctors");
    // payments
    const paymentsCollection = client.db("dentalCare").collection("payments");

    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res.status(403).send({ message: "fobidden access" });
      }
      next();
    };

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
    app.get("/appointmentSpecialty", async (req, res) => {
      const query = {};
      const result = await appointmentOption
        .find(query)
        .project({ name: 1 })
        .toArray();
      res.send(result);
    });

    app.get("/users", async (req, res) => {
      const query = {};
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });

    //  stripe payment
    app.post("/create-payment-intent", async (req, res) => {
      const booking = req.body;
      const price = booking.price;
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        currency: "usd",
        amount,
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // payments
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const result = await paymentsCollection.insertOne(payment);
      const id = payment.bookingId;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };
      const updatedResult = await bookings.updateOne(filter, updatedDoc);
      res.send(result);
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

    // get doctors
    app.get("/doctors", verifyJWT, verifyAdmin, async (req, res) => {
      const query = {};
      const doctors = await doctorsCollection.find(query).toArray();
      res.send(doctors);
    });
    // create user
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    //! app.get("/addPrice", async (req, res) => {
    //   const filter = {};
    //   const option = { upsert: true };
    //   const updateDoc = {
    //     $set: {
    //       price: 99,
    //     },
    //   };
    //   const result = await appointmentOption.updateMany(
    //     filter,
    //     updateDoc,
    //     option
    //   );
    //   res.send(result);
    // });
    // delete doctor
    app.delete("/doctor/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await doctorsCollection.deleteOne(filter);
      res.send(result);
    });

    // get booking by id
    app.get("/booking/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookings.findOne(query);
      res.send(result);
    });
    // get booking by email
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
    // create booking
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

    // create doctor
    app.post("/doctors", async (req, res) => {
      const doctor = req.body;
      const result = await doctorsCollection.insertOne(doctor);
      res.send(result);
    });
    // get admin
    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      res.send({ isAdmin: user?.role === "admin" });
    });
    // create admin
    app.put("/users/admin/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const option = { upsert: true };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc, option);
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`example app listening on port ${port}`);
});
