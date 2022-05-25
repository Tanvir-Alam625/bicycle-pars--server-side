const express = require("express");
const cors = require("cors");
const {
  MongoClient,
  ServerApiVersion,
  LoggerLevel,
  ObjectId,
} = require("mongodb");
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
async function run() {
  try {
    await client.connect();

    const partsCollection = client.db("bicycleParts").collection("parts");
    const reviewsCollection = client.db("bicycleParts").collection("reviews");
    const ordersCollection = client.db("bicycleParts").collection("orders");
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
    app.get("/purchase/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await partsCollection.findOne(query);
      res.send(result);
    });
    // stored order data api
    app.post("/orders", async (req, res) => {
      const order = req.body;
      const result = await ordersCollection.insertOne(order);
      res.send(result);
    });
    // update parts available data api
    app.patch("/purchase/:id", async (req, res) => {
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
