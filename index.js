const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const winston = require('winston');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const User = require('./User');
const app = express();
const PORT = 3000; //@todo change to 80

const { combine, timestamp, colorize, align, printf } = winston.format;

// create a custom timestamp format for log statements
const timezoned = () => {
  const date = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
  });
  const [datePart, timePart] = date.split(', ');
  const [month, day, year] = datePart.split('/');
  const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const [time, ampm] = timePart.split(' ');
  let [hours, minutes, seconds] = time.split(':');

  return `${formattedDate} ${hours.padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
};

/* create a custom logger
 1) /dev/stdout logger for http requests
 2) ./logs/debug.log logger for debug logs (additional logs can be done with logger.debug(message)) 
*/
const logger = winston.createLogger({
  transports: [
    new winston.transports.Console({
      level: 'http',
      format: combine(
        colorize({ all: true }),
        timestamp({
          format: timezoned,
        }),
        align(),
        printf(info => `[${info.timestamp}] ${info.message}`)
      ),
    }),
    new winston.transports.File({
      level: 'debug',
      filename: './logs/debug.log',
      format: combine(
        timestamp({
          format: timezoned,
        }),
        align(),
        printf(info => `[${info.timestamp}] ${info.message}`)
      ),
      handleExceptions: true,
    }),
  ],
});

// create a middleware that captures http requests and logs
morgan.token('body', req => {
  return JSON.stringify(req.body);
});
const morganMiddleware = morgan(
  function (tokens, req, res) {
    return [
      tokens.method(req, res),
      decodeURI(tokens.url(req, res)),
      tokens.status(req, res),
      '-',
      tokens['response-time'](req, res),
      'ms',
      tokens.body(req),
    ].join(' ');
  },
  {
    stream: {
      write: message => {
        logger.http(message.trim());
      },
    },
  }
);

const clientPromise = mongoose
  .connect(
    'mongodb+srv://ktao87:zTFcTXa1vY7emrzk@wup2.tp4o37r.mongodb.net/?retryWrites=true&w=majority'
  )
  .then(m => m.connection.getClient());

app.use(morganMiddleware);
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  );
  res.header('X-CSE356', '65b99ec7c9f3cb0d090f2236');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(
  session({
    resave: false,
    saveUninitialized: false,
    secret: 'verysecretsecretphrase',
    cookie: { maxAge: 300000 }, //session expires after 5 minutes
    store: MongoStore.create({ clientPromise, dbName: 'test' }),
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/test.html');
});

app.post('/adduser', async (req, res) => {
  const { username, password, email } = req.body;
  console.log(username, password, email);

  try {
    const existingUser = await User.findOne({ $or: [{ username }, { email }] }); // Check if the username or email already exists
    if (existingUser) {
      return res
        .status(400)
        .send({ status: 'ERROR', message: 'User already exists' });
    }

    const verificationKey = Math.random().toString(36).substring(7); // Generate a random verification key - @todo may need to use crypto.randomBytes
    const newUser = new User({
      username,
      password, // Should be hashed and salted but don't think its required for this assignment
      email,
      verificationToken: verificationKey,
    });
    await newUser.save();
    const hostname = '194.113.74.157';
    const verificationLink = `http://${hostname}/verify?email=${email}&token=${verificationKey}`;
    console.log(verificationLink);

    const transporter = nodemailer.createTransport({
      host: hostname,
      port: 25,
    });

    // @todo Figure out how to send email - this is just a placeholder
    const mailOptions = {
      from: 'warmupproject2@cse356.com',
      to: email,
      subject: 'Account Verification',
      text: `Please click the following link to verify your account: ${verificationLink}`,
    };
    const resp = await transporter.sendMail(mailOptions);
    console.log(resp);

    res.status(201).send({
      status: 'OK',
      message: 'User created successfully. Check your email for verification.',
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ status: 'ERROR', message: 'Internal server error' });
  }
});

app.post('/test', async (req, res) => {
  const email = req.body.email;
  const verificationKey = Math.random().toString(36).substring(7); // Generate a random verification key - @todo may need to use crypto.randomBytes
  const hostname = 'localhost'; // @todo get the host ip
  const verificationLink = `http://${hostname}/verify?email=${email}&token=${verificationKey}`;
  console.log(verificationLink);

  const transporter = nodemailer.createTransport({
    host: host.docker.internal,
    port: 25,
  });

  // @todo Figure out how to send email - this is just a placeholder
  const mailOptions = {
    from: 'warmupproject2@cse356.com',
    to: email,
    subject: 'Account Verification',
    text: `Please click the following link to verify your account: ${verificationLink}`,
  };
  const resp = await transporter.sendMail(mailOptions);
  console.log(resp);
});

app.get('/verify', async (req, res) => {
  const { email, token } = req.query;
  console.log(email, token);

  try {
    const user = await User.findOne({ email, verificationToken: token });
    if (!user) {
      return res
        .status(400)
        .send({ status: 'ERROR', message: 'Invalid verification link' });
    }

    user.verified = true;
    user.verificationToken = '';
    await user.save();
    res
      .status(200)
      .send({ status: 'OK', message: 'User verified successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).send({ status: 'ERROR', message: 'Internal server error' });
  }
});

app.post('/login', async (req, res) => {
  // Check if username or password is provided
  const { body } = req;

  if (!('username' in body && 'password' in body)) {
    return res
      .status(400)
      .send({ status: 'ERROR', message: 'Username and password are required' });
  }
  const { username, password } = body;

  // Check if username and password is truthy value
  if (!username || !password) {
    return res
      .status(400)
      .send({ status: 'ERROR', message: 'Username and password are required' });
  }

  // Check if user is allowed to login
  const user = await User.findOne({ username });
  if (!user || user.password !== password || !user.verified) {
    return res
      .status(400)
      .send({ status: 'ERROR', message: 'Invalid username or password' });
  }

  // Set session
  req.session.regenerate(err => {
    if (err) {
      return res
        .status(500)
        .send({ status: 'ERROR', message: 'Internal server error' });
    }

    req.session.username = username;
    req.session.save(err => {
      if (err) {
        return res
          .status(500)
          .send({ status: 'ERROR', message: 'Internal server error' });
      }

      return res.status(200).send({ status: 'OK', message: 'User logged in' });
    });
  });
});

app.post('/logout', async (req, res) => {
  // Check if session exists
  if (!('username' in req.session)) {
    return res
      .status(400)
      .send({ status: 'ERROR', message: 'User is not logged in' });
  }

  // Clear user-specific data in session
  req.session.username = null;
  // Save the session
  req.session.save(err => {
    if (err) {
      return res
        .status(500)
        .send({ status: 'ERROR', message: 'Internal server error' });
    }

    // Regenerate the session (invalidate the old one and create a new one)
    req.session.regenerate(err => {
      if (err) {
        return res
          .status(500)
          .send({ status: 'ERROR', message: 'Internal server error' });
      }

      return res.status(200).send({ status: 'OK', message: 'User logged out' });
    });
  });
});

app.get('/tiles/l:layer/:y/:x', (req, res) => {
  const { layer, y, x } = req.params;
  const style = req.query.style || 'color';
  const filePath = `./tiles/l${layer}/${y}/${x}.jpg`;
  console.log(filePath);

  fs.readFile(filePath, (err, imgData) => {
    if (err) {
      console.error(err);
      return res
        .status(404)
        .send({ status: 'ERROR', message: 'Tile not found' });
    }

    if (style == 'bw') {
      sharp(imgData)
        .greyscale()
        .toBuffer()
        .then(data => {
          res.type('jpg').send(data);
        });
    } else {
      res.type('jpg').send(imgData);
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});
