// Fixture: classic insecure patterns.
const express = require('express');
const https = require('https');
const db = require('./db');
const app = express();

app.get('/user/:id', (req, res) => {
  db.query("SELECT * FROM users WHERE id = " + req.params.id, (err, rows) => {
    res.json(rows);
  });
});

app.get('/orders', (req, res) => {
  const userId = req.query.userId;
  db.query(`SELECT * FROM orders WHERE user_id = '${userId}'`);
});

app.post('/calc', (req, res) => {
  const result = eval(req.body.expression);
  res.json({ result });
});

app.post('/admin', (req, res) => {
  const password = req.body.password;
  if (password === "admin123") {
    res.json({ admin: true });
  }
});

https.request({ hostname: 'internal.example.com', rejectUnauthorized: false });

app.listen(3000);
