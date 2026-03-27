const express = require('express');
const app = express();
app.use(express.static('demo'));
app.listen(3000, () => console.log('Demo running on http://localhost:3000'));
