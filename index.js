const express = require("express");
const cors = require("cors");
const {
  MongoClient,
  ServerApiVersion,
  LoggerLevel,
  ObjectId,
} = require("mongodb");
const jwt = require("jsonwebtoken");
require("dotenv").config();

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
    // load tools data
    app.get("/tools", async (req, res) => {
      const query = {};
      const cursor = partsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    // get reviews data api
    app.get("/reviews", async (req, res) => {
      const query = {};
      const cursor = reviewsCollection.find(query);
      const result = await cursor.toArray();
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
    //get orders data api
    app.get("/orders", async (req, res) => {
      const query = {};
      const cursor = ordersCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    // cancel order api data
    app.delete("/order/:id", tokenVerify, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await ordersCollection.deleteOne(query);
      res.send(result);
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
          user,
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
