const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');
const {deployRepo,generateRandomString,unzip,AddtoDB,finalDeploy,CreateUserAddPermission,TransferRepo}=require('./DeploymentServices.js')
const router=express.Router();
const cookieparser=require('cookie-parser')
const repoSchema=require('./models/repo.js')
const MongoStore = require('connect-mongo');
const { setProgress,getProgress } = require('./RedisProgress.js');

const profileSchema=require('./models/profile.js');
const { randomInt } = require('crypto');
const crypto=require('crypto')
const repo = require('./models/repo.js');
const HashMap=require('./hashmap.js');
const { generateWebhookSecret } = require('./services/webhook.js');
const statusIdMap=new HashMap();
require('dotenv').config();
const mongoUrl=process.env.MONGO_URL || "localhost";
function getISTTime() {
  // Get the current time in UTC and convert it to IST by adding 5 hours and 30 minutes
  const now = new Date();
  const utcOffset = now.getTimezoneOffset() * 60000; // Get offset in milliseconds
  const istOffset = 19800000; // IST is UTC + 5 hours 30 minutes (5 * 3600000 + 30 * 60000)
  const istTime = new Date(now.getTime() + utcOffset + istOffset);

  // Format the IST time
  const options = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true // 12-hour format
  };

  // Convert time to readable format
  const formattedTime = istTime.toLocaleString('en-US', options);

  return formattedTime;
}

console.log(getISTTime());
// console.log(process.env.GITHUB_CLIENT_SECRET);
router.use(session({
  secret: 'VSCODE',
  resave: false,
  saveUninitialized: true,
  store: MongoStore.create({
    
    mongoUrl: `mongodb+srv://ddks:${encodeURIComponent(process.env.MONGO_PASSWORD)}@${mongoUrl}/forging`,  
    collectionName: 'sessions',                           
    ttl: 5 * 24 * 60 * 60  
  }),
  cookie: {
    maxAge: 5 * 24 * 60 * 60 * 1000  
  }
}));

router.use(passport.initialize());
router.use(passport.session());
passport.serializeUser((user, done) => {
  done(null, user);  // Store the user ID in the session
});


passport.deserializeUser(async (user, done) => {
  done(null,user);
});
passport.use(new GitHubStrategy({
    clientID: "Ov23linfRqhupACEDloD",
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: "https://admin.server.ddks.live/auth/github/callback"
  },
  (accessToken, refreshToken, profile, done) => {
  
    console.log("Check Karo Profile "+profile.username);
    profileSchema.findOneAndUpdate(
      { userName: profile.username }, 
      { access_Token: accessToken },  
      { new: true, upsert: true } )
    
    return done(null, { profile, accessToken,refreshToken });
  }));

router.get('/github', passport.authenticate('github', { scope: ['user', 'repo'] }));

router.get('/github/callback',
  passport.authenticate('github', { failureRedirect: '/' }),
  (req, res) => {
    console.log('User authenticated');
    req.session.accessToken = req.user.accessToken;
    
    res.redirect('https://frontend.server.ddks.live/repo');
  }
);

router.get('/repos', async (req, res) => {

  if (!req.isAuthenticated()) {
    return res.sendStatus(401);
  }

  try {
    const reposResponse = await axios.get('https://api.github.com/user/repos', {
      headers: {
        Authorization: `Bearer ${req.user.accessToken}`,
      },
      params: {
        per_page: 100,  
      }
    });
    const deployedRepos = await repo.find(
      { userName: req.user.profile.username },
      { repoName: 1, _id: 0 } // Include repoName, exclude _id
    );
    const repoNames = deployedRepos.map(repo => repo.repoName);

    const deployedRepoSet = new Set(repoNames);

  

    const repos = reposResponse.data;
    
    let payload=[]
    repos.forEach(repo => {
      if(deployedRepoSet.has(repo.name)) payload.push({name:repo.name,owner:repo.owner.login,repo:repo.name,deployed:'yes'})
      else payload.push({name:repo.name,owner:repo.owner.login,repo:repo.name,deployed:'no'});
    });
    
    res.send(payload);
  } catch (err) {
    res.status(500).send('Error fetching repos');
  }
});

