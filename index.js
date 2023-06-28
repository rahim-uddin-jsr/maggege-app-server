const express = require("express");
const app = express();
const cors = require("cors");
const cookieParser = require("cookie-parser");

require("dotenv").config();
const jwt = require("jsonwebtoken");
const ws = require("ws");
const port = process.env.PORT || 5000;
app.use(
  cors({
    credentials: true,
    origin: `${process.env.Client_Url}`,
  })
);
app.use(express.json());
app.use(cookieParser());

const server = app.listen(port, () => {
  console.log("massage app server run on port=", port);
});
const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_User}:${process.env.DB_Pass}@cluster0.vt0qgrn.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "Unauthorized response" });
  }
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.jwt_secret, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "Unauthorized response" });
    }
    req.decoded = decoded;
    next();
  });
};
async function run() {
  try {
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
    const userCollection = client.db("ZenChat").collection("userCOllection");
    const messagesCollection = client
      .db("ZenChat")
      .collection("messagesCollection");
    app.post("/jwt", (req, res) => {
      const token = jwt.sign(
        {
          data: req?.body,
        },
        `${process.env.jwt_secret}`,
        {},
        { expiresIn: "1h" }
      );
      res
        .cookie("token", token, { secure: true, sameSite: "none" })
        .send({ token });
    });

    // get all users
    app.get("/users", verifyJWT, async (req, res) => {
      // console.log("cookies=", req.cookies);
      const result = await userCollection.find().toArray();
      res.send(result);
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

    // web server
    const wss = new ws.WebSocketServer({ server });

    wss.on("connection", async (connection, req) => {
      connection.on("message", async (message) => {
        const messageData = JSON.parse(message.toString());
        const { recipient, text } = messageData;
        const createdAt = Date.now();
        messageData.createdAt = createdAt;
        const result = await messagesCollection.insertOne(messageData);
        const inserted = await messagesCollection.findOne({
          _id: result.insertedId,
        });
        if (recipient) {
          [...wss.clients]
            .filter((c) => c.userId === recipient)
            .forEach((c) =>
              c.send(
                JSON.stringify({
                  text,
                  sender: connection.userId,
                  id: inserted._id,
                  time: Date.now(),
                })
              )
            );
        }
      });
      // connection.send("hello");
      const cookies = req.headers.cookie;
      if (cookies) {
        const tokenString = cookies
          .split(";")
          .find((str) => str.startsWith("token="));
        const token = tokenString.split("=")[1];
        jwt.verify(token, process.env.jwt_secret, (err, decoded) => {
          if (err) throw err;

          const uid = decoded.data.uid;
          const userName = decoded.data.userName;
          const photoURL = decoded.data.photoURL;
          connection.userId = uid;
          connection.username = userName;
          connection.userPhoto = photoURL;
        });
      }

      [...wss.clients].forEach((client) => {
        client.send(
          JSON.stringify({
            online: [...wss.clients].map((c) => ({
              userId: c.userId,
              userName: c.username,
              userPhoto: c.userPhoto,
            })),
          })
        );
      });
    });
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("massage app Api running");
});
