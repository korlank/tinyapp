// load .env data into process.env
require('dotenv').config();

// Web server config
const express = require("express");
const app = express();
const PORT = process.env.PORT || 8080;
const ENV = process.env.ENV || "development";
const bodyParser = require("body-parser");
const cookieSession = require('cookie-session');
const bcrypt = require('bcryptjs');
const morgan = require('morgan');
const { generateRandomString, urlsForUser } = require('./helpers');

// PG database client/connection setup
const { Pool } = require('pg');
let dbParams = {};
if (process.env.DATABASE_URL) {
  dbParams.connectionString = process.env.DATABASE_URL;
} else {
  dbParams = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  };
};
const db = new Pool(dbParams);
db.connect();

// middlewares 
app.use(morgan('dev'));
app.use(cookieSession({
  name: 'session',
  keys: ['secretKey1', 'secretKey2'],
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");

//Routes
// GET /home
app.get("/home", (req, res) => {
  const userId = req.session.id;
  db.query(`SELECT * FROM users WHERE id=${userId}`).
    then(data => {
      res.redirect('/urls')
    }).catch(err => {
      console.log(err)
      return res.redirect('/login')
    });

})

app.get("/", (req, res) => {
  const userId = req.session.id;
  db.query(`SELECT * FROM users WHERE id=${userId}`).
    then(data => {
      res.redirect('/urls')
    }).catch(err => {
      console.log(err)
      return res.redirect('/login')
    });
})

app.get("/demo", (req, res) => {
  req.session.id = 1;
  db.query(`SELECT * FROM users WHERE id=1`).
  then(data => {
  let templateVars = {
    user: {email: data.rows[0].email}
  }
  res.render("urls_new", templateVars)
  }).catch(err => {
    res.send(error)
    // return res.redirect('/login')
  });
})

//   GET /register
app.get('/register', (req, res) => {
  const userId = req.session.id;

  const templateVars = {
    user: null
  };
  res.render('register', templateVars);
})

//   POST /register
app.post('/register', (req, res) => {
  let email = req.body.email;
  let password = req.body.password;

  console.log('email', req.body.email, 'password', req.body.password)
  //to check if email and password were entered (if req.body contains them)
  if (!email || !password) {
    return res.status(400).send(`<script>alert("Please enter your email and password"); window.location.href = "/register"; </script>`);
  }

  //to check if the users database already contains the email entered (retrieved from req.body)
  db.query(`SELECT * FROM users where email = '${email}'`).
    then(result => {
      if (result.rows[0].email.length > 0) {
        return res.status(400).send(`<script>alert("The user is already registered"); window.location.href = "/register"; </script>`)
      }
    }).catch(err => {
      bcrypt.genSalt(10, (err, salt) => {
        bcrypt.hash(password, salt, (err, hash) => {
          const sql = `INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *`;
          const values = [email, hash];
          db.query(sql, values).
            then(result => {
              req.session.id = result.rows[0].id;
              res.redirect("/urls");
            })
        });
      });
    }

    )

  //if the user was not found in the user database, the new user will be added to it with hased password by bcrypt and cookie will be encrypted by req.session

});

//   GET /login
app.get('/login', (req, res) => {
  const userId = req.session.id;

  const templateVars = {
    user: null
  };

  res.render('login', templateVars);
})

//   POST /login
app.post('/login', (req, res) => {
  let email = req.body.email;
  let password = req.body.password;
  // let user_ID = getUserByEmail(email, users);
  // let user = users[user_ID];


  //to compare the hash created in POST /register with the one entered in login form (retrieved from req.body)

  db.query(`SELECT * FROM users where email = '${email}'`).
    then(data => {
      bcrypt.compare(password, data.rows[0].password, (err, result) => {
        if (!result) {
          return res.status(403).send(`<script>alert("Wrong password."); window.location.href = "/login"; </script>`);
        }
        req.session.id = data.rows[0].id;
        res.redirect("/urls");
      })
    }).catch(err => {
      console.log(err)
      return res.status(400).send(`<script>alert("No user found"); window.location.href = "/login"; </script>`)
    })
});


//  GET /urls -> restriction unlogged users is implemented using if in line 14 of 'urls_index.ejs'
app.get("/urls", (req, res) => {
  const userId = req.session.id;

  db.query(`SELECT urls.longurl, urls.shorturl, urls.owner_id, users.email, users.id FROM urls JOIN users ON users.id = urls.owner_id WHERE urls.owner_id = ${userId}`)
    .then(data => {
      let urls = urlsForUser(data.rows)
      let templateVars = {
        urls: urls,
        user: { email: data.rows[0].email }
      }
      res.render("urls_index", templateVars);
    })
    .catch(err => {
      return db.query(`SELECT * FROM users WHERE id=${userId}`).
      then(data => {
        const templateVars = {
          user: data.rows[0],
          urls: null
        };
        res.render("urls_index", templateVars);
      })
    })
   

});

//   POST /urls
app.post("/urls", (req, res) => {
  const userId = req.session.id;
  let tempShortUrl = generateRandomString();
  let longURL = req.body.longURL;
  // to ensure that all longURL in database contain http protocol in their url
  if (!longURL.includes('http')) {
    longURL = 'http://' + longURL;
  }

  db.query(`INSERT INTO urls (owner_id, longurl, shorturl) VALUES ($1, $2, $3)`, [userId, longURL, tempShortUrl])
  .then(result => {
    res.redirect(`/urls/${tempShortUrl}`);
  })
  .catch(error =>{
    console.log(error)
  })
});

//   GET /urls/new
app.get("/urls/new", (req, res) => {
  const userId = req.session.id;

  db.query(`SELECT urls.longurl, urls.shorturl, urls.owner_id, users.email, users.id FROM urls JOIN users ON users.id = urls.owner_id WHERE urls.owner_id = ${userId}`)
    .then(data => {
      let urls = urlsForUser(data.rows)
      let templateVars = {
        urls: urls,
        user: { email: data.rows[0].email }
      }
      res.render("urls_new", templateVars);
    })
    .catch(err => {
      return db.query(`SELECT * FROM users WHERE id=${userId}`).
      then(data => {
        const templateVars = {
          user: data.rows[0]
        };
        res.render("urls_new", templateVars);
      })
    })
});

//   GET /urls/:id -> restriction unlogged users is implemented using if in line 15 of 'urls_show.ejs'
app.get("/urls/:shortURL", (req, res) => {
  const userId = req.session.id;
  const shortURL = req.params.shortURL;

  //to restrict loged users only view their urls
  db.query(`SELECT urls.longurl, urls.shorturl, urls.owner_id, users.email, users.id FROM urls JOIN users ON users.id = urls.owner_id WHERE urls.owner_id = ${userId}`)
    .then(data => {
      if (!urlsForUser(data.rows).hasOwnProperty(shortURL)) {
        return res.status(401).send(`<script>alert("You are not authorised to see this page"); window.location.href = "/urls"; </script>`);
      } else {
        let urls = urlsForUser(data.rows)
        const templateVars = {
          shortURL: shortURL,
          longURL: urls[shortURL],
          user: { email: data.rows[0].email }
        };

        res.render("urls_show", templateVars)
      }
    })
    .catch(err => {
      console.log(err)
    });

});

app.post("/urls/:shortURL", (req, res) => {
  const longUrlChanged = req.body.longURL;
  const shortURL = req.params.shortURL;

  db.query(`UPDATE urls SET  longurl = '${longUrlChanged}' WHERE shorturl = '${shortURL}'`)
    .then(result => {
      res.redirect("/urls");
    })
    .catch(err => {
      console.log(err)
    });

});

//   GET /u/:id
app.get("/u/:shortURL", (req, res) => {
  const userId = req.session.id;
  const shortURL = req.params.shortURL;
  db.query(`SELECT longurl, shorturl, owner_id FROM urls WHERE owner_id = ${userId}`)
  .then(data => {
    let urls = urlsForUser(data.rows)
    let longURL = urls[shortURL];
    if (!longURL.includes('http')) {
      longURL = 'http://' + longURL;
    }
    res.redirect(longURL);
  })
  .catch(err => {
    console.log("error in urls", err)
  })
  
});

//   POST /urls/:id/delete
app.post('/urls/:shortURL/delete', (req, res) => {
  const userId = req.session.id;
  const idToBeDeleted = req.params.shortURL;
 db.query(`DELETE FROM urls WHERE shorturl = $1`, [idToBeDeleted]) 

  res.redirect('/urls');
});

//   POST /logout
app.post('/logout', (req, res) => {
  req.session = null;
  res.redirect('/home');
});


app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});