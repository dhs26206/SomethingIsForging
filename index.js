
const github=require('./github')
const express=require('express')
require('dotenv/config');
const mongoose=require('mongoose');
require('dotenv').config();
const session=require('express-session')
const app =express()
const cors=require('cors');
const bodyParser=require('body-parser')
const cookieparser=require('cookie-parser')
require('dotenv').config();
app.use(cors({
    origin: 'https://frontend.server.ddks.live', // Allow this specific domain
    credentials: true // If you need to allow cookies or authentication headers
  }));
app.use(bodyParser.json());
app.use(cookieparser())

// app.use(session({
//     secret: 'lblkrotip509rjrvjmr0jgv034v0',
//     resave: false,
//     saveUninitialized: true,
//     cookie: {
//       secure: true, // Ensure this is only true for HTTPS connections
//       sameSite: 'None', // Set SameSite to None for cross-origin requests
//       maxAge: 24 * 60 * 60 * 1000, // Cookie expiration time (optional)
//       domain: '.server.ddks.live' 
//     }
//   }));
app.get('/', (req, res) => {
    
    res.send(`<h1>Welcome</h1><a href="/auth/github">Login with GitHub</a>`);
    
    
});
app.get('/check-cookie', (req, res) => {
    console.log(req.cookies);  // Logs all cookies sent with the request
  
    console.log(req.cookies['connect.sid']);
    res.sendStatus(200);
  });
const port = process.env.PORT || 8080;
const mongoPort=process.env.MONGO_PORT || 27017;
const mongoUrl=process.env.MONGO_URL || "localhost";
const mongoConnection=async()=>{
    try{

        await mongoose.connect(`mongodb+srv://ddks:${encodeURIComponent(process.env.MONGO_PASSWORD)}@${mongoUrl}/forging`);
        console.log(`mongo connected!!`);
    }
    catch(err){
        console.log(`mongo connecteion err!! ${err}`);
    }
}
mongoConnection();

app.get('/testhold',async(req,res)=>{
    await new Promise((resolve,reject)=>{
      setInterval(()=> {resolve()},10000);
    })
    res.json({status:true});
  })
  app.get('/testrun',(req,res)=>{
    res.json({status:true});
  })
app.use('/auth',github)



app.listen(port,(req,resp)=>{
    console.log("app started , Go On");
})