const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.redirect('/index.html');
});

app.post('/api/chat', async (req, res) => {
    try {
        const message = req.body.messages;

        if (!message || !Array.isArray(message)) {
            return res.status(400).json({
                error: 'message harus berupa array.'
            });
        }

        