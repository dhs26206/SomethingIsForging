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
const { setProgress,getProgress } = require('./progressTracker');
router.use(session({
  secret: 'VSCODE',
  resave: false,
  saveUninitialized: true,
  cookie : {
    domain: '.server.ddks.live' 
  }
}));

router.use(passport.initialize());
router.use(passport.session());
passport.serializeUser((user, done) => {
  done(null, user); // This stores the entire user object in the session
});

// Deserialize user from the session
passport.deserializeUser((user, done) => {
  done(null, user); // Retrieves the user object from the session
});

passport.use(new GitHubStrategy({
    clientID: "Ov23linfRqhupACEDloD",
    clientSecret: "a8a64bd380859dec21508feb74739853c06a4b28",
    callbackURL: "https://admin.server.ddks.live/auth/github/callback"
  },
  (accessToken, refreshToken, profile, done) => {
    return done(null, { profile, accessToken });
  }));

router.get('/github', passport.authenticate('github', { scope: ['user', 'repo'] }));

router.get('/github/callback',
  passport.authenticate('github', { failureRedirect: '/' }),
  (req, res) => {
    console.log('User authenticated');
    // Successful authentication
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
        per_page: 100,  // Limit to 100 repositories
      }
    });

    const repos = reposResponse.data;
    let repoListHTML = '<h1>Your GitHub Repositories</h1><ul>';
    let payload=[]
    repos.forEach(repo => {
      // repoListHTML += `<li><a href="/auth/download/${repo.owner.login}/${repo.name}">${repo.name}</a></li>`;
      payload.push({name:repo.name,owner:repo.owner.login,repo:repo.name})
    });
    // repoListHTML += '</ul>';
    
    res.send(payload);
  } catch (err) {
    res.status(500).send('Error fetching repos');
  }
});

// Download repository as a zip file
router.post('/download/:owner/:repo', (req, res) => {
  const { owner, repo } = req.params;

  if (!req.isAuthenticated()) {
    return res.sendStatus(401);
  }

  // Extract buildCommand and buildDirectory from the request body
  let { buildCommand, buildDirectory } = req.body;

  // Respond immediately
  res.sendStatus(200);

  // Schedule handleDeployment to run asynchronously
  let command = `node ${path.resolve(__dirname, 'SyncDeploy.js')} ${owner} ${repo} "${buildCommand}" "${buildDirectory}" "${req.user.accessToken}" "${req.user.profile.username}"`;
  
// Log the command to ensure it's constructed properly
console.log(`Executing command: ${command}`);

// exec(command, (error, stdout, stderr) => {
//   if (error) {
//     console.error(`Error in deployment: ${error.message}`);
//     return;
//   }

//   if (stderr) {
//     console.error(`Stderr output: ${stderr}`);
//   }

//   // Log stdout to check if the command produced any output
//   console.log(`Deployment output: ${stdout}`);
// });
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

// Log to check if the exec started
console.log(`Exec command initiated.`);
  
//  console.log(req.body);
//   if (!req.isAuthenticated()) {
//     return res.redirect('/');
//   }
  
//   const repoUrl = `https://api.github.com/repos/${owner}/${repo}/zipball`;  // API URL for downloading the repo
//   const outputPath = path.join(__dirname, `../artifacts/${repo}.zip`);
  

//   // Download the private repo using access token in the header

//   execSync(`curl -L -H "Authorization: token ${req.user.accessToken}" ${repoUrl} -o ${outputPath}`)
    
    
//     const repoId=generateRandomString(9)
//     const userId=req.user.profile.username||"default"
//     const type="FrontEnd"
//     buildCommand=buildCommand||"npm run build"
//     const deployDirectory=buildDirectory||"build" 
//     console.log(repoId,userId,type,buildCommand,deployDirectory);
//     const WantToDeploy=await unzip(outputPath,repoId)
//     await AddtoDB(repoId,userId,type,repo,buildCommand,deployDirectory)
//     let resp=await deployRepo(repoId,type,buildCommand,deployDirectory,WantToDeploy)
//     res.send(`${resp.toString()}`);

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
    //  execSync(`rm -r /home/${prevRepo}/*`)
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
    // await AddtoDB(repoId,userId,type,repo,buildCommand,deployDirectory)
    await CreateUserAddPermission(repoId,userId,type,repo,buildCommand,deployDirectory)
    await TransferRepo({repoId:repoId,type:type,filePath:WantToDeploy,buildCommand:buildCommand,deployDirectory:deployDirectory});
    await finalDeploy({repoId:repoId,type:type,filePath:WantToDeploy,buildCommand:buildCommand,deployDirectory:deployDirectory})
    
  }
}
module.exports=router