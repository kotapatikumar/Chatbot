const { Embeddings } = require("openai/resources/embeddings.mjs");

class ExpressError extends Error{
    constructor(status,message){
        super();
        this.status=status;
        this.message=message;
    }
}

module.exports=ExpressError;