const express = require("express");
const cors = require("cors");
const {
  MongoClient,
  ServerApiVersion,
  LoggerLevel,
  ObjectId,
} = require("mongodb");
const jwt = require("jsonwebtoken");
const res = require("express/lib/response");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET);

const app = express();
const port = process.env.PORT || 5000;
// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.USER_NAME}:${process.env.USER_PASSWORD}@cluster0.jhwgt.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

// jsonwebtoken verification function
const tokenVerify = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ message: "UnAuthorization access" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.JSON_WEB_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
};
async function run() {
  try {
    await client.connect();

    const partsCollection = client.db("bicycleParts").collection("parts");
    const reviewsCollection = client.db("bicycleParts").collection("reviews");
    const ordersCollection = client.db("bicycleParts").collection("orders");
    const usersCollection = client.db("bicycleParts").collection("users");
    const profileCollection = client.db("bicycleParts").collection("profile");

    // middleware
    const adminVerify = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterUser = await usersCollection.findOne({ email: requester });
      const requestAccount = requesterUser.role === "admin";
      if (requestAccount) {
        next();
      } else {
        return res.status(403).send({ message: "Forbidden Access" });
      }
    };
    // load tools data
    app.get("/tools", async (req, res) => {
      const query = {};
      const cursor = partsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    // insert product data api
    app.post("/tools", tokenVerify, adminVerify, async (req, res) => {
      const tool = req.body;
      const result = await partsCollection.insertOne(tool);
      res.send(result);
    });

    // delete product data api
    app.delete("/tool/:id", tokenVerify, adminVerify, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await partsCollection.deleteOne(query);
      res.send(result);
    });
    // delete product data api
    app.get("/tool/:id", tokenVerify, adminVerify, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await partsCollection.findOne(query);
      res.send(result);
    });
    //user info update api
    app.put("/tool/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const tool = req.body;
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          name: tool.name,
          price: tool.price,
          minimumQuantity: tool.minimumQuantity,
          available: tool.available,
          img: tool.img,
          description: tool.description,
        },
      };
      const result = await partsCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });
    // get reviews data api
    app.get("/reviews", async (req, res) => {
      const query = {};
      const cursor = reviewsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // payment intent api data
    app.post("/create-payment-intent", tokenVerify, async (req, res) => {
      const orderData = req.body;
      const price = orderData.price;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    // order data update after pay
    app.patch("/orderPay/:id", tokenVerify, async (req, res) => {
      const id = req.params.id;
      console.log(req.body);
      const transactionId = req.body.transactionId;
      const filter = { _id: ObjectId(id) };
      const updateDoc = {
        $set: {
          paid: true,
          transactionId: transactionId,
        },
      };
      const result = await ordersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    //post reviews api data
    app.post("/reviews", tokenVerify, async (req, res) => {
      const review = req.body;
      const result = await reviewsCollection.insertOne(review);
      res.send(result);
    });
    // get purchase data api
    app.get("/purchase/:id", tokenVerify, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await partsCollection.findOne(query);
      res.send(result);
    });
    // stored order data api
    app.post("/orders", tokenVerify, async (req, res) => {
      const order = req.body;
      const result = await ordersCollection.insertOne(order);
      res.send(result);
    });
    // data load for dashboard/myAppointment table
    app.get("/orders", tokenVerify, async (req, res) => {
      const email = req.query.email;
      const query = { userEmail: email };
      const authEmail = req.decoded.email;
      if (email === authEmail) {
        const cursor = ordersCollection.find(query);
        const orders = await cursor.toArray();
        return res.send(orders);
      } else {
        return res.status(403).send({ message: "Forbidden access" });
      }
    });
    // cancel order api data
    app.delete("/order/:id", tokenVerify, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await ordersCollection.deleteOne(query);
      res.send(result);
    });
    // cancel order api data
    app.get("/order/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await ordersCollection.findOne(query);
      res.send(result);
    });
    app.patch(
      "/orderShipment/:id",
      tokenVerify,
      adminVerify,
      async (req, res) => {
        const id = req.params.id;
        const shipment = req.body.shipment;
        const filter = { _id: ObjectId(id) };
        const updateDoc = {
          $set: {
            shipment: shipment,
          },
        };
        const result = await ordersCollection.updateOne(filter, updateDoc);
        res.send(result);
      }
    );
    // manageOrders api data
    app.get("/manageOrders", tokenVerify, adminVerify, async (req, res) => {
      const query = {};
      const result = await ordersCollection.find(query).toArray();
      res.send(result);
    });
    // secure admin panel
    app.get("/admin/:email", tokenVerify, async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email: email });
      const isAdmin = result.role === "admin";
      res.send({ admin: isAdmin });
    });
    // update parts available data api
    app.patch("/purchase/:id", tokenVerify, async (req, res) => {
      const id = req.params.id;
      const available = req.body.available;
      const filter = { _id: ObjectId(id) };
      const updateDoc = {
        $set: {
          available: available,
        },
      };
      const update = await partsCollection.updateOne(filter, updateDoc);
      res.send(update);
    });
    // load profile data
    app.get("/profile/:email", async (req, res) => {
      const email = req.params.email;
      const result = await profileCollection.findOne({ email: email });
      res.send(result);
    });
    //user info update api
    app.put("/profile/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const user = req.body;
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          name: user.name,
          email: user.email,
          country: user.country,
          city: user.city,
          img: user.img,
          location: user.location,
        },
      };
      const result = await profileCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });
    // get user api data
    app.get("/users", tokenVerify, adminVerify, async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    });
    //make admin api data
    app.patch("/makeAdmin/:id", tokenVerify, adminVerify, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const role = req.body.role;
      const updateDoc = {
        $set: {
          role: role,
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    //remove admin api data
    app.patch(
      "/removeAdmin/:id",
      tokenVerify,
      adminVerify,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: ObjectId(id) };
        const role = req.body.role;
        const updateDoc = {
          $set: {
            role: role,
          },
        };
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.send(result);
      }
    );
    // users api data
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const token = jwt.sign({ email: email }, process.env.JSON_WEB_TOKEN, {
        expiresIn: "1d",
      });
      const updateDoc = {
        $set: {
          email: user.email,
        },
      };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send({ result, token: token });
    });
  } finally {
    //
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("BiCycle parts server is running");
});
app.listen(port, () => {
  console.log("server running port number ", port);
});
