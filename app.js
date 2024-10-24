const express=require("express");
const bodyParser = require('body-parser');
const dialogflow = require('@google-cloud/dialogflow');
const app=express();
const path=require("path");
const mongoose = require('mongoose');
const sessions = require("express-session");
const passport=require("passport");
const LocalStrategy=require("passport-local");
const OpenAI = require('openai');
const OpenAIApi = require('openai');
const User=require("./models/user.js");
const flash = require('connect-flash');
const ExpressError = path.join(__dirname, 'js', 'ExpressError.js')
if(process.env.NODE_ENV !== "production"){
    require('dotenv').config();

}

app.set("view engine","ejs");
app.set("views",path.join(__dirname,"views"));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(bodyParser.json());
app.use(sessions({
    secret:process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    cookie:{
        expires:Date.now()+ 7*24*60*60*1000,
        maxAge:7*24*60*60*1000,
        httpOnly:true
    }
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req,res,next)=>{
    res.locals.User=req.user;
    res.locals.success=req.flash("success");
    res.locals.error=req.flash("error");
    next();
})


mongoose.connect('mongodb://127.0.0.1:27017/chatbot')
  .then(() => console.log('Connected!'));






let wrapAsync =(fn)=>{
    return function(req,res,next){
        fn(req,res,next).catch(next);
    }
}


//Home page
app.get("/chatbot",(req,res)=>{
    res.render("home.ejs")
})




//signup
app.get("/signup",(req,res)=>{
    res.render("signup.ejs");
})


app.post("/signup",wrapAsync(async(req,res,next)=>{
    try{
    let user=req.user;
    let{username,email,password}=req.body;
    let userSignUp=new User({
        username:username,
        email:email
    });
    let final=await User.register(userSignUp,password);
    console.log(final);
    req.login(final,(err)=>{
        let user=req.user;
        if(err){
            return next(err);
        }
        req.flash("success","Welcome! You have successfully signed up.");
        let message=req.flash("success");
        res.render("main.ejs",{user,message});
    })
  }
  catch(err){
    req.flash("error","A user with the given username is already registered")
    let error=req.flash("error");
    res.render("signup.ejs",{error});
  }
}))

//login
app.get("/login",(req,res)=>{
    res.render("login.ejs");
})

app.post("/login",passport.authenticate("local",{failureRedirect:"/login",failureFlash:true}),(req,res,next)=>{
        let user=req.user;
        req.flash("success","Welcome back! You have successfully logged in.");
        let message=req.flash("success");
        res.render("main.ejs",{user,message});
})

//LogOut
app.get("/logout",wrapAsync(async(req,res,next)=>{
    req.logout((err)=>{
        if(err){
        return next(err);
        }
    });
    res.redirect("/chatbot");
}))






app.get("/goToChat",(req,res)=>{
    let user=req.user;
    let message="Welcome back to Chat"
    res.render("main.ejs",{user,message});
})



const projectId = process.env.PROJECT_ID;
const sessionClient = new dialogflow.SessionsClient({
    keyFilename: process.env.FILE_PATH
});



app.post('/chatbot/data', wrapAsync(async (req, res) => {
    const { email, message } = req.body;

    // console.log('Request Body:', req.body); // Log the incoming request

    if (!email || !message) {
        return res.status(400).send('Email and message are required.');
    }

    try {
        // Save user message to the database
        await User.findOneAndUpdate(
            { email: email },
            { $push: { conversation: { message, role: 'user' } } },
            { new: true, upsert: true }
        );

        // Send message to Dialogflow
        const sessionId = email; // Using email as session ID
        const sessionPath = sessionClient.projectAgentSessionPath(projectId, sessionId);

        const request = {
            session: sessionPath,
            queryInput: {
                text: {
                    text: message,
                    languageCode: 'en',
                },
            },
        };

        const responses = await sessionClient.detectIntent(request);
        const result = responses[0].queryResult;

        // Save the Dialogflow response to the database
        await User.findOneAndUpdate(
            { email: email },
            { $push: { conversation: { message: result.fulfillmentText, role: 'chatProvider' } } }
        );

        res.json({ response: result.fulfillmentText });
    } catch (error) {
        console.error('Error communicating with Dialogflow:', error);
        res.status(500).send('Error communicating with Dialogflow');
    }
}));

app.all("*",(req,res,next)=>{
    next(new ExpressError(404,"Page Not Found"));
})

app.use((err,req,res,next)=>{
    let {statusCode=400,message="Page not found"}=err;
    res.render("error.ejs",{err});
})



app.listen(8080,()=>{
    console.log("Connected successfully");
})