// Download repository as a zip file
router.post('/download/:owner/:repo',async (req, res) => {
  const { owner, repo } = req.params;

  if (!req.isAuthenticated()) {
    return res.sendStatus(401);
  }
  if(req.user.profile.username!=owner){
    return res.sendStatus(403);
  }
  let node_id=randomInt(5896453);
  try{
    const reposResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `Bearer ${req.user.accessToken}`,
      }
    });
    node_id=reposResponse.data.id;
    
  }
  catch(error){
    return res.sendStatus(404);
  }
  // Extract buildCommand and buildDirectory from the request body
  let { buildCommand, buildDirectory,deploymentType } = req.body;
  let repoId = generateRandomString(9);
  // Respond immediately
  setProgress(repoId,100);
  res.json({repoId})
  // Schedule handleDeployment to run asynchronously
  let command = `node ${path.resolve(__dirname, 'DeploymentWorker.js')} ${owner} ${repo} "${buildCommand}" "${buildDirectory}" "${req.user.accessToken}" "${req.user.profile.username}" "${repoId}" "${deploymentType}" "${node_id}"`;
  
  // Log the command to ensure it's constructed properly
  console.log(`Executing command: ${command}`);

  const outputStream = fs.createWriteStream(`../logs/${node_id}.txt`, { flags: 'a' });
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  await delay(4900); // 'a' means append mode
  const process = exec(command);
  process.stdout.on('data', (data) => {
    let time=getISTTime();
    console.log(`Output: ${data}`);
    outputStream.write(`[${time}]: ${data}`);
  });

  // Listen for errors from the stderr stream
  process.stderr.on('data', (data) => {
    let time=getISTTime();
    console.error(`Error: ${data}`);
    outputStream.write(`[${time}]: ${data}`);
  });

  // Handle the process exit event
  process.on('exit', (code) => {
    console.log(`Process exited with code: ${code}`);
    outputStream.write(`Process exited with code: ${code}\n`);
    outputStream.end();
  });


  console.log(`Exec command initiated.`);
    
  });

router.post('/status', async (req, res) => {
    const userId = req.body.Id;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    try {
      getProgress(userId, (result) => {
        res.json({ Status: result });
      });
    } catch (error) {
      console.error('Error fetching progress:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

async function handleDeployement(owner,repo,buildCommand,buildDirectory,req){
  let record=  repoSchema.findOne({userId:owner,repoName:repo});
  record=false;
  if(record){
     let User=record.userId;
     let prevRepo=record.uniqueId
     let buildCommand=record.buildCommand;
     let buildDirectory=record.buildDirectory;
     let type=record.type;
     let repoId=generateRandomString(9);
     let repoUrl = `https://api.github.com/repos/${owner}/${repo}/zipball`;
     let outputPath = path.join(__dirname, `../artifacts/${repo}.zip`);
     execSync(`curl -L -H "Authorization: token ${req.user.accessToken}" ${repoUrl} -o ${outputPath}`)
     const WantToDeploy=await unzip(outputPath,repoId)
     await TransferRepo(prevRepo,type,buildCommand,buildDirectory,WantToDeploy);
     await finalDeploy(repoId,type,buildCommand,buildDirectory,WantToDeploy);
     
  }
  else{
    const repoUrl = `https://api.github.com/repos/${owner}/${repo}/zipball`;  
    const outputPath = path.join(__dirname, `../artifacts/${repo}.zip`);
    const repoId=generateRandomString(9)
    setProgress(repoId,100);
    execSync(`curl -L -H "Authorization: token ${req.user.accessToken}" ${repoUrl} -o ${outputPath}`)
    
    
    const userId=req.user.profile.username||"default"
    const type="FrontEnd"
    buildCommand=buildCommand||"npm run build"
    const deployDirectory=buildDirectory||"build" 
    console.log(repoId,userId,type,buildCommand,deployDirectory);
    
    const WantToDeploy=await unzip(outputPath,repoId)
    setProgress(repoId,200);

    await CreateUserAddPermission(repoId,userId,type,repo,buildCommand,deployDirectory)
    await TransferRepo({repoId:repoId,type:type,filePath:WantToDeploy,buildCommand:buildCommand,deployDirectory:deployDirectory});
    await finalDeploy({repoId:repoId,type:type,filePath:WantToDeploy,buildCommand:buildCommand,deployDirectory:deployDirectory})
    
  }
}
router.get('/check',async (req, res) => {
  console.log("Triggrered")
  if (req.isAuthenticated()) {
    console.log(req.user.profile.username);
    
    res.json({
      user: req.user.profile.username,
    });
  } else {
    
    res.json({
      user: "undefined"
    });
  }
});
router.get("/list",async (req,res)=>{
  const githubUsername=req.user.profile.username;
  if(!req.isAuthenticated()){
    res.sendStatus(401);
  }
      const query=await repoSchema.find({userName:githubUsername});
      res.json(query);
    
  
})
router.post("/logs/:owner/:repo",async(req,res)=>{
  const {owner,repo}=req.params;
  const id=req.body.Id;
  const type=req.body.type
  console.log(id);
  let textfile=null;
  if (!req.isAuthenticated()) {
    return res.sendStatus(401);
  }
  if(!statusIdMap.has(id)){
    try{
      const reposResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          Authorization: `Bearer ${req.user.accessToken}`,
        }
      });
      statusIdMap.add(id,reposResponse.data.id);
      textfile=reposResponse.data.id
      
    }
    catch(error){
      return res.sendStatus(404);
    }

  }
  else{
    textfile=statusIdMap.get(id);
  }

  let logFilePath=path.resolve(__dirname,`../logs/${textfile}.txt`);
  
  

    // Open the file and read from the last known position
    try {
      const stats = fs.statSync(logFilePath);
      let lastPosition=req.body.index||0;
      if(type===0&&req.body.index===0) lastPosition = Math.max(parseInt(req.body.index, 10) , stats.size);
      
  
      // If file size is smaller than the last position (e.g., log file was truncated), reset lastPosition
      if (stats.size < lastPosition) {
          return res.json({ newLogs: '', newPosition: stats.size });
      }
  
      // Open the file synchronously
      const fd = fs.openSync(logFilePath, 'r');
  
      // Create a buffer to store the new log content
      const buffer = Buffer.alloc(stats.size - lastPosition);
  
      // Read the log file from the last known position synchronously
      const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, lastPosition);
  
      // Convert the buffer to a string
      const newLogs = buffer.toString('utf8', 0, bytesRead);
  
      // Close the file descriptor synchronously
      fs.closeSync(fd);
      let Status=0;
      // Send the new log data and updated position
      await getProgress(id, (result) => {
        Status=result;
      });
      // const Status=getProgress(id);
      res.json({ newLogs, newPosition: stats.size,Status });
  
      } catch (err) {
          console.error('Error:', err);
          return res.status(500).send('Error reading log file');
      }
  
});  

