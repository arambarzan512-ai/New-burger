const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(__dirname));

app.listen(port, '0.0.0.0', () => {
  console.log(`Dar Restaurant is available on port ${port}`);
});
