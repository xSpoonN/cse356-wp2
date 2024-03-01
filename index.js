const express = require("express");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const User = require("./User");
const app = express();
const PORT = 3000;

mongoose.connect('mongodb+srv://ktao87:zTFcTXa1vY7emrzk@wup2.tp4o37r.mongodb.net/?retryWrites=true&w=majority'); // @todo check if this works

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});

app.use(express.json());

const transporter = nodemailer.createTransport({ // @todo configure this with our own mail server
  service: "",
  auth: {
    user: "",
    pass: ""
  }
});

app.post("/adduser", async (req, res) => {
  console.log(req);
  console.log(req.body)
  const {username, password, email} = req.body;
  console.log(username, password, email)

  try {
    const existingUser = await User.findOne({$or: [{username}, {email}]}); // Check if the username or email already exists
    if (existingUser) {
      return res.status(400).send("User already exists");
    }

    const verificationKey = Math.random().toString(36).substring(7); // Generate a random verification key - @todo may need to use crypto.randomBytes
    const newUser = new User({
      username,
      password, // Should be hashed and salted but don't think its required for this assignment
      email,
      verificationToken: verificationKey
    });
    await newUser.save();
    const hostname = "0.0.0.0"; // @todo get the host ip
    const verificationLink = `http://${hostname}/verify?email=${email}&token=${verificationKey}`;
    console.log(verificationLink)

    // @todo Figure out how to send email - this is just a placeholder
    /* const mailOptions = {
      from: "",
      to: email,
      subject: "Account Verification",
      text: `Please click the following link to verify your account: ${verificationLink}`
    };
    await transporter.sendMail(mailOptions); */

    res.status(201).send("User created successfully. Check your email for verification.");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
});

app.get("/verify", async (req, res) => {
  const {email, token} = req.query;
  console.log(email, token)

  try {
    const user = await User.findOne({email, verificationToken: token});
    if (!user) {
      return res.status(400).send("Invalid verification link");
    }

    user.verified = true;
    user.verificationToken = "";
    await user.save();
    res.status(200).send("User verified successfully");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
});