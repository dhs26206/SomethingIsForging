const crypto=require('crypto')
const repoSchema=require('./models/repo')
const path=require('path')
const fs=require('fs')
const child=require('node:child_process')
const {reservePort} = require('./finalDeploy');
const { Console } = require('console')
const { setProgress,getProgress } = require('./progressTracker');
function generateRandomString(length) {
    return crypto.randomBytes(length)
      .toString('base64')
      .slice(0, length)
      .replace(/\+/g, '0')  // Replace + with 0 to avoid URL-unsafe characters
      .replace(/\//g, '0'); // Replace / with 0
  }

async function unzip(filePath,foldername){

  const outputPath=path.join(__dirname, `../artifacts/`+foldername);
  console.log("Folder ye raha "+outputPath)
  const command='unzip '+filePath+' -d '+outputPath
  child.execSync(command)
  return outputPath
}
async function AddtoDB(deployId,userId,type,repoName,buildCommand,deployDirectory){
    const newRepo=new repoSchema({
        userId:userId,
        repoName:repoName,
        type:type,
        buildCommand:buildCommand,
        deployDirectory:deployDirectory,
        uniqueId:deployId
    })
    newRepo.save()

}
async function CreateUserAddPermission(repoId,type,buildCommand,deployDirectory,filePath){
    child.execSync("scripts/createuser.sh "+repoId) 
    
    child.execSync("scripts/restrict_command.sh "+repoId)
    child.execSync("scripts/adduser.sh "+repoId)
    console.log("Base User and Permission Made")

}
async function TransferRepo({ repoId, type, filePath, buildCommand, deployDirectory }){
    console.log("Transfer Repo Started")
    const files=fs.readdirSync(filePath);
    const dirs = files.filter(file => fs.statSync(path.join(filePath, file)).isDirectory());
    const folderName = dirs[0];
    console.log("3");
    const folderPath = path.join(filePath, folderName);
    child.execSync("rsync -av "+folderPath+"/"+" /home/"+repoId+"/") 
    // const command = 'ls -l /root/project/scripts'; 
    // const output = child.execSync(command, { encoding: 'utf-8' });
    // console.log(output);
    child.execSync("bash /root/project/scripts/restrict_ReadWrite.sh "+repoId)
    console.log("4");
}

async function deployRepo(repoId,type,buildCommand,deployDirectory,filePath){
    console.log("1");
    child.execSync("scripts/createuser.sh "+repoId)  //RepoID is used as a user
    
    child.execSync("scripts/restrict_command.sh "+repoId)
    child.execSync("scripts/adduser.sh "+repoId)
    // child.execSync("scripts/cggroup_restrict.sh "+repoId) //Restricting the CPU and Memory usage
    console.log("2");
    const files=fs.readdirSync(filePath);
    const dirs = files.filter(file => fs.statSync(path.join(filePath, file)).isDirectory());
    const folderName = dirs[0];
    console.log("3");
    const folderPath = path.join(filePath, folderName);
    child.execSync("mv "+folderPath+"/*"+" /home/"+repoId) //Moving the file to the user directory
    const command = 'ls -l /root/project/scripts';
    
    // Execute the command synchronously
    const output = child.execSync(command, { encoding: 'utf-8' }); // Use utf-8 encoding to get a string output
    
    // Log the output
    console.log(output);
    child.execSync("bash /root/project/scripts/restrict_ReadWrite.sh "+repoId)
    console.log("4");
    // if(type==="FrontEnd"){
    //     child.execSync("su - "+repoId+" -c 'npm install --no-save --no-package-lock --no-progress'") 
    //     child.execSync(`su - ${repoId} -c "bash -l -c '${buildCommand}'"`)
    //     let port=await reservePort(repoId)
    //     let command=`tmux new-session -d -s ${repoId} "su - ${repoId} -c 'npx serve -s ${deployDirectory} -l ${port}'"`
    //     child.execSync(`echo ${command} >> ${repoId}.sh`);
    //     child.execSync(`rm -r node_modules/`);
    //     child.execSync(command) //Serving the FrontEnd

    //     console.log("FrontEnd deployed successfully on "+repoId+" at port "+port+"with domain "+repoId+".server.ddks.live")
    //     return "FrontEnd deployed successfully on "+repoId+" at port "+port+"with domain "+repoId+".server.ddks.live";
    // }.
    finalDeploy(repoId,type,buildCommand,deployDirectory,filePath);
}
async function finalDeploy({ repoId, type, filePath, buildCommand, deployDirectory ,statusId }){
    console.log("Final Deployement Started")
        // child.execSync("su - "+repoId+" -c 'npm install --no-save --no-package-lock --no-progress'") 
        await setProgress(statusId,300);
        await getProgress(statusId, (result) => {
            console.log("Now Status :"+ result)
          });
    
        child.execSync("su - "+repoId+" -c 'pnpmddks install --no-save'") 
        await setProgress(statusId,400)
        await getProgress(statusId, (result) => {
            console.log("Now Status :"+ result)
          });
    
    if(type==="frontend"){
        
        child.execSync(`su - ${repoId} -c "bash -l -c '${buildCommand}'"`)
        let port=0;
        if(repoId===statusId)  port=await reservePort(repoId,deployDirectory,0) // 0 depicting Frontend
        else child.execSync(`sudo setfacl -m u:www-data:rx /home/${repoId}`) 
        await setProgress(statusId,500)
        await getProgress(statusId, (result) => {
            console.log("Now Status :"+ result)
          });
          let killIfExist=`tmux kill-session -t ${repoId} 2>/dev/null`;
          try {
            child.execSync(killIfExist);
            console.log(`Killed tmux session: ${repoId}`);
          } catch (error) {
            if (error.status === 1) {
              // This error status occurs when the tmux session does not exist
              console.log(`Tmux session ${repoId} does not exist or was already terminated.`);
            } else {
              // Handle other errors (permissions issues, etc.)
              console.error('Error killing tmux session:', error.message);
            }
          }
        let command=`tmux new-session -d -s ${repoId} "su - ${repoId} -c 'npx serve -s ${deployDirectory} -l ${port}'"`
        child.execSync(`echo ${command} > /home/${repoId}/run.sh`);
        child.execSync(`chmod +x /home/${repoId}/run.sh`);
        child.execSync(command) //Serving the FrontEnd
        setProgress(statusId,600);
        // child.execSync(`rm -r /home/${repoId}/node_modules/`);3
        // child.execSync(`su - ${repoId} -c "bash -l -c 'rm -r node_modules/'"`)
        
        console.log("FrontEnd deployed successfully on "+repoId+" at port "+port+" with domain "+repoId+".server.ddks.live")
        return "FrontEnd deployed successfully on "+repoId+" at port "+port+" with domain "+repoId+".server.ddks.live";
    }
    else{
        let port=await reservePort(repoId,deployDirectory,1)

        // child.execSync(`su - ${repoId} -c "bash -l -c '${buildCommand}'"`)
        await setProgress(statusId,500)
        await getProgress(statusId, (result) => {
            console.log("Now Status :"+ result)
          });
        let killIfExist=`tmux kill-session -t ${repoId} 2>/dev/null`;
        // child.execSync(killIfExist);
        try {
            child.execSync(killIfExist);
            console.log(`Killed tmux session: ${repoId}`);
          } catch (error) {
            if (error.status === 1) {
              // This error status occurs when the tmux session does not exist
              console.log(`Tmux session ${repoId} does not exist or was already terminated.`);
            } else {
              // Handle other errors (permissions issues, etc.)
              console.error('Error killing tmux session:', error.message);
            }
          }
        let command=`tmux new-session -d -s ${repoId} "su - ${repoId} -c 'PORT=${port} ${buildCommand}'"`;
        child.execSync(`echo ${command} > /home/${repoId}/run.sh`);
        child.execSync(`chmod +x /home/${repoId}/run.sh`);
        child.execSync(command) ;
        setProgress(statusId,600); 
        console.log("FrontEnd deployed successfully on "+repoId+" at port "+port+"with domain "+repoId+".server.ddks.live")
        return "FrontEnd deployed successfully on "+repoId+" at port "+port+"with domain "+repoId+".server.ddks.live";
    }

}


module.exports = {
    deployRepo,
    generateRandomString,
    unzip,
    AddtoDB,
    finalDeploy,
    CreateUserAddPermission,
    TransferRepo
};
