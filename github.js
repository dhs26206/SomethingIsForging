const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');
const {deployRepo,generateRandomString,unzip,AddtoDB,finalDeploy,CreateUserAddPermission,TransferRepo}=require('./newDeploy.js')
const router=express.Router();
const cookieparser=require('cookie-parser')
const repoSchema=require('./models/repo')
const MongoStore = require('connect-mongo');
const { setProgress,getProgress } = require('./progressTracker');
const mongoUrl=process.env.MONGO_URL || "localhost";
const profileSchema=require('./models/profile.js');
const { randomInt } = require('crypto');
const repo = require('./models/repo');
router.use(session({
  secret: 'VSCODE',
  resave: false,
  saveUninitialized: true,
  store: MongoStore.create({
    
    mongoUrl: `abcd`,  
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
    clientSecret: "a8a64bd380859dec21508feb74739853c06a4b28",
    callbackURL: "https://admin.server.ddks.live/auth/github/callback"
  },
  (accessToken, refreshToken, profile, done) => {
  
    console.log("Check Karo Profile "+profile.username);
    profileSchema.create({userName:profile.username,access_Token:accessToken});
    
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
  let command = `node ${path.resolve(__dirname, 'SyncDeploy.js')} ${owner} ${repo} "${buildCommand}" "${buildDirectory}" "${req.user.accessToken}" "${req.user.profile.username}" "${repoId}" "${deploymentType}" "${node_id}"`;
  
// Log the command to ensure it's constructed properly
console.log(`Executing command: ${command}`);


const process = exec(command);
process.stdout.on('data', (data) => {
  console.log(`Output: ${data}`);
});

// Listen for errors from the stderr stream
process.stderr.on('data', (data) => {
  console.error(`Error: ${data}`);
});

// Handle the process exit event
process.on('exit', (code) => {
  console.log(`Process exited with code: ${code}`);
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
module.exports=router