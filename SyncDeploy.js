const { exec, execSync } = require('child_process');
const { setProgress, getProgress } = require('./progressTracker');
const { deployRepo, generateRandomString, unzip, AddtoDB, finalDeploy, CreateUserAddPermission, TransferRepo } = require('./newDeploy.js');
const [owner, repo, buildCommand, buildDirectory, accessToken,username,repoId,type,node_id] = process.argv.slice(2);
const fs = require('fs');
const path = require('path');
const mongoose=require('mongoose');
console.log("Mai Chal Gaya")
const repoSchema=require('./models/repo')

const mongoConnection=async()=>{
  try{

      await mongoose.connect(`mongodb+srv://ddks:${encodeURIComponent(process.env.MONGO_PASSWORD)}@${process.env.MONGO_URL }/forging`);
      console.log(`mongo connected!! Sync Deploy Wala`);
  }
  catch(err){
      console.log(`mongo connecteion err!! ${err}`);
  }
}
mongoConnection();

function execCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}

async function deploy() {
    console.log("Mai Yaha Aaya");
  try {
    
    let record = await repoSchema.findOne({userName: owner, repoName: repo });
    
    const deployDirectory = buildDirectory || "build";
    let statusId=repoId;
    if (record) {
      
      let User = record.userName;
      let prevRepo = record.uniqueId;
      let buildCommand = record.buildCommand;
      let buildDirectory = record.buildDirectory;
      let type = record.type;
      
      let repoUrl = `https://api.github.com/repos/${owner}/${repo}/zipball`;
      let outputPath = path.join(__dirname, `../artifacts/${repo}.zip`);
      setProgress(statusId, 100);
      
      await execCommand(`curl -L -H "Authorization: token ${accessToken}" ${repoUrl} -o ${outputPath}`);

      await setProgress(statusId, 200);
      await getProgress(statusId, (result) => {
        console.log("Now Status :"+ 200)
      });
      let cleanFolder = path.join(__dirname, `../artifacts/${prevRepo}`);
      if (fs.existsSync(cleanFolder)) {
        execSync(`rm -r ${cleanFolder}`);
        console.log(`Removed folder: ${cleanFolder}`);
    } else {
        console.log(`Folder does not exist: ${cleanFolder}`);
    }
      
      const WantToDeploy = await unzip(outputPath, repoId);
      await TransferRepo({ repoId: prevRepo, type: type, filePath: WantToDeploy, buildCommand: buildCommand, deployDirectory: buildDirectory,statusId });
      await finalDeploy({ repoId: prevRepo, type: type, filePath: WantToDeploy, buildCommand: buildCommand, deployDirectory: buildDirectory,statusId });

    } else { // Handle new deployment
      

      await repoSchema.create({userName:owner,repoName:repo,type,buildCommand,deployDirectory,uniqueId:repoId,node_id})
      const repoUrl = `https://api.github.com/repos/${owner}/${repo}/zipball`;
      const outputPath = path.join(__dirname, `../artifacts/${repo}.zip`);
      
      
      setProgress(statusId, 100);

      await execCommand(`curl -L -H "Authorization: token ${accessToken}" ${repoUrl} -o ${outputPath}`);

      
      const userId = username || "default";
      
      const buildCmd = buildCommand || "npm run build";
      

      console.log(repoId, userId, type, buildCmd, deployDirectory);

      // Unzip, Add to DB, and Deploy
      const WantToDeploy = await unzip(outputPath, repoId);
      await setProgress(statusId, 200);
      await getProgress(statusId, (result) => {
        console.log("Now Status :"+ 200)
      });

      
      await CreateUserAddPermission(repoId, userId, type, repo, buildCmd, deployDirectory);
      await TransferRepo({ repoId: repoId, type: type, filePath: WantToDeploy, buildCommand: buildCmd, deployDirectory: deployDirectory,statusId});
      await finalDeploy({ repoId: repoId, type: type, filePath: WantToDeploy, buildCommand: buildCmd, deployDirectory: deployDirectory,statusId });
    }

  } catch (error) {
    setProgress(repoId,629);
    console.error("Deployment failed: ", error);
  }
}

deploy();
