const mongoose=require('mongoose')

const profileSchema=mongoose.Schema({
    userName:{
        type:String,
        required:true,
        unique:true
    },
    access_Token:{
        type:String,
        required:true,
        unique:true

    }

})
module.exports=mongoose.model('profile',profileSchema);