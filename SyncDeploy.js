const { exec, execSync } = require('child_process');
const { setProgress, getProgress } = require('./progressTracker');
const {  unzip, finalDeploy, CreateUserAddPermission, TransferRepo } = require('./newDeploy.js');
let [owner, repo, buildCommand, buildDirectory, accessToken,username,repoId,type,node_id] = process.argv.slice(2);
const fs = require('fs');
const path = require('path');
const mongoose=require('mongoose');
// console.log("Mai Chal Gaya")
require('dotenv').config();

const repoSchema=require('./models/repo');
const { CreateWebHook } = require('./services/webhook.js');

const mongoConnection=async()=>{
  try{

      await mongoose.connect(`mongodb+srv://ddks:${encodeURIComponent(process.env.MONGO_PASSWORD)}@${process.env.MONGO_URL }/forging`);
      console.log(`All Internal Test Passed !!`);
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
    console.log("Deployment Worker Initiated");
    
  try {
    
    let record = await repoSchema.findOne({userName: owner, repoName: repo });
    
    const deployDirectory = buildDirectory || "build";
    let statusId=repoId;
    if (record) {
      
      let User = record.userName;
      let prevRepo = record.uniqueId;
      buildCommand = record.buildCommand;
      let RbuildDirectory = record.deployDirectory;
      let type = record.type;
      execCommand(`sed -i 's/${prevRepo}//g' /etc/user-monitor/allowed.txt`)
      
       //This is command to remove this user from Daemon list !!
      let repoUrl = `https://api.github.com/repos/${owner}/${repo}/zipball`;
      let outputPath = path.join(__dirname, `../artifacts/${repo}.zip`);
      setProgress(statusId, 100);
      
      await execCommand(`curl -L -H "Authorization: token ${accessToken}" ${repoUrl} -o ${outputPath}`);

      await setProgress(statusId, 200);
      
      console.log("Repo Downloaded Successfully !!")
      let cleanFolder = path.join(__dirname, `../artifacts/${prevRepo}`);
      if (fs.existsSync(cleanFolder)) {
        execSync(`rm -r ${cleanFolder}`);
        // console.log(`Removed folder: ${cleanFolder}`);
    } 
      
      const WantToDeploy = await unzip(outputPath, repoId);
      await TransferRepo({ repoId: prevRepo, type: type, filePath: WantToDeploy, buildCommand: buildCommand, deployDirectory: RbuildDirectory,statusId });
      await finalDeploy({ repoId: prevRepo, type: type, filePath: WantToDeploy, buildCommand: buildCommand, deployDirectory: RbuildDirectory,statusId });

    } else { // Handle new deployment
      
      await repoSchema.create({userName:owner,repoName:repo,type,buildCommand,deployDirectory,uniqueId:repoId,node_id})
      const repoUrl = `https://api.github.com/repos/${owner}/${repo}/zipball`;
      const outputPath = path.join(__dirname, `../artifacts/${repo}.zip`);
      execCommand(`sed -i 's/${repoId}//g' /etc/user-monitor/allowed.txt `)
      
      await setProgress(statusId, 100);

      await execCommand(`curl -L -H "Authorization: token ${accessToken}" ${repoUrl} -o ${outputPath}`);
      console.log("Repo Downloaded Successfully !!")
      const userId = username || "default";
      
      const buildCmd = buildCommand || "npm run build";
      

      
      const WantToDeploy = await unzip(outputPath, repoId);
      await setProgress(statusId, 200);
     

      
      await CreateUserAddPermission(repoId, userId, type, repo, buildCmd, deployDirectory);
      await TransferRepo({ repoId: repoId, type: type, filePath: WantToDeploy, buildCommand: buildCmd, deployDirectory: deployDirectory,statusId});
      await finalDeploy({ repoId: repoId, type: type, filePath: WantToDeploy, buildCommand: buildCmd, deployDirectory: deployDirectory,statusId });
      await CreateWebHook({owner,repoName:repo,accessToken});
    }

  } catch (error) {
    setProgress(repoId,629);
    console.error("Deployment failed: ", error);
    execCommand(`grep -qxF ${repoId} /etc/user-monitor/allowed.txt || echo ${repoId} >> /etc/user-monitor/allowed.txt`);
  }
}

deploy();
