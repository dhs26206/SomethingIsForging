const { execSync } = require('child_process');

const {reservePort,isPortInUse,findFreePort}=require('./finalDeploy')


const f=async () => {
    try {
        let port = await findFreePort(); // Use await inside async function
        console.log(port); // Now port is correctly logged
    } catch (error) {
        console.error(error);
    }
}
f();
// console.log(reservePort("abcfgwd"));