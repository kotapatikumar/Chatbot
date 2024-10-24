const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/chatbot')
  .then(() => console.log('Connected!'));


const userSchema=new mongoose.Schema({
    email:{
        type:String,
        required:true
    },
    conversation:[{
      message:{
        type:String
      },
      role:{
        type:String,
        enum:["user","chatProvider"]
      }
    }]
})

userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model('User',userSchema);


