
const axios=require('axios');
const signaturePhrase=process.env.signaturePhrase;
const crypto = require('crypto');

function createSha256Hash(input) {
    return crypto.createHash('sha256').update(input).digest('hex');
}
function generateWebhookSecret(owner, repoName) {
    return createSha256Hash(signaturePhrase + repoName + owner);
}

async function CreateWebHook({owner,repoName,accessToken}){
    const api_URL= `https://api.github.com/repos/${owner}/${repoName}/hooks`
    const secret=createSha256Hash(signaturePhrase+repoName+owner);
    const body={
            "name": "web",
            "active": true,
            "events": [
                "push",
                "pull_request"
            ],
            "config": {
                "url": `https://admin.server.ddks.live/auth/webhook/${owner}/${repoName}`,
                "content_type": "json",
                "secret": secret,
            }
    }
    const resp=await axios.post(api_URL,{
        body,
        headers: {
            Authorization: `Bearer ${accessToken}}`,
          }
    })


    
}
module.exports={generateWebhookSecret,CreateWebHook}