router.get("/details/:id",async (req,res)=>{
  const id=req.params.id;
  if(!req.isAuthenticated()) return res.sendStatus(403);
  const response=await repoSchema.findOne({uniqueId:id});
  if(response){
    const RepoRequest=await axios(`https://api.github.com/repos/${response.userName}/${response.repoName}`,
     { headers: {
        Authorization : `Bearer ${req.user.accessToken}`,
      }}
    )
    const RepoDetails=RepoRequest.data;
    const type=response.type==="frontend"?0:1;
    res.json({repoName:response.repoName,type,buildCommand:response.buildCommand,buildDirectory:response.deployDirectory,
      private:RepoDetails.private,createdDate:RepoDetails.created_at,updatedDate:RepoDetails.updated_at,htmlURL:RepoDetails.html_url,
      owner:response.userName
    })
  }
  else{res.sendStatus(404);}
})
  
router.get('/delete/:id',async(req,res)=>{
  if(!req.isAuthenticated()) res.sendStatus(403);
  const id=req.params.id;
  const checkRepo=await repoSchema.findOne({uniqueId:id})
  if(req.user.profile.username!==checkRepo.userName) res.sendStatus(403);
  try{
    const deleteRecord= await repoSchema.deleteOne({uniqueId:id});
    execSync(`sudo tmux kill-session -t ${id}`);
    execSync(`sudo deluser --remove-home ${id}`);
    execSync(`sudo rm /etc/nginx/sites-enabled/${id}.server.ddks.live`);
    execSync(`sudo rm /etc/nginx/sites-available/${id}.server.ddks.live`);
    execSync(`systemctl reload nginx`);

    res.sendStatus(200);
  }
  catch(error){
    res.sendStatus(404);
  }

})

router.post("/webhook/:owner/:repoName",async (req,res)=>{
    const { owner, repoName } = req.params;
    const secret = generateWebhookSecret(owner, repoName); // Generate the same secret
    const signature = req.headers['x-hub-signature-256']; // Use lowercase for header keys
    const isPing = req.headers['x-github-event']; 
    if(isPing==='ping') {res.sendStatus(200);console.log("Pinged Baby!!");return;}
    const payload = JSON.stringify(req.body); // Get the payload

    console.log("Me Triggered Baby "+owner+" "+signature)
    // Create HMAC hash for the payload
    const hmac = crypto.createHmac('sha256', secret);
    const digest = `sha256=${hmac.update(payload).digest('hex')}`;

    // Verify the signature
    if (signature === digest) {
      
        console.log('Valid signature. Processing the payload...');
        const rep=await profileSchema.findOne({userName:owner});
        const access_Token=rep.access_Token;
        const details=await repoSchema.findOne({userName:owner,repoName});
        const bin_Id=generateRandomString(8);
        if(details){
          try{
          let command = `node ${path.resolve(__dirname, 'DeploymentWorker.js')} "${owner}" "${repoName}" "" "" "${access_Token}" "${owner}" "${bin_Id}" "" ""`;
          const node_id=details.node_id;
          const outputStream = fs.createWriteStream(`../logs/${node_id}.txt`, { flags: 'a' });
          const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
          await delay(4900); // 'a' means append mode
          const process = exec(command);
          process.stdout.on('data', (data) => {
            let time=getISTTime();
            console.log(`Output: ${data}`);
            outputStream.write(`[${time}]: ${data}`);
          });

          // Listen for errors from the stderr stream
          process.stderr.on('data', (data) => {
            let time=getISTTime();
            console.error(`Error: ${data}`);
            outputStream.write(`[${time}]: ${data}`);
          });

          // Handle the process exit event
          process.on('exit', (code) => {
            console.log(`Process exited with code: ${code}`);
            outputStream.write(`Process exited with code: ${code}\n`);
            outputStream.end();
          });}catch(error){
            console.log("Webhook :"+error);
            res.sendStatus(500);
          }
          
        }
        else{
          res.sendStatus(404);
        }

        // Process the payload (e.g., handle the commit)
        res.status(200).send('Webhook received and verified.');
    } else {
        console.error('Invalid signature. Ignoring the payload.');
        res.status(401).send('Unauthorized');
    }

})

module.exports=router