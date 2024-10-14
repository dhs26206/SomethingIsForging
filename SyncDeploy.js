const { exec } = require('child_process');
const { setProgress, getProgress } = require('./progressTracker');
const { deployRepo, generateRandomString, unzip, AddtoDB, finalDeploy, CreateUserAddPermission, TransferRepo } = require('./newDeploy.js');
const [owner, repo, buildCommand, buildDirectory, accessToken,username,repoId] = process.argv.slice(2);
const fs = require('fs');
const path = require('path');
console.log("Mai Chal Gata")
const repoSchema=require('./models/repo')
// Wrap exec in a promise so you can use await
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
    console.log("Mait Yaha Aaya");
  try {
    // Check if the repo record exists (replace with your actual DB call)
    // let record = await repoSchema.findOne({ userId: owner, repoName: repo });
    record=false;

    if (record) {
      // Handle redeployment if record exists
      let User = record.userId;
      let prevRepo = record.uniqueId;
      let buildCommand = record.buildCommand;
      let buildDirectory = record.buildDirectory;
      let type = record.type;
      // let repoId = generateRandomString(9);
      let repoUrl = `https://api.github.com/repos/${owner}/${repo}/zipball`;
      let outputPath = path.join(__dirname, `../artifacts/${repo}.zip`);

      // Download repo using curl
      await execCommand(`curl -L -H "Authorization: token ${accessToken}" ${repoUrl} -o ${outputPath}`);

      // Unzip and transfer the repo
      const WantToDeploy = await unzip(outputPath, repoId);
      await TransferRepo(prevRepo, type, buildCommand, buildDirectory, WantToDeploy);
      await finalDeploy(repoId, type, buildCommand, buildDirectory, WantToDeploy);

    } else {
      // Handle new deployment
      const repoUrl = `https://api.github.com/repos/${owner}/${repo}/zipball`;
      const outputPath = path.join(__dirname, `../artifacts/${repo}.zip`);
      // const repoId = generateRandomString(9);
      
      // Set initial progress
      setProgress(repoId, 100);

      // Download repo using curl
      await execCommand(`curl -L -H "Authorization: token ${accessToken}" ${repoUrl} -o ${outputPath}`);

      // Prepare deployment details
      const userId = username || "default";
      const type = "FrontEnd";
      const buildCmd = buildCommand || "npm run build";
      const deployDirectory = buildDirectory || "build";

      console.log(repoId, userId, type, buildCmd, deployDirectory);

      // Unzip, Add to DB, and Deploy
      const WantToDeploy = await unzip(outputPath, repoId);
      await setProgress(repoId, 200);
      await getProgress(repoId, (result) => {
        console.log("Now Status :"+ 200)
      });

      // Uncomment once the DB call is ready
      // await AddtoDB(repoId, userId, type, repo, buildCmd, deployDirectory);
      await CreateUserAddPermission(repoId, userId, type, repo, buildCmd, deployDirectory);
      await TransferRepo({ repoId: repoId, type: type, filePath: WantToDeploy, buildCommand: buildCmd, deployDirectory: deployDirectory });
      await finalDeploy({ repoId: repoId, type: type, filePath: WantToDeploy, buildCommand: buildCmd, deployDirectory: deployDirectory });
    }

  } catch (error) {
    setProgress(repoId,629);
    console.error("Deployment failed: ", error);
  }
}
console.log("oijeghojntphg")
deploy();
