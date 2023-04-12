const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const knex = require("knex");
const bcrypt = require("bcrypt");

const db = knex({
  client: "pg",
  connection: {
    connectionString: process.env.DATABASE_URL,
    host: process.env.DATABASE_HOST,
    port: 5432,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PW,
    database: process.env.DATABASE_DB,
  },
});

db.select("*")
  .from("users")
  .then((data) => {
    console.log(data);
  });

const app = express();
app.use(bodyParser.json());
app.use(cors());
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

app.get("https://moviedb-rlml.onrender.com/", (req, res) => {
  res.send("it is working!");
});

app.post("https://moviedb-rlml.onrender.com/signin", (req, res) => {
  db.select("email", "hash")
    .from("login")
    .where("email", "=", req.body.email)
    .then((data) => {
      const isValid = bcrypt.compareSync(req.body.password, data[0].hash);
      if (isValid) {
        return db
          .transaction((trx) => {
            trx
              .select("*")
              .from("users")
              .where("email", "=", req.body.email)
              .then((user) => {
                return trx("users")
                  .where("id", "=", user[0].id)
                  .increment("entries", 1)
                  .returning("entries")
                  .then((entries) => {
                    res.json({
                      name: user[0].name,
                      entries: entries[0],
                    });
                  });
              })
              .then(trx.commit)
              .catch(trx.rollback);
          })
          .catch((err) =>
            res.status(400).json("unable to update user entries")
          );
      } else {
        res.status(400).json("wrong credentials");
      }
    })
    .catch((err) => res.status(400).json("wrong credentials"));
});

app.post("https://moviedb-rlml.onrender.com/register", (req, res) => {
  const saltRounds = 10;
  const { email, name, password } = req.body;
  if (!email || !name || !password) {
    return res.status(400).json("incorrect form submission");
  }
  const hash = bcrypt.hashSync(password, saltRounds);
  db.transaction((trx) => {
    trx
      .select("*")
      .from("users")
      .where({ email })
      .then((users) => {
        if (users.length > 0) {
          res.status(400).json("Email already registered");
        } else {
          return trx
            .insert({
              hash: hash,
              email: email,
            })
            .into("login")
            .returning("email")
            .then((loginEmail) => {
              return trx("users")
                .returning("*")
                .insert({
                  email: loginEmail[0].email,
                  name: name,
                  joined: new Date(),
                })
                .then((user) => {
                  res.json(user);
                });
            });
        }
      })
      .then(trx.commit)
      .catch(trx.rollback);
  }).catch((err) => res.status(400).json("unable to register"));
});

app.get("https://moviedb-rlml.onrender.com/profile/:id", (req, res) => {
  const { id } = req.params;
  db.select("*")
    .from("users")
    .where({ id })
    .then((user) => {
      if (user.length) {
        res.json(user[0]);
      } else {
        res.status(400).json("Not found");
      }
    })
    .catch((err) => res.status(400).json("error getting user"));
});

app.put("https://moviedb-rlml.onrender.com/image", (req, res) => {
  const { id } = req.body;
  db("users")
    .where("id", "=", id)
    .increment("entries", 1)
    .returning("entries")
    .then((entries) => {
      res.json(entries[0].entries);
    })
    .catch((err) => res.status(400).json("unable to get entries"));
});
