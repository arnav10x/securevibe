// Fixture: a small, well-behaved app. The scanner should find NOTHING here.
const express = require('express');
const db = require('./db');
const app = express();

const apiKey = process.env.API_KEY;

app.get('/user/:id', async (req, res) => {
  // Parameterized query: the database treats $1 strictly as a value.
  const rows = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
  res.json(rows);
});

app.listen(process.env.PORT || 3000);
