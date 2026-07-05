import mongoose,{Schema} from "mongoose"
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken"

  const userSchema=new Schema({
    fullname:{
        type:String,
        required:true,
        trim:true,
    },
    username:{
        type:String,
        required:true,
        unique:true,
        index:true,
        trim:true,
        lowercase:true
    },
    email:{
        type:String,
        required:true,
        unique:true,
        trim:true,
        lowercase:true
    },
    password:{
        type:String,
        required:[true,"Password is Required"],
        trim:true
    },
    avatar:{
        type:String,
        default:"/User_Avatar.png"
    },
    coverImage:{
        type:String,
        default:"/User_CoverImage.png"
    },
    refreshToken:{
        type:String
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verifyCode: {
        type: String
    },
    verifyCodeExpiry: {
        type: Date
    },
    forgotPasswordToken: {
        type: String
    },
    forgotPasswordExpiry: {
        type: Date
    }
  },
  {
    timestamps:true
  }
)

userSchema.pre("save",async function(next){

    if(!this.isModified("password")){
        return;
    }

    this.password= await bcrypt.hash(this.password,10)
})

userSchema.methods.isPasswordCorrect=async function(password){
    return await bcrypt.compare(password,this.password)
}

userSchema.methods.generateAccessToken=function(){

    return jwt.sign({
        _id:this._id,
        email:this.email,
        username:this.username
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
        expiresIn:process.env.ACCESS_TOKEN_EXPIRY
    }
)

}

userSchema.methods.generateRefreshToken=function(){

    return jwt.sign({
        _id:this._id
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
        expiresIn:process.env.REFRESH_TOKEN_EXPIRY
    }
)

}

export const User=mongoose.model("User",userSchema)