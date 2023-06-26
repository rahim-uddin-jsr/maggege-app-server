const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());
const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_User}:${process.env.DB_Pass}@cluster0.vt0qgrn.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
    const userCollection = client.db("ZenChat").collection("userCOllection");
    app.post("/jwt", (req, res) => {
      const token = jwt.sign(
        {
          data: req?.body,
        },
        `${process.env.jwt_secret}`,
        { expiresIn: "1h" }
      );
      console.log(token);
      res.send({ token });
    });
    // add register users
    app.post("/users", async (req, res) => {
      const userData = req.body;
      const email = userData.email;
      const date = Date.now;
      userData.createdAt = date;
      const isExist = await userCollection.findOne({ email: email });
      if (isExist) {
        return res.send({ exist: true });
      }
      const result = await userCollection.insertOne(userData);
      res.send(result);
    });
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("massage app Api running");
});

app.listen(port, () => {
  console.log("massage app server run on port=", port);
});
