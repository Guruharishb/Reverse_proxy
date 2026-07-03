const express = require("express"); 
const app = express(); 
 
const PORT = process.env.PORT || 3000; 
 
app.get("/", (req, res) => { 
  res.json({ 
    server: "server-" + PORT, 
    port: PORT, 
    time: new Date() 
  }); 
}); 
 
app.listen(PORT, () => { 
  console.log("Running on port", PORT); 
});