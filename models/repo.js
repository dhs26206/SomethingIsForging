const mongoose=require('mongoose');

const repoSchema=mongoose.Schema({
    userName:{
        type:String,
        required:true
    },
    repoName:{
        type:String,
        required:true
    },
    type:{    //FrontEnd or Backend
        type:String,
        required:true
    },
    buildCommand:{
        type:String,
        
    },
    deployDirectory:{
        type:String,

    },
    uniqueId:{
        type:String,
        unique:true,
        required:true
    },
    

})
module.exports=mongoose.model('Repo',repoSchema);