const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('*', function(req, res) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, function() {
    console.log('CRT JOURNAL corriendo en puerto ' + PORT);
